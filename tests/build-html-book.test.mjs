import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { promisify } from "node:util";
import { serializeBookClientProgram } from "../scripts/lib/book-client-program.mjs";
import { writeBookProject } from "./helpers/book-project.mjs";
import { writeTestPng } from "./helpers/fixture-assets.mjs";

const execFileAsync = promisify(execFile);
const builder = new URL("../scripts/build-html-book.mjs", import.meta.url);
const temporaryDirectories = [];

after(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixture(configOverrides = {}, manuscript = `# Metadata

## Part I: Build

## Duplicate

### A section

Use [the reference](https://example.com).

## Duplicate

Finish safely.`) {
  const root = await mkdtemp(join(tmpdir(), "frontend-textbooks-build-"));
  temporaryDirectories.push(root);
  const outputDir = join(root, "output");
  const invalidCover = /^(?:https?:)?\/\//iu.test(String(configOverrides.coverImage ?? "")) || String(configOverrides.coverImage ?? "").includes("..");
  const paths = await writeBookProject(root, {
    manuscript,
    configOverrides: {
      title: "Proof Book",
      author: "Test Author",
      outputDir,
      partImages: { Build: "assets/part.png" },
      requirePartImages: /^## Part(?:\s|$)/imu.test(manuscript),
      ...configOverrides
    },
    writeRequest: !invalidCover,
    writeCover: !invalidCover
  });
  await writeTestPng(join(outputDir, "assets", "part.png"), { rgb: [166, 82, 52] });
  return paths;
}

test("build embeds source coverage and duplicate-safe chapter mounts", async () => {
  const paths = await fixture();
  await execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]);
  const html = await readFile(join(paths.outputDir, "index.html"), "utf8");
  const bookDataText = html.match(/<script type="application\/json" id="book-data">([^<]+)<\/script>/)?.[1];
  assert.ok(bookDataText);
  const data = JSON.parse(bookDataText);

  assert.deepEqual(data.chapters.map((chapter) => chapter.id), ["duplicate", "duplicate-2"]);
  assert.equal(data.sourceManifest.threshold, 0.9);
  assert.ok(data.sourceManifest.totalWords > 0);
  assert.equal(new Set(data.sourceManifest.blocks.map((block) => block.id)).size, data.sourceManifest.blocks.length);
  assert.ok(data.sourceManifest.blocks.every((block) => typeof block.expectedText === "string"));
  assert.ok(data.chapters.flatMap((chapter) => chapter.blocks).every((block) => !("expectedText" in block)));
  assert.match(html, /data-chapter-id="duplicate" data-source-block-id="[^"]+"/);
  assert.match(html, /data-chapter-id="duplicate-2" data-source-block-id="[^"]+"/);
  assert.match(html, /node\.dataset\.sourceBlockId = block\.sourceBlockId/);

  const embeddedClient = html.match(/<script>([\s\S]+)<\/script>/)?.[1];
  assert.equal(embeddedClient, serializeBookClientProgram());
  assert.doesNotMatch(html, /<script\s+src=/);

  const browserWindow = {};
  const browserDocument = {
    documentElement: { dataset: {} },
    getElementById: () => ({ textContent: bookDataText }),
    querySelector: () => null,
    querySelectorAll: () => []
  };
  Function("document", "window", "Node", embeddedClient)(browserDocument, browserWindow, { TEXT_NODE: 3 });
  assert.equal(browserWindow.__BOOK_READY, true);
});

test("H1 metadata stays in the denominator and maps only to an actually matching title", async () => {
  const noPartConfig = { partImages: {}, requirePartImages: false };
  const matching = await fixture(noPartConfig, `# Proof Book

## Chapter

Preserved body copy.`);
  await execFileAsync(process.execPath, [builder.pathname, matching.configPath, matching.manuscriptPath, matching.planPath]);
  const matchingHtml = await readFile(join(matching.outputDir, "index.html"), "utf8");
  const matchingData = JSON.parse(matchingHtml.match(/<script type="application\/json" id="book-data">([^<]+)<\/script>/)[1]);
  const matchingMetadata = matchingData.sourceManifest.blocks.find((block) => block.kind === "metadata");
  assert.ok(matchingMetadata);
  assert.match(
    matchingHtml,
    new RegExp(`<section class="page title-page"[\\s\\S]*?<h1 data-source-block-id="${matchingMetadata.id}">Proof Book<\\/h1>`)
  );

  const divergentTitle = "A Long Divergent Manuscript Title That Must Count Toward Preservation";
  const divergent = await fixture(noPartConfig, `# ${divergentTitle}

## Chapter

Short body.`);
  await execFileAsync(process.execPath, [builder.pathname, divergent.configPath, divergent.manuscriptPath, divergent.planPath]);
  const divergentHtml = await readFile(join(divergent.outputDir, "index.html"), "utf8");
  const divergentData = JSON.parse(divergentHtml.match(/<script type="application\/json" id="book-data">([^<]+)<\/script>/)[1]);
  const divergentMetadata = divergentData.sourceManifest.blocks.find((block) => block.kind === "metadata");
  const wordsWithoutMetadata = divergentData.sourceManifest.totalWords - divergentMetadata.wordCount;

  assert.ok(divergentMetadata.wordCount > 0);
  assert.ok(wordsWithoutMetadata / divergentData.sourceManifest.totalWords < divergentData.sourceManifest.threshold);
  assert.doesNotMatch(divergentHtml, new RegExp(`<h1 data-source-block-id="${divergentMetadata.id}">`));
  assert.match(divergentHtml, /<section class="page title-page"[\s\S]*?<h1>Proof Book<\/h1>/);
});

test("Opening is semantic introduction and no-part chapters invent no part label", async () => {
  const paths = await fixture({ partImages: {}, requirePartImages: false }, `# Proof Book

## Opening

Front matter prose.

## Numbered chapter

Numbered prose.`);
  await execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]);
  const html = await readFile(join(paths.outputDir, "index.html"), "utf8");
  const data = JSON.parse(html.match(/<script type="application\/json" id="book-data">([^<]+)<\/script>/)[1]);

  assert.deepEqual(data.chapters.map(({ title, number, part }) => ({ title, number, part })), [
    { title: "Opening", number: "Introduction", part: null },
    { title: "Numbered chapter", number: "1", part: null }
  ]);
  assert.doesNotMatch(html, /Chapter\s+Opening|Chapter\s+Introduction\s+Opening/iu);
  assert.match(html, /<span>Introduction<\/span>\s*<span>Opening<\/span>/u);
});

test("build manifest allowlists only generated pages and canonical local assets", async () => {
  const paths = await fixture();
  await execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]);
  const manifest = JSON.parse(await readFile(join(paths.outputDir, "book-build-manifest.json"), "utf8"));

  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.entry, "index.html");
  assert.equal(manifest.coverOptions, "cover-options.html");
  assert.deepEqual(manifest.files, ["index.html", "cover-options.html", "assets/cover.png", "assets/part.png"]);
  assert.ok(!manifest.files.some((file) => /book\.json|manuscript\.md/.test(file)));
  assert.match(manifest.source.sha256, /^[a-f0-9]{64}$/);
  assert.equal(manifest.source.threshold, 0.9);
  assert.ok(manifest.source.wordCount > 0);
  assert.ok(manifest.source.blocks.length > 0);
  assert.ok(manifest.source.blocks.every((block) => /^[a-f0-9]{64}$/.test(block.sha256)));

  const inventory = JSON.parse(await readFile(join(paths.outputDir, "source-inventory.json"), "utf8"));
  assert.deepEqual(inventory.blocks.map((block) => block.ordinal), inventory.blocks.map((_, index) => index));
  const part = inventory.blocks.find((block) => block.kind === "part");
  const chapter = inventory.blocks.find((block) => block.kind === "chapter");
  const paragraph = inventory.blocks.find((block) => block.kind === "p");
  assert.equal(part.chapterId, null);
  assert.equal(part.partId, "part-i-build");
  assert.equal(chapter.partId, "part-i-build");
  assert.equal(paragraph.chapterId, chapter.chapterId);
  assert.equal(paragraph.partId, "part-i-build");
});

test("build manifest includes local images referenced by Markdown", async () => {
  const paths = await fixture({ partImages: {} }, `# Proof Book

## Chapter

The diagram is part of the manuscript.

![A useful diagram](assets/body.png)`);
  await writeFile(join(paths.outputDir, "assets", "body.png"), "body");

  await execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]);
  const manifest = JSON.parse(await readFile(join(paths.outputDir, "book-build-manifest.json"), "utf8"));

  assert.ok(manifest.files.includes("assets/body.png"));
});

test("manifesting rejects local assets that traverse outside outputDir", async () => {
  const paths = await fixture({ coverImage: "../outside.png", requirePartImages: false, partImages: {} });
  await writeFile(join(paths.root, "outside.png"), "outside");

  await assert.rejects(
    execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]),
    /outside outputDir/
  );
});

test("manifesting treats URL-style backslashes as path separators", async () => {
  const paths = await fixture({ coverImage: "..\\outside.png", requirePartImages: false, partImages: {} });
  await writeFile(join(paths.root, "outside.png"), "outside");

  await assert.rejects(
    execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]),
    /outside outputDir/
  );
});

test("builder rejects generated-path collisions and nested entries", async (t) => {
  await t.test("cover options collision", async () => {
    const paths = await fixture({ outputHtml: "cover-options.html" });
    await assert.rejects(
      execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]),
      /outputHtml|reserved|collision/i
    );
  });

  await t.test("nested entry", async () => {
    const paths = await fixture({ outputHtml: "nested/index.html" });
    await assert.rejects(
      execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]),
      /outputHtml|single filename|nested/i
    );
  });

  await t.test("manuscript overwrite", async () => {
    const paths = await fixture({ outputHtml: "manuscript.html" });
    const collidingManuscript = join(paths.outputDir, "manuscript.html");
    await writeFile(collidingManuscript, "# Proof Book\n\n## Chapter\n\nKeep this source.");
    await assert.rejects(
      execFileAsync(process.execPath, [builder.pathname, paths.configPath, collidingManuscript, paths.planPath]),
      /collides|input/i
    );
  });

  await t.test("plan receipt overwrite", async () => {
    const paths = await fixture();
    const collidingPlan = join(paths.outputDir, "book-plan-receipt.json");
    await writeFile(collidingPlan, await readFile(paths.planPath));
    await assert.rejects(
      execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, collidingPlan]),
      /collides.*plan input/i
    );
  });
});

test("builder rejects protocol-relative remote assets", async () => {
  const paths = await fixture({ coverImage: "//cdn.example.com/cover.png", partImages: {}, requirePartImages: false });
  await assert.rejects(
    execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]),
    /LOCAL_REQUIRED|remote URL|protocol-relative|https/i
  );
});

test("theme overrides merge known validated colors into the selected preset", async () => {
  const paths = await fixture({
    partImages: {},
    requirePartImages: false,
    style: "default",
    themeOverrides: {
      heading: "#003F88",
      deck: "#006B3C",
      accent: "#009C3B",
      soft: "#F2C500",
      coverBand: "#003F88"
    }
  });
  await execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]);
  const html = await readFile(join(paths.outputDir, "index.html"), "utf8");

  assert.match(html, /--heading-ink: #003F88;/);
  assert.match(html, /--deck-ink: #006B3C;/);
  assert.match(html, /--accent: #009C3B;/);
  assert.match(html, /--soft-accent: #F2C500;/);
  assert.match(html, /--cover-band: #003F88;/);
});

test("theme overrides reject unknown keys and unsafe CSS values", async (t) => {
  await t.test("unknown key", async () => {
    const paths = await fixture({ themeOverrides: { surprise: "#123456" } });
    await assert.rejects(
      execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]),
      /themeOverrides|additional propert|surprise/i
    );
  });

  await t.test("unsafe value", async () => {
    const paths = await fixture({ themeOverrides: { accent: "red; } body { display: none" } });
    await assert.rejects(
      execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]),
      /themeOverrides|pattern|accent/i
    );
  });
});

test("selected cover route drives the final cover through the shared five-route renderer", async () => {
  const paths = await fixture({
    partImages: {},
    requirePartImages: false,
    selectedCoverRoute: "symbol"
  });
  await execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]);
  const html = await readFile(join(paths.outputDir, "index.html"), "utf8");
  const options = await readFile(join(paths.outputDir, "cover-options.html"), "utf8");

  assert.match(html, /class="page option-cover has-cover-art title-short cover route-symbol"[^>]*data-cover-route="symbol"/);
  assert.doesNotMatch(html, /class="page cover"/);
  assert.equal((options.match(/data-cover-route=/g) || []).length, 5);
  for (const route of ["type", "symbol", "photo", "minimal", "press"]) {
    assert.match(options, new RegExp(`data-cover-route="${route}"`));
  }
});

test("bullet-only chapters produce a useful opener summary", async () => {
  const paths = await fixture({
    partImages: {},
    requirePartImages: false,
    chapterOpeners: true
  }, `# Proof Book

## Checklist chapter

- First concrete action
- Second concrete action`);
  await execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]);
  const html = await readFile(join(paths.outputDir, "index.html"), "utf8");

  assert.match(html, /class="chapter-summary no-indent">First concrete action Second concrete action<\/p>/);
});
