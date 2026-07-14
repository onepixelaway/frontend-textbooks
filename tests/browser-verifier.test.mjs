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
import { sha256 } from "../scripts/lib/content-hash.mjs";
import { createCoverGenerationReceipt, createCoverImageRequest } from "../scripts/lib/cover-image-request.mjs";
import { writeBookProject } from "./helpers/book-project.mjs";
import { diagramDecision, frameworkFeature, numbersFeature, pngBytes, scorecardFeature } from "./helpers/fixture-assets.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(new URL("..", import.meta.url).pathname);
const browserScript = join(root, "scripts/book-browser.mjs");
const buildScript = join(root, "scripts/build-html-book.mjs");
const inspectPdfScript = join(root, "scripts/inspect-pdf.sh");
const verifyWrapper = join(root, "scripts/verify-rendered-book.sh");
const exportWrapper = join(root, "scripts/export-pdf.sh");
const localChromeExportWrapper = join(root, "scripts/export-local-chrome.sh");
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

let finalizationCoverIndex = 0;
async function ensureFinalizationCoverContract(directory) {
  const manifestPath = join(directory, "book-build-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schemaVersion === 2) return;
  finalizationCoverIndex += 1;
  const rgb = [
    20 + (finalizationCoverIndex * 37) % 180,
    20 + (finalizationCoverIndex * 71) % 180,
    20 + (finalizationCoverIndex * 103) % 180
  ];
  const asset = "fixture-finalization-cover.png";
  const bytes = pngBytes({ rgb });
  await writeFile(join(directory, asset), bytes);
  const requestHash = sha256({ directory, finalizationCoverIndex, kind: "fixture-cover-request" });
  const generationReceiptHash = sha256({ requestHash, assetHash: sha256(bytes) });
  manifest.schemaVersion = 2;
  manifest.files = [...new Set([...manifest.files, asset])];
  manifest.cover = {
    asset,
    sha256: sha256(bytes),
    requestHash,
    generationReceiptHash,
    generationId: `browser-fixture-${String(finalizationCoverIndex).padStart(8, "0")}`,
    route: "photo",
    subject: "A distinct abstract path used only by this browser finalization fixture",
    altText: "A distinct blue abstract path crosses a warm field with one clear focal point.",
    focalPoint: { x: 50, y: 50 },
    width: 1800,
    height: 1800,
    frame: { widthIn: 8.5, heightIn: 7.45 },
    effectiveDpi: 211.8,
    minimumDpi: 150
  };
  await writeFile(manifestPath, JSON.stringify(manifest));

  const style = `<style id="fixture-cover-style">
    .fixture-finalization-cover{position:relative!important;overflow:hidden!important;width:8.5in!important;height:11in!important;padding:0!important;background:#17376b!important;break-after:page!important;page-break-after:always!important}
    .fixture-finalization-cover .cover-art-frame{position:absolute!important;inset:0 0 auto!important;width:100%!important;height:7.45in!important;margin:0!important;overflow:hidden!important}
    .fixture-finalization-cover .cover-art{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;object-position:50% 50%!important}
    .fixture-finalization-cover>.page-inner{box-sizing:border-box!important;position:absolute!important;inset:auto 0 0!important;width:100%!important;height:3.55in!important;min-height:3.55in!important;padding:.6in!important;background:#17376b!important;color:white!important}
    .fixture-finalization-cover h1{margin:0!important;font:700 32pt/1.05 Arial,sans-serif!important;color:white!important;overflow-wrap:normal!important;word-break:normal!important}
    @media screen and (max-width:600px){.fixture-finalization-cover{width:100%!important;height:auto!important}.fixture-finalization-cover .cover-art-frame{position:relative!important;height:auto!important;aspect-ratio:8.5/7.45}.fixture-finalization-cover>.page-inner{position:relative!important;height:auto!important;min-height:180px!important}}
  </style>`;
  const cover = `<section class="page cover option-cover fixture-finalization-cover has-cover-art" data-cover-route="photo" data-cover-request-hash="${requestHash}"><figure class="cover-art-frame"><img class="cover-art" src="${asset}" alt="${manifest.cover.altText}"></figure><div class="page-inner"><h1>Finalization fixture</h1></div></section>`;
  let html = await readFile(join(directory, "index.html"), "utf8");
  html = html.includes("</head>") ? html.replace("</head>", `${style}</head>`) : `${style}${html}`;
  html = html.replace(/(<main\b[^>]*class=["'][^"']*\bbook\b[^"']*["'][^>]*>)/iu, `$1${cover}`);
  await writeFile(join(directory, "index.html"), html);
}

async function runBrowser(mode, directory, extra = [], { coverContract = true } = {}) {
  if (coverContract && ["export", "finalize"].includes(mode)) await ensureFinalizationCoverContract(directory);
  const args = [browserScript, mode, "--html", join(directory, "index.html"), "--wait", "ready"];
  if (mode === "verify") {
    args.push("--output-dir", join(directory, "verification"));
  } else if (mode === "finalize") {
    args.push("--output-dir", join(directory, "verification"), "--pdf", join(directory, "book.pdf"));
  } else {
    args.push("--pdf", join(directory, "book.pdf"));
  }
  args.push("--format", "json");
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

async function buildScaffold(directory, { manuscript, config = {}, plan = {}, planCover = {}, cover = {} }) {
  const project = await writeBookProject(directory, {
    manuscript,
    configOverrides: { outputDir: join(directory, "book"), ...config },
    planOverrides: plan,
    coverDecisionOverrides: planCover,
    cover
  });
  await execFileAsync(process.execPath, [buildScript, project.configPath, project.manuscriptPath, project.planPath], {
    cwd: root,
    timeout: 30_000
  });
  return project;
}

async function buildDiagramScaffold(directory) {
  const longParagraph = "The overloaded system asks a reader to hold context, compare alternatives, remember constraints, and choose a next action before the page has established a stable path. ".repeat(6).trim();
  const manuscript = `# Additive Diagrams

## Long grounding

${longParagraph}

## Three steps

A short three-step source paragraph remains verbatim after its diagram.

## Five steps

A short five-step source paragraph also remains verbatim after its diagram.`;
  const project = await writeBookProject(directory, {
    manuscript,
    configOverrides: { title: "Additive Diagrams", outputDir: join(directory, "book"), requireDiagrams: true }
  });
  const paragraphIds = project.parsed.sourceManifest.blocks.filter((block) => block.kind === "p").map((block) => block.id);
  const makeDiagram = (sourceBlockId, count) => {
    const nodes = Array.from({ length: count }, (_, index) => ({ id: `step-${index + 1}`, label: `Step ${index + 1}`, detail: `Bounded detail ${index + 1}` }));
    return diagramDecision([sourceBlockId], {
      title: `${count}-node sequence`,
      nodes,
      edges: nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id }))
    });
  };
  project.plan.classifications = paragraphIds.map((sourceBlockId) => ({
    sourceBlockId,
    role: "process",
    treatment: "diagram",
    rationale: "A bounded model-authored sequence supplements the original prose."
  }));
  project.plan.visuals.diagrams = [makeDiagram(paragraphIds[0], 2), makeDiagram(paragraphIds[1], 3), makeDiagram(paragraphIds[2], 5)];
  project.plan.exceptions = project.plan.exceptions.filter((entry) => entry.rule !== "waive-diagrams");
  await writeFile(project.planPath, JSON.stringify(project.plan));
  const request = createCoverImageRequest({ config: project.config, plan: project.plan, outputDir: project.outputDir });
  await writeFile(join(project.outputDir, "cover-image-request.json"), JSON.stringify(request));
  const generationReceipt = createCoverGenerationReceipt({ config: project.config, plan: project.plan, outputDir: project.outputDir });
  await writeFile(join(project.outputDir, "cover-generation-receipt.json"), JSON.stringify(generationReceipt));
  await execFileAsync(process.execPath, [buildScript, project.configPath, project.manuscriptPath, project.planPath], { cwd: root, timeout: 30_000 });
  return { ...project, longParagraph, paragraphIds };
}

async function buildFeatureScaffold(directory) {
  const manuscript = `# Editorial Exhibits

## A richer chapter

The manuscript compares two paths: one produces a stronger peak while the other accumulates a broader and more durable record.

Readers should examine signal, context, and weighting before deciding which path better answers the question.

The measured rates are 0.68 versus 0.59, while the best observed rates are 0.96 versus 0.91; the numerical gap matters but does not explain every qualitative difference.`;
  const project = await writeBookProject(directory, {
    manuscript,
    configOverrides: {
      title: "Editorial Exhibits",
      outputDir: join(directory, "book"),
      requireFeaturePages: true
    }
  });
  const paragraphIds = project.parsed.sourceManifest.blocks.filter((block) => block.kind === "p").map((block) => block.id);
  project.plan.visuals.featurePages = [
    scorecardFeature(paragraphIds, { anchorSourceBlockId: paragraphIds[0] }),
    frameworkFeature(paragraphIds, { anchorSourceBlockId: paragraphIds[1] }),
    numbersFeature(paragraphIds, { anchorSourceBlockId: paragraphIds[2] })
  ];
  project.plan.exceptions = project.plan.exceptions.filter((entry) => entry.rule !== "waive-feature-pages");
  await writeFile(project.planPath, JSON.stringify(project.plan));
  const request = createCoverImageRequest({ config: project.config, plan: project.plan, outputDir: project.outputDir });
  await writeFile(join(project.outputDir, "cover-image-request.json"), JSON.stringify(request));
  const generationReceipt = createCoverGenerationReceipt({ config: project.config, plan: project.plan, outputDir: project.outputDir });
  await writeFile(join(project.outputDir, "cover-generation-receipt.json"), JSON.stringify(generationReceipt));
  await execFileAsync(process.execPath, [buildScript, project.configPath, project.manuscriptPath, project.planPath], { cwd: root, timeout: 30_000 });
  return { ...project, paragraphIds };
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

test("default browser output stays compact while full evidence remains on disk", async (t) => {
  await t.test("success summary", async () => {
    const directory = await fixture({ html: simpleBook("<p>Compact successful output.</p>") });
    const result = await runBrowser("verify", directory, ["--format", "summary"]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.length < 512, result.stdout);
    assert.equal(JSON.parse(result.stdout).status, "pass");
    const report = JSON.parse(await readFile(join(directory, "verification", "render-report.json")));
    assert.equal(report.schemaVersion, 2);
  });

  await t.test("failure summary", async () => {
    const directory = await fixture({ html: simpleBook("   ") });
    const result = await runBrowser("verify", directory, ["--format", "summary"]);
    assert.notEqual(result.status, 0);
    assert.ok(`${result.stdout}${result.stderr}`.length < 2_000, `${result.stdout}\n${result.stderr}`);
    assert.equal(JSON.parse(result.stdout).status, "fail");
    const diagnostics = JSON.parse(await readFile(join(directory, "verification", "diagnostics.json")));
    assert.equal(diagnostics.status, "fail");
  });
});

test("affected profile skips print and all-page capture", async () => {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main class="book"><section class="page"><p data-source-block-id="source-one">First page.</p></section><section class="page"><p data-source-block-id="source-two">Changed second page.</p></section></main></body></html>`;
  const directory = await fixture({ html });
  const result = await runBrowser("verify", directory, ["--profile", "affected", "--source-ids", "source-two"]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.print, null);
  assert.equal(report.contactSheetPages, 1);
  await assert.rejects(readFile(join(directory, "verification", "desktop-page-0001.png")), /ENOENT/);
  await readFile(join(directory, "verification", "desktop-page-0002.png"));
  await readFile(join(directory, "verification", "desktop-viewport.png"));
  await readFile(join(directory, "verification", "contact-sheet.png"));
});

test("failed combined finalization preserves a known-good PDF", async () => {
  const head = "<style>@page{size:letter;margin:0}.page{width:8.5in;height:22in}.page-inner{height:22in}</style>";
  const directory = await fixture({ html: simpleBook("<p>Oversized finalization page.</p>", { head }) });
  const pdfPath = join(directory, "book.pdf");
  await writeFile(pdfPath, "known-good-pdf");
  const result = await runBrowser("finalize", directory);
  assert.notEqual(result.status, 0);
  assert.equal(await readFile(pdfPath, "utf8"), "known-good-pdf");
  await assert.rejects(readFile(join(directory, "verification", "pdf-report.json")), /ENOENT/);
});

test("direct PDF delivery rejects legacy manifests without the mandatory cover contract", async () => {
  const directory = await fixture({ html: simpleBook("<p>Legacy coverless book.</p>") });
  for (const mode of ["export", "finalize"]) {
    const result = await runBrowser(mode, directory, [], { coverContract: false });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /COVER_CONTRACT_REQUIRED.*schemaVersion 2/i);
  }
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

test("block-level source loss fails diagnostics even when word coverage passes", async () => {
  const retainedText = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen";
  const sourceManifest = {
    threshold: 0.9,
    totalWords: 20,
    blocks: [
      { id: "retained", text: retainedText, words: 19 },
      { id: "missing", text: "twenty", words: 1 }
    ]
  };
  const bookData = JSON.stringify({ sourceManifest }).replace(/</g, "\\u003c");
  const html = `<!doctype html><html><body><main class="book"><section class="page"><div class="page-inner"><p data-source-block-id="retained">${retainedText}</p></div></section></main><script type="application/json" id="book-data">${bookData}</script><script>window.__BOOK_READY = true;</script></body></html>`;
  const directory = await fixture({ html });

  const result = await runBrowser("verify", directory);
  assert.notEqual(result.status, 0, result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.desktop.sourcePreservation.ratio, 0.95);
  assert.equal(report.desktop.sourcePreservation.blockRatio, 0.5);
  const diagnostics = JSON.parse(await readFile(join(directory, "verification", "diagnostics.json")));
  const coverageFailures = diagnostics.items.filter((item) => item.code === "SOURCE_COVERAGE_LOW");
  assert.equal(coverageFailures.length, 3);
  assert.ok(coverageFailures.every((item) => /words 95\.0%, blocks 50\.0%/.test(item.message)));
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

test("export enables print media before the book paginates", async () => {
  const sourceManifest = {
    threshold: 0.9,
    totalWords: 4,
    blocks: [{ id: "source", expectedText: "print media pagination proof", wordCount: 4 }]
  };
  const bookData = JSON.stringify({ sourceManifest }).replace(/</g, "\\u003c");
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@page{size:letter;margin:0}body{margin:0}.page{width:8.5in;height:11in;overflow:hidden;break-after:page}.page-inner{height:11in;padding:1in;box-sizing:border-box}</style></head><body><main class="book"><section class="page"><div class="page-inner"><p data-source-block-id="source">print media pagination proof</p></div></section></main><script type="application/json" id="book-data">${bookData}</script><script>window.__BOOK_READY=matchMedia("print").matches;window.__BOOK_ERROR=window.__BOOK_READY?null:"pagination started in screen media";</script></body></html>`;
  const directory = await fixture({ html });

  const result = await runBrowser("export", directory);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(JSON.parse(result.stdout).readiness.media, "print");
});

test("feature verification captures the shared contract and legacy feature classes", async () => {
  const head = "<style>@page{size:letter;margin:0}.page{width:8.5in;height:11in;overflow:hidden}.page-inner{height:11in;padding:1in;box-sizing:border-box}@media(max-width:600px){.page{width:100%;height:auto}.page-inner{height:auto;min-height:200px}}</style>";
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${head}</head><body><main class="book">
    <section class="page" data-verify-feature><div class="page-inner"><p>Contract feature</p></div></section>
    <section class="page feature-page"><div class="page-inner"><p>General feature</p></div></section>
    <section class="page scorecard-page"><div class="page-inner"><p>Scorecard feature</p></div></section>
    <section class="page numbers-page"><div class="page-inner"><p>Numbers feature</p></div></section>
  </main></body></html>`;
  const directory = await fixture({ html });

  const result = await runBrowser("verify", directory);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  for (let index = 1; index <= 4; index += 1) {
    await readFile(join(directory, "verification", `desktop-feature-${String(index).padStart(2, "0")}.png`));
  }
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.desktop.inspectionPages.featurePages, [1, 2, 3, 4]);
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

test("a valid contracted book verifies, exports, and renders every PDF page in one finalization", async () => {
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

  const finalization = await runBrowser("finalize", directory);
  assert.equal(finalization.status, 0, `${finalization.stdout}\n${finalization.stderr}`);
  const finalized = JSON.parse(finalization.stdout);
  const report = finalized.verification;
  assert.equal(report.desktop.pages, 3);
  assert.equal(report.print.pages, 3);
  assert.equal(report.mobile.sourcePreservation.ratio, 1);
  await readFile(join(directory, "verification", "desktop-page-0001.png"));
  await readFile(join(directory, "verification", "desktop-page-0002.png"));
  await readFile(join(directory, "verification", "desktop-page-0003.png"));
  await readFile(join(directory, "verification", "mobile-viewport.png"));
  await readFile(join(directory, "verification", "contact-sheet.png"));
  const diagnostics = JSON.parse(await readFile(join(directory, "verification", "diagnostics.json")));
  assert.equal(diagnostics.status, "pass");
  assert.equal(diagnostics.items.length, 0);
  assert.doesNotMatch(JSON.stringify(report), /blockCoverage|manifestSource|expectedText/);
  assert.ok(JSON.stringify(report).length < 12_000);

  const exportReport = finalized.pdf;
  assert.equal(exportReport.pdf.pageCount, 3);

  const rendered = join(directory, "pdf-pages");
  const inspection = await execFileAsync("bash", [inspectPdfScript, join(directory, "book.pdf"), rendered], {
    cwd: root,
    timeout: 30_000
  });
  assert.match(inspection.stdout, /Pages: 3/);
  await readFile(join(rendered, "pdf-page-1.png"));
  await readFile(join(rendered, "pdf-page-2.png"));
  await readFile(join(rendered, "pdf-page-3.png"));
  await readFile(join(rendered, "contact-sheet.png"));
  await readFile(join(rendered, "selected", "cover.png"));
  await readFile(join(rendered, "selected", "final-page.png"));
  const pdfInspection = JSON.parse(await readFile(join(rendered, "pdf-inspection.json")));
  assert.equal(pdfInspection.pages, 3);
  assert.equal(pdfInspection.textPreservation.blockRatio, 1);
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
  const project = await buildScaffold(directory, {
    config: { title: "Verifier Contract", style: "technical" },
    manuscript: `# Verifier Contract

## Introduction

This opening paragraph proves that scaffolded manuscript prose remains attached to its stable source block.

### A retained section

The second paragraph gives the browser paginator enough content to build and verify a real text page.`
  });

  const verification = await runBrowser("verify", project.outputDir);
  assert.equal(verification.status, 0, `${verification.stdout}\n${verification.stderr}`);
  const report = JSON.parse(verification.stdout);
  assert.equal(report.desktop.sourcePreservation.ratio, 1);
  assert.equal(report.desktop.sourcePreservation.blockRatio, 1);
  assert.equal(report.print.sourcePreservation.ratio, 1);
  assert.equal(report.mobile.sourcePreservation.ratio, 1);
  assert.equal(report.desktop.tailLayouts[0].layout, "text-tail");
});

test("the minimal cover route remains inside the mobile viewport", async () => {
  const directory = await temporaryDirectory("frontend-textbooks-minimal-cover-");
  const title = "Field Notes on Better Systems";
  const project = await buildScaffold(directory, {
    config: { title, selectedCoverRoute: "minimal" },
    plan: { coverRoute: "minimal" },
    manuscript: `# ${title}\n\n## Chapter\n\nA short source paragraph.`
  });

  const verification = await runBrowser("verify", project.outputDir);
  assert.equal(verification.status, 0, `${verification.stdout}\n${verification.stderr}`);
  const report = JSON.parse(verification.stdout);
  assert.deepEqual(report.mobile.mobileHorizontalOverflows, []);
  assert.deepEqual(report.mobile.fixedPageOverflows, []);
});

test("every supported cover route integrates artwork across the long-title, focal-point, and contrast matrix", async (t) => {
  const cases = [
    { route: "photo", title: "The Practical Architecture of Attention, Decisions, Collaboration, and Sustainable Change in Overloaded Organizations", subtitle: "A manuscript-grounded approach for leaders and working teams", author: "Cassandra Elena Weatherford-Santos", focalPoint: { x: 7, y: 91 }, rgb: [226, 235, 244], coverBandHeight: 2.8 },
    { route: "minimal", title: "RecontextualizationWithoutCompromise", subtitle: "A resilient method for unusually constrained systems", author: "Jo A. Rivera", focalPoint: { x: 93, y: 8 }, rgb: [24, 24, 26] }
  ];

  for (const [index, item] of cases.entries()) {
    await t.test(item.route, async () => {
      const directory = await temporaryDirectory(`frontend-textbooks-cover-${item.route}-`);
      const project = await buildScaffold(directory, {
        config: {
          title: item.title,
          subtitle: item.subtitle,
          author: item.author,
          selectedCoverRoute: item.route,
          ...(item.coverBandHeight ? { coverBandHeight: item.coverBandHeight } : {})
        },
        plan: { coverRoute: item.route },
        planCover: {
          focalPoint: item.focalPoint,
          generationId: `cover-matrix-${item.route}-${String(index + 1).padStart(8, "0")}`
        },
        cover: { rgb: item.rgb },
        manuscript: `# ${item.title}\n\n## Introduction\n\nA grounded source paragraph about making complex work deliberate and humane.`
      });
      const verification = await runBrowser("verify", project.outputDir);
      assert.equal(verification.status, 0, `${verification.stdout}\n${verification.stderr}`);
      const report = JSON.parse(verification.stdout);
      for (const viewport of ["desktop", "print", "mobile"]) {
        assert.equal(report[viewport].coverLayout.route, item.route);
        assert.deepEqual(report[viewport].coverContractFailures, []);
        assert.deepEqual(report[viewport].coverLayoutFailures, []);
        assert.match(report[viewport].coverLayout.objectPosition, new RegExp(`${item.focalPoint.x}%\\s+${item.focalPoint.y}%`));
      }
      if (item.coverBandHeight) {
        const manifest = JSON.parse(await readFile(join(project.outputDir, "book-build-manifest.json")));
        assert.deepEqual(manifest.cover.frame, { widthIn: 8.5, heightIn: 8.2 });
      }
      await readFile(join(project.outputDir, "verification", "desktop-cover.png"));
      await readFile(join(project.outputDir, "verification", "mobile-cover.png"));
      await readFile(join(project.outputDir, "verification", "mobile-late-text.png"));
    });
  }
});

test("the selected-cover gate rejects actual title clipping", async () => {
  const directory = await temporaryDirectory("frontend-textbooks-clipped-cover-");
  const project = await buildScaffold(directory, {
    config: { title: "A Deliberately Clipped Cover" },
    manuscript: "# A Deliberately Clipped Cover\n\n## Chapter\n\nA source paragraph."
  });
  const html = await readFile(join(project.outputDir, "index.html"), "utf8");
  await writeFile(
    join(project.outputDir, "index.html"),
    html.replace("</head>", "<style>.cover.option-cover h1{height:12px!important;overflow:hidden!important}</style></head>")
  );
  const verification = await runBrowser("verify", project.outputDir);
  assert.notEqual(verification.status, 0, verification.stdout);
  assert.match(`${verification.stdout}\n${verification.stderr}`, /cover layout|clipped|typography band/i);
  const report = JSON.parse(await readFile(join(project.outputDir, "verification", "render-report.json")));
  assert.ok(report.desktop.coverLayoutFailures.some((failure) => failure.clipped.vertical));
});

test("chapter semantics distinguish introductions, no-part books, and real parts", async (t) => {
  await t.test("no parts", async () => {
    const directory = await temporaryDirectory("frontend-textbooks-no-parts-");
    const project = await buildScaffold(directory, {
      config: { title: "No Parts" },
      manuscript: "# No Parts\n\n## Opening\n\nOpening prose.\n\n## Main chapter\n\nMain prose."
    });
    const verification = await runBrowser("verify", project.outputDir);
    assert.equal(verification.status, 0, `${verification.stdout}\n${verification.stderr}`);
    const semantics = JSON.parse(verification.stdout).desktop.chapterSemantics;
    assert.deepEqual(semantics.map(({ kicker, partLabel, heading, ariaLabel }) => ({ kicker, partLabel, heading, ariaLabel })), [
      { kicker: "Introduction", partLabel: "", heading: "Opening", ariaLabel: "Opening" },
      { kicker: "Chapter 1", partLabel: "", heading: "Main chapter", ariaLabel: "Main chapter" }
    ]);
  });

  await t.test("real parts", async () => {
    const directory = await temporaryDirectory("frontend-textbooks-real-parts-");
    const project = await buildScaffold(directory, {
      config: { title: "Part Book", requirePartImages: false },
      manuscript: "# Part Book\n\n## Part I: Notice\n\n## First chapter\n\nPart-grounded prose."
    });
    const verification = await runBrowser("verify", project.outputDir);
    assert.equal(verification.status, 0, `${verification.stdout}\n${verification.stderr}`);
    const [semantics] = JSON.parse(verification.stdout).desktop.chapterSemantics;
    assert.equal(semantics.kicker, "Chapter 1");
    assert.equal(semantics.partLabel, "Part I");
  });
});

test("structured diagrams are additive, bounded, responsive, and PDF-preserving", async () => {
  const directory = await temporaryDirectory("frontend-textbooks-additive-diagrams-");
  const project = await buildDiagramScaffold(directory);
  const finalization = await runBrowser("finalize", project.outputDir);
  assert.equal(finalization.status, 0, `${finalization.stdout}\n${finalization.stderr}`);
  const result = JSON.parse(finalization.stdout);
  for (const viewport of ["desktop", "print", "mobile"]) {
    assert.equal(result.verification[viewport].sourcePreservation.ratio, 1);
    assert.equal(result.verification[viewport].sourcePreservation.blockRatio, 1);
    assert.deepEqual(result.verification[viewport].diagramElements.map((item) => item.nodeCount), [2, 3, 5]);
    assert.ok(result.verification[viewport].diagramElements.every((item) => !item.overflow && !item.overlappingNodes));
  }
  assert.ok(result.verification.mobile.diagramElements.every((item) => item.columns === 1));
  assert.deepEqual(result.verification.desktop.diagramElements.flatMap((item) => item.sourceBlockIds), project.paragraphIds);
  assert.ok(result.verification.desktop.diagramElements.flatMap((item) => item.nodeLabels).every((label) => label.length < project.longParagraph.length));
  assert.equal(result.pdf.pdf.textPreservation.blockRatio, 1);
  assert.equal(result.pdf.pdf.textPreservation.wordRatio, 1);
  const extracted = await execFileAsync("pdftotext", ["-raw", join(project.outputDir, "book.pdf"), "-"]);
  const normalizedPdf = extracted.stdout.replace(/\s+/gu, " ").trim();
  assert.ok(normalizedPdf.includes(project.longParagraph), "the exact long grounding paragraph must remain extractable from the PDF");
  const receipt = JSON.parse(await readFile(join(project.outputDir, "book-plan-receipt.json")));
  assert.deepEqual(receipt.diagrams.map((diagram) => diagram.sourceBlockIds[0]), project.paragraphIds);
});

test("structured scorecard, framework, and numbers pages are additive, responsive, and reviewable", async () => {
  const directory = await temporaryDirectory("frontend-textbooks-feature-pages-");
  const project = await buildFeatureScaffold(directory);
  const finalization = await runBrowser("finalize", project.outputDir);
  assert.equal(finalization.status, 0, `${finalization.stdout}\n${finalization.stderr}`);
  const result = JSON.parse(finalization.stdout);
  for (const viewport of ["desktop", "print", "mobile"]) {
    assert.equal(result.verification[viewport].sourcePreservation.ratio, 1);
    assert.equal(result.verification[viewport].sourcePreservation.blockRatio, 1);
    assert.equal(result.verification[viewport].featurePageCount, 3);
    assert.deepEqual(result.verification[viewport].fixedPageOverflows, []);
  }
  assert.deepEqual(result.verification.desktop.customPages, [
    "feature-comparison-scorecard",
    "feature-reader-framework",
    "feature-statistical-exhibit"
  ]);
  for (const viewport of ["desktop", "mobile"]) {
    for (const ordinal of ["01", "02", "03"]) {
      await readFile(join(project.outputDir, "verification", `${viewport}-feature-${ordinal}.png`));
    }
  }
  assert.ok(result.pdf.pdf.textPreservation.wordRatio >= 0.9, JSON.stringify(result.pdf.pdf.textPreservation));
  assert.ok(result.pdf.pdf.textPreservation.blockRatio >= 0.9, JSON.stringify(result.pdf.pdf.textPreservation));
  const receipt = JSON.parse(await readFile(join(project.outputDir, "book-plan-receipt.json")));
  assert.deepEqual(receipt.featurePages.map(({ kind }) => kind), ["scorecard", "framework", "numbers"]);
  assert.ok(receipt.featurePages.every((feature) => feature.chapterId === "a-richer-chapter"));
  assert.deepEqual(receipt.featurePages.flatMap((feature) => feature.sourceBlockIds).filter((id, index, ids) => ids.indexOf(id) === index), project.paragraphIds);
});

test("multi-page two- and three-column books preserve ordered source text in PDF", async (t) => {
  const paragraph = "Analytical prose stays in manuscript order while the print compositor balances columns, carries headings across page boundaries, and preserves every source block for extraction. ".repeat(5).trim();
  for (const columns of ["text-two", "text-three"]) {
    await t.test(columns, async () => {
      const directory = await temporaryDirectory(`frontend-textbooks-${columns}-pdf-`);
      const sections = Array.from({ length: 12 }, (_, index) => `### Evidence ${index + 1}\n\n${paragraph} Distinct marker ${index + 1}.`).join("\n\n");
      const project = await buildScaffold(directory, {
        config: { title: `${columns} parity`, bodyColumns: columns },
        plan: { bodyColumns: columns },
        manuscript: `# ${columns} parity\n\n## Analysis\n\n${sections}`
      });
      const finalization = await runBrowser("finalize", project.outputDir);
      assert.equal(finalization.status, 0, `${finalization.stdout}\n${finalization.stderr}`);
      const result = JSON.parse(finalization.stdout);
      assert.equal(result.verification.print.sourcePreservation.ratio, 1);
      assert.equal(result.verification.print.sourcePreservation.blockRatio, 1);
      assert.ok(result.pdf.pdf.textPreservation.wordRatio >= 0.9, JSON.stringify(result.pdf.pdf.textPreservation));
      assert.ok(result.pdf.pdf.textPreservation.blockRatio >= 0.9, JSON.stringify(result.pdf.pdf.textPreservation));
      assert.ok(["reading-order", "content-stream-order", "physical-layout"].includes(result.pdf.pdf.textPreservation.method));
    });
  }
});

test("preflight reports every independent oversized diagram in one repair packet", async () => {
  const directory = await temporaryDirectory("frontend-textbooks-diagram-preflight-");
  const project = await buildDiagramScaffold(directory);
  const htmlPath = join(project.outputDir, "index.html");
  const html = await readFile(htmlPath, "utf8");
  await writeFile(htmlPath, html.replace("</style>", ".planned-diagram{min-height:12in!important}</style>"));
  const verification = await runBrowser("verify", project.outputDir);
  assert.notEqual(verification.status, 0);
  const diagnostics = JSON.parse(await readFile(join(project.outputDir, "verification", "diagnostics.json")));
  const oversizeEvidence = diagnostics.items.filter((item) => item.code === "ATOMIC_BLOCK_OVERSIZE");
  assert.equal(new Set(oversizeEvidence.flatMap((item) => item.sourceBlockIds)).size, 3);
  const repairs = JSON.parse(await readFile(join(project.outputDir, "verification", "repair-tasks.json")));
  assert.equal(repairs.tasks.length, 3);
  assert.ok(repairs.tasks.every((task) => task.code === "ATOMIC_BLOCK_OVERSIZE"));
  assert.deepEqual(repairs.tasks.flatMap((task) => task.sourceBlockIds).sort(), [...project.paragraphIds].sort());
});

test("medium-short chapter tails use a stacked composition", async () => {
  const directory = await temporaryDirectory("frontend-textbooks-stacked-tail-");
  const paragraph = "Measured editorial prose creates enough occupied height for a structured stacked ending while preserving a natural section boundary and readable rhythm. ".repeat(3);
  const project = await buildScaffold(directory, { config: { title: "Stacked Tail" }, manuscript: `# Stacked Tail

## A measured chapter

### First idea

${paragraph}

### Second idea

${paragraph}

### Third idea

${paragraph}

### Fourth idea

${paragraph}` });

  const finalization = await runBrowser("finalize", project.outputDir);
  assert.equal(finalization.status, 0, `${finalization.stdout}\n${finalization.stderr}`);
  const finalized = JSON.parse(finalization.stdout);
  const report = finalized.verification;
  assert.equal(report.desktop.tailLayouts.at(-1)?.layout, "text-stack", JSON.stringify(report.desktop.textPageMetrics));
  assert.equal(finalized.pdf.pdf.textPreservation.blockRatio, 1);
  assert.equal(finalized.pdf.pdf.textPreservation.wordRatio, 1);
});

test("a hollow final page rebalances one or two complete blocks from the preceding page", async () => {
  const directory = await temporaryDirectory("frontend-textbooks-rebalanced-tail-");
  const paragraph = "A complete manuscript block must move as a unit so the preceding page and chapter tail form a more deliberate pair without changing source order. ".repeat(3);
  const sections = Array.from({ length: 9 }, (_, index) => `### Section ${index + 1}\n\n${paragraph}`).join("\n\n");
  const project = await buildScaffold(directory, {
    config: { title: "Rebalanced Tail", bodyColumns: "text-two" },
    plan: { bodyColumns: "text-two" },
    manuscript: `# Rebalanced Tail\n\n## Long chapter\n\n${sections}`
  });

  const verification = await runBrowser("verify", project.outputDir);
  assert.equal(verification.status, 0, `${verification.stdout}\n${verification.stderr}`);
  const report = JSON.parse(verification.stdout);
  const metrics = report.desktop.textPageMetrics;
  assert.ok(metrics.length >= 2, JSON.stringify(metrics));
  assert.ok([1, 2].includes(metrics.at(-1).rebalancedBlocks), JSON.stringify(metrics));
  assert.equal(report.desktop.sourcePreservation.ratio, 1);
  assert.equal(report.desktop.sourcePreservation.blockRatio, 1);
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
  await ensureFinalizationCoverContract(directory);
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

  const fallbackPdf = join(directory, "wrapper-local-chrome.pdf");
  await execFileAsync("bash", [localChromeExportWrapper, join(directory, "index.html"), fallbackPdf, "--no-open"], {
    cwd: unrelated,
    timeout: 45_000
  });
  assert.match((await readFile(fallbackPdf)).subarray(0, 5).toString(), /^%PDF-/);
});
