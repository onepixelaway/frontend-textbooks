import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test, { after } from "node:test";
import { chromium } from "playwright";
import {
  allowRemoteStylesheetDependencies,
  browserRequestPolicy,
  createStaticAssetContext
} from "../scripts/lib/static-assets.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(new URL("..", import.meta.url).pathname);
const browserScript = join(root, "scripts/book-browser.mjs");
const buildScript = join(root, "scripts/build-html-book.mjs");
const inspectPdfScript = join(root, "scripts/inspect-pdf.sh");
const verifyWrapper = join(root, "scripts/verify-rendered-book.sh");
const exportWrapper = join(root, "scripts/export-pdf.sh");
const temporaryDirectories = [];

after(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryDirectory(prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

async function fixture({ html, files = {}, manifest = true }) {
  const directory = await temporaryDirectory("frontend-textbooks-verifier-");
  await writeFile(join(directory, "index.html"), html);
  await writeFile(join(directory, "cover-options.html"), "<!doctype html><title>Cover options</title>");
  for (const [name, contents] of Object.entries(files)) {
    const path = join(directory, name);
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, contents);
  }
  if (manifest) {
    await writeFile(join(directory, "book-build-manifest.json"), JSON.stringify({
      schemaVersion: 1,
      entry: "index.html",
      coverOptions: "cover-options.html",
      files: ["index.html", "cover-options.html", ...Object.keys(files).filter((name) => name !== "secret.txt")],
      source: { manuscript: "manuscript.md" }
    }));
  }
  return directory;
}

async function runBrowser(mode, directory, extra = []) {
  const args = [browserScript, mode, "--html", join(directory, "index.html"), "--wait", "ready"];
  if (mode === "verify") {
    args.push("--output-dir", join(directory, "verification"));
  } else {
    args.push("--pdf", join(directory, "book.pdf"));
  }
  try {
    const result = await execFileAsync(process.execPath, [...args, ...extra], {
      cwd: root,
      timeout: 45_000,
      maxBuffer: 8 * 1024 * 1024
    });
    return { status: 0, ...result };
  } catch (error) {
    return {
      status: typeof error.code === "number" ? error.code : 1,
      stdout: error.stdout || "",
      stderr: error.stderr || String(error)
    };
  }
}

function simpleBook(body, { head = "", attributes = "" } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${head}</head><body ${attributes}><main class="book"><section class="page"><div class="page-inner">${body}</div></section></main></body></html>`;
}

test("blank custom books fail closed", async () => {
  const directory = await fixture({ html: simpleBook("   ") });
  const result = await runBrowser("verify", directory);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(`${result.stdout}\n${result.stderr}`, /nonzero text|blank|content/i);
});

test("missing required images fail verification", async () => {
  const directory = await fixture({
    html: simpleBook('<h1>Book</h1><img src="missing.png" alt="Required diagram">'),
    files: { "missing.png": "" }
  });
  await writeFile(join(directory, "missing.png"), "");
  const result = await runBrowser("verify", directory);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(`${result.stdout}\n${result.stderr}`, /image|decode|asset/i);
});

test("source-manifest preservation loss fails verification", async () => {
  const sourceManifest = {
    threshold: 0.9,
    totalWords: 10,
    blocks: [
      { id: "one", text: "one two three four five", words: 5 },
      { id: "two", text: "six seven eight nine ten", words: 5 }
    ]
  };
  const bookData = JSON.stringify({ sourceManifest }).replace(/</g, "\\u003c");
  const html = `<!doctype html><html><body><main class="book"><section class="page"><div class="page-inner"><p data-source-block-id="one">one two three four five</p></div></section></main><script type="application/json" id="book-data">${bookData}</script><script>window.__BOOK_READY = true;</script></body></html>`;
  const directory = await fixture({ html });
  const result = await runBrowser("verify", directory);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(`${result.stdout}\n${result.stderr}`, /preserv|coverage|source/i);
});

test("source preservation rejects inflated weights and reordered prose", async (t) => {
  await t.test("inflated block weight", async () => {
    const sourceManifest = {
      threshold: 0.9,
      totalWords: 1,
      blocks: [{ id: "one", expectedText: "one two three four five", wordCount: 1 }]
    };
    const bookData = JSON.stringify({ sourceManifest }).replace(/</g, "\\u003c");
    const html = `<!doctype html><html><body><main class="book"><section class="page"><p data-source-block-id="one">one two three four five</p></section></main><script type="application/json" id="book-data">${bookData}</script><script>window.__BOOK_READY=true;</script></body></html>`;
    const directory = await fixture({ html });
    const result = await runBrowser("verify", directory);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /wordCount|source block/i);
  });

  await t.test("reordered prose", async () => {
    const sourceManifest = {
      threshold: 0.9,
      totalWords: 3,
      blocks: [{ id: "one", expectedText: "do not proceed", wordCount: 3 }]
    };
    const bookData = JSON.stringify({ sourceManifest }).replace(/</g, "\\u003c");
    const html = `<!doctype html><html><body><main class="book"><section class="page"><p data-source-block-id="one">proceed do not</p></section></main><script type="application/json" id="book-data">${bookData}</script><script>window.__BOOK_READY=true;</script></body></html>`;
    const directory = await fixture({ html });
    const result = await runBrowser("verify", directory);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /coverage|preservation/i);
  });
});

test("fixed pages with clipped titles fail verification", async () => {
  const head = `<style>.page{width:300px;height:180px;overflow:hidden}.page-inner{height:180px}.page h1{font-size:92px;line-height:1.2;margin:0}</style>`;
  const directory = await fixture({
    html: simpleBook(`<h1>${"A very long clipped title ".repeat(12)}</h1>`, { head })
  });
  const result = await runBrowser("verify", directory);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(`${result.stdout}\n${result.stderr}`, /overflow|clip|fixed page/i);
});

test("mobile horizontal and multi-column failures are rejected", async () => {
  const head = `<style>
    .page{width:8.5in;height:11in;overflow:hidden}.page-inner{height:11in}.text-frame{column-count:1}
    @media(max-width:600px){.page{width:800px;height:auto}.page-inner{height:auto}.text-frame{column-count:2}}
  </style>`;
  const directory = await fixture({
    html: simpleBook('<div class="text-frame"><p>Readable manuscript text on a broken mobile layout.</p></div>', { head })
  });
  const result = await runBrowser("verify", directory);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(`${result.stdout}\n${result.stderr}`, /mobile horizontal|multi-column/i);
});

test("non-allowlisted sibling fetches and unknown egress fail verification", async (t) => {
  await t.test("sibling fetch", async () => {
    const html = simpleBook('<p>Book text</p><script>fetch("/secret.txt").catch(() => {});</script>');
    const directory = await fixture({ html, files: { "secret.txt": "private" } });
    const result = await runBrowser("verify", directory);
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(`${result.stdout}\n${result.stderr}`, /blocked|allowlist|request/i);
  });

  await t.test("unknown egress", async () => {
    const html = simpleBook('<p>Book text</p><script>fetch("http" + "://127.0.0.1:9/private").catch(() => {});</script>');
    const directory = await fixture({ html });
    const result = await runBrowser("verify", directory);
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(`${result.stdout}\n${result.stderr}`, /blocked|egress|request/i);
  });
});

test("asset contexts reject traversal, symlinks, and non-GET requests", async () => {
  const directory = await fixture({ html: simpleBook("<p>Safe book</p>") });
  const manifestPath = join(directory, "book-build-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.files.push("../outside.txt");
  await writeFile(manifestPath, JSON.stringify(manifest));
  assert.throws(() => createStaticAssetContext(join(directory, "index.html")), /unsafe|relative|outside/i);

  manifest.files = ["index.html", "cover-options.html", "linked.txt"];
  await writeFile(join(directory, "real.txt"), "real");
  await symlink(join(directory, "real.txt"), join(directory, "linked.txt"));
  await writeFile(manifestPath, JSON.stringify(manifest));
  assert.throws(() => createStaticAssetContext(join(directory, "index.html")), /symbolic link/i);

  manifest.files = ["index.html", "cover-options.html"];
  await writeFile(manifestPath, JSON.stringify(manifest));
  const context = createStaticAssetContext(join(directory, "index.html"));
  const policy = browserRequestPolicy(context, "http://127.0.0.1:9999/", "http://127.0.0.1:9999", "POST");
  assert.equal(policy.allowed, false);
  assert.match(policy.reason, /non-GET/i);

  const undeclaredGoogleFont = browserRequestPolicy(
    context,
    "https://fonts.gstatic.com/s/poppins/v1/font.woff2",
    "http://127.0.0.1:9999"
  );
  assert.equal(undeclaredGoogleFont.allowed, false);

  const fontDirectory = await fixture({
    html: simpleBook('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins"><p>Book text</p>')
  });
  const fontContext = createStaticAssetContext(join(fontDirectory, "index.html"));
  const declaredGoogleFont = browserRequestPolicy(
    fontContext,
    "https://fonts.gstatic.com/s/poppins/v1/font.woff2",
    "http://127.0.0.1:9999"
  );
  assert.equal(declaredGoogleFont.allowed, false);
  allowRemoteStylesheetDependencies(
    fontContext,
    "https://fonts.googleapis.com/css2?family=Poppins",
    '@font-face{src:url("https://fonts.gstatic.com/s/poppins/v1/font.woff2") format("woff2")}'
  );
  assert.equal(browserRequestPolicy(
    fontContext,
    "https://fonts.gstatic.com/s/poppins/v1/font.woff2",
    "http://127.0.0.1:9999"
  ).allowed, true);
});

test("manifest-declared local files must exist before verification starts", async () => {
  const directory = await fixture({ html: simpleBook("<p>Book text</p>") });
  const manifestPath = join(directory, "book-build-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.files.push("missing-local.png");
  await writeFile(manifestPath, JSON.stringify(manifest));

  assert.throws(
    () => createStaticAssetContext(join(directory, "index.html")),
    /does not exist/i
  );
});

test("export rejects PDF page-count mismatches", async () => {
  const head = "<style>@page{size:letter;margin:0}.page{width:8.5in;height:22in}.page-inner{height:22in}</style>";
  const directory = await fixture({ html: simpleBook("<p>One rendered page that prints across two sheets.</p>", { head }) });
  const result = await runBrowser("export", directory);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(`${result.stdout}\n${result.stderr}`, /page count|PDF|MediaBox|fixed page|overflow/i);
});

test("failed export preserves an existing PDF and cannot overwrite HTML", async () => {
  const head = "<style>@page{size:letter;margin:0}.page{width:8.5in;height:22in}.page-inner{height:22in}</style>";
  const directory = await fixture({ html: simpleBook("<p>Oversized fixed page.</p>", { head }) });
  const pdfPath = join(directory, "book.pdf");
  await writeFile(pdfPath, "known-good-pdf");

  const failed = await runBrowser("export", directory);
  assert.notEqual(failed.status, 0);
  assert.equal(await readFile(pdfPath, "utf8"), "known-good-pdf");

  const collision = await runBrowser("export", directory, ["--pdf", join(directory, "index.html")]);
  assert.notEqual(collision.status, 0);
  assert.match(`${collision.stdout}\n${collision.stderr}`, /must not overwrite|\.pdf extension/i);
  assert.match(await readFile(join(directory, "index.html"), "utf8"), /<!doctype html>/i);
});

test("PDF inspection rejects non-Letter pages", async () => {
  const directory = await temporaryDirectory("frontend-textbooks-pdf-");
  const pdf = join(directory, "a4.pdf");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><p>PDF structure proof</p>");
    await page.pdf({ path: pdf, format: "A4" });
  } finally {
    await browser.close();
  }

  await assert.rejects(
    execFileAsync("bash", [inspectPdfScript, pdf, join(directory, "rendered")], { cwd: root, timeout: 30_000 }),
    /Letter|page size|MediaBox|Command failed/i
  );
  assert.ok((await readFile(pdf)).length > 0);
});

test("a valid contracted book verifies, exports, and renders every PDF page", async () => {
  const sourceManifest = {
    threshold: 0.9,
    totalWords: 8,
    blocks: [
      { id: "one", expectedText: "one two three four", wordCount: 4 },
      { id: "two", expectedText: "five six seven eight", wordCount: 4 }
    ]
  };
  const bookData = JSON.stringify({ sourceManifest }).replace(/</g, "\\u003c");
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    @page{size:letter;margin:0}body{margin:0}.book{display:block}.page{width:8.5in;height:11in;overflow:hidden;break-after:page}.page:last-child{break-after:auto}.page-inner{height:11in;padding:1in;box-sizing:border-box}
    @media(max-width:600px){.page{width:100%;height:auto}.page-inner{height:auto;min-height:200px}.text-frame{column-count:1}}
  </style></head><body><main class="book">
    <section class="page text-page"><div class="page-inner"><div class="text-frame"><p data-source-block-id="one">one two three four</p></div></div></section>
    <section class="page text-page"><div class="page-inner"><div class="text-frame"><p data-source-block-id="two">five six seven eight</p></div></div></section>
  </main><script type="application/json" id="book-data">${bookData}</script><script>window.__BOOK_READY=true;</script></body></html>`;
  const directory = await fixture({ html });

  const verification = await runBrowser("verify", directory);
  assert.equal(verification.status, 0, `${verification.stdout}\n${verification.stderr}`);
  const report = JSON.parse(verification.stdout);
  assert.equal(report.desktop.pages, 2);
  assert.equal(report.print.pages, 2);
  assert.equal(report.mobile.sourcePreservation.ratio, 1);
  await readFile(join(directory, "verification", "desktop-page-0001.png"));
  await readFile(join(directory, "verification", "desktop-page-0002.png"));
  await readFile(join(directory, "verification", "mobile-viewport.png"));

  const exported = await runBrowser("export", directory);
  assert.equal(exported.status, 0, `${exported.stdout}\n${exported.stderr}`);
  const exportReport = JSON.parse(exported.stdout);
  assert.equal(exportReport.pdf.pageCount, 2);

  const rendered = join(directory, "pdf-pages");
  const inspection = await execFileAsync("bash", [inspectPdfScript, join(directory, "book.pdf"), rendered], {
    cwd: root,
    timeout: 30_000
  });
  assert.match(inspection.stdout, /Pages: 2/);
  await readFile(join(rendered, "pdf-page-1.png"));
  await readFile(join(rendered, "pdf-page-2.png"));
});

test("verification reruns remove stale owned screenshots", async () => {
  const directory = await fixture({
    html: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main class="book"><section class="page"><p>First page</p></section><section class="page"><p>Second page</p></section></main></body></html>`
  });
  const first = await runBrowser("verify", directory);
  assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);
  await readFile(join(directory, "verification", "desktop-page-0002.png"));

  await writeFile(join(directory, "index.html"), simpleBook("<p>Only one page now</p>"));
  const second = await runBrowser("verify", directory);
  assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);
  await assert.rejects(readFile(join(directory, "verification", "desktop-page-0002.png")), /ENOENT/);
});

test("the scaffold output satisfies the source and allowlist verifier contract", async () => {
  const directory = await temporaryDirectory("frontend-textbooks-scaffold-");
  const outputDir = join(directory, "book");
  await mkdir(outputDir, { recursive: true });
  const configPath = join(directory, "book.json");
  const manuscriptPath = join(directory, "manuscript.md");
  await writeFile(configPath, JSON.stringify({
    title: "Verifier Contract",
    author: "Test Author",
    outputDir,
    style: "technical",
    requireDiagrams: false,
    requirePartImages: false
  }));
  await writeFile(manuscriptPath, `# Verifier Contract

## Introduction

This opening paragraph proves that scaffolded manuscript prose remains attached to its stable source block.

### A retained section

The second paragraph gives the browser paginator enough content to build and verify a real text page.`);
  await execFileAsync(process.execPath, [buildScript, configPath, manuscriptPath], { cwd: root, timeout: 30_000 });

  const verification = await runBrowser("verify", outputDir);
  assert.equal(verification.status, 0, `${verification.stdout}\n${verification.stderr}`);
  const report = JSON.parse(verification.stdout);
  assert.equal(report.desktop.sourcePreservation.ratio, 1);
  assert.equal(report.print.sourcePreservation.ratio, 1);
  assert.equal(report.mobile.sourcePreservation.ratio, 1);
});

test("an explicitly allowed flowing reader verifies and exports by print sheet count", async () => {
  const directory = await fixture({
    html: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@page{size:letter;margin:0}body{margin:0}.chapter-flow{min-height:20in;padding:1in;box-sizing:border-box;max-width:100%}</style></head><body><main class="book"><section class="chapter-flow" data-allow-flowing-prose="true"><h1>Reader</h1><p>${"Flowing prose remains readable. ".repeat(200)}</p></section></main></body></html>`
  });

  const verification = await runBrowser("verify", directory);
  assert.equal(verification.status, 0, `${verification.stdout}\n${verification.stderr}`);
  const exported = await runBrowser("export", directory);
  assert.equal(exported.status, 0, `${exported.stdout}\n${exported.stderr}`);
  const report = JSON.parse(exported.stdout);
  assert.equal(report.pdf.pageCount, report.readiness.printSheets);
  assert.ok(report.pdf.pageCount >= 2);
});

test("public shell wrappers work from an unrelated working directory", async () => {
  const directory = await fixture({ html: simpleBook("<p>Wrapper contract text.</p>") });
  const unrelated = await temporaryDirectory("frontend-textbooks-cwd-");
  const verificationDir = join(directory, "wrapper-verification");
  const pdfPath = join(directory, "wrapper.pdf");

  await execFileAsync("bash", [verifyWrapper, join(directory, "index.html"), verificationDir], {
    cwd: unrelated,
    timeout: 45_000
  });
  await readFile(join(verificationDir, "render-report.json"));

  await execFileAsync("bash", [exportWrapper, join(directory, "index.html"), pdfPath, "--no-open"], {
    cwd: unrelated,
    timeout: 45_000
  });
  assert.match((await readFile(pdfPath)).subarray(0, 5).toString(), /^%PDF-/);
});
