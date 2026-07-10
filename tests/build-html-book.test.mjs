import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { promisify } from "node:util";

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
  await mkdir(join(outputDir, "assets"), { recursive: true });
  await writeFile(join(outputDir, "assets", "cover.png"), "cover");
  await writeFile(join(outputDir, "assets", "part.png"), "part");
  const configPath = join(root, "book.json");
  const manuscriptPath = join(root, "manuscript.md");
  const config = {
    title: "Proof Book",
    author: "Test Author",
    outputDir,
    coverImage: "assets/cover.png",
    partImages: { Build: "assets/part.png" },
    requireDiagrams: false,
    ...configOverrides
  };
  await writeFile(configPath, JSON.stringify(config));
  await writeFile(manuscriptPath, manuscript);
  return { root, outputDir, configPath, manuscriptPath };
}

test("build embeds source coverage and duplicate-safe chapter mounts", async () => {
  const paths = await fixture();
  await execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath]);
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
});

test("H1 metadata stays in the denominator and maps only to an actually matching title", async () => {
  const noPartConfig = { partImages: {}, requirePartImages: false };
  const matching = await fixture(noPartConfig, `# Proof Book

## Chapter

Preserved body copy.`);
  await execFileAsync(process.execPath, [builder.pathname, matching.configPath, matching.manuscriptPath]);
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
  await execFileAsync(process.execPath, [builder.pathname, divergent.configPath, divergent.manuscriptPath]);
  const divergentHtml = await readFile(join(divergent.outputDir, "index.html"), "utf8");
  const divergentData = JSON.parse(divergentHtml.match(/<script type="application\/json" id="book-data">([^<]+)<\/script>/)[1]);
  const divergentMetadata = divergentData.sourceManifest.blocks.find((block) => block.kind === "metadata");
  const wordsWithoutMetadata = divergentData.sourceManifest.totalWords - divergentMetadata.wordCount;

  assert.ok(divergentMetadata.wordCount > 0);
  assert.ok(wordsWithoutMetadata / divergentData.sourceManifest.totalWords < divergentData.sourceManifest.threshold);
  assert.doesNotMatch(divergentHtml, new RegExp(`<h1 data-source-block-id="${divergentMetadata.id}">`));
  assert.match(divergentHtml, /<section class="page title-page"[\s\S]*?<h1>Proof Book<\/h1>/);
});

test("build manifest allowlists only generated pages and canonical local assets", async () => {
  const paths = await fixture();
  await execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath]);
  const manifest = JSON.parse(await readFile(join(paths.outputDir, "book-build-manifest.json"), "utf8"));

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.entry, "index.html");
  assert.equal(manifest.coverOptions, "cover-options.html");
  assert.deepEqual(manifest.files, ["index.html", "cover-options.html", "assets/cover.png", "assets/part.png"]);
  assert.ok(!manifest.files.some((file) => /book\.json|manuscript\.md/.test(file)));
  assert.match(manifest.source.sha256, /^[a-f0-9]{64}$/);
  assert.equal(manifest.source.threshold, 0.9);
  assert.ok(manifest.source.wordCount > 0);
  assert.ok(manifest.source.blocks.length > 0);
  assert.ok(manifest.source.blocks.every((block) => /^[a-f0-9]{64}$/.test(block.sha256)));
});

test("build manifest includes local images referenced by Markdown", async () => {
  const paths = await fixture({ partImages: {} }, `# Proof Book

## Chapter

The diagram is part of the manuscript.

![A useful diagram](assets/body.png)`);
  await writeFile(join(paths.outputDir, "assets", "body.png"), "body");

  await execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath]);
  const manifest = JSON.parse(await readFile(join(paths.outputDir, "book-build-manifest.json"), "utf8"));

  assert.ok(manifest.files.includes("assets/body.png"));
});

test("manifesting rejects local assets that traverse outside outputDir", async () => {
  const paths = await fixture({ coverImage: "../outside.png", requirePartImages: false, partImages: {} });
  await writeFile(join(paths.root, "outside.png"), "outside");

  await assert.rejects(
    execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath]),
    /outside outputDir/
  );
});

test("manifesting treats URL-style backslashes as path separators", async () => {
  const paths = await fixture({ coverImage: "..\\outside.png", requirePartImages: false, partImages: {} });
  await writeFile(join(paths.root, "outside.png"), "outside");

  await assert.rejects(
    execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath]),
    /outside outputDir/
  );
});

test("builder rejects generated-path collisions and nested entries", async (t) => {
  await t.test("cover options collision", async () => {
    const paths = await fixture({ outputHtml: "cover-options.html" });
    await assert.rejects(
      execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath]),
      /outputHtml|reserved|collision/i
    );
  });

  await t.test("nested entry", async () => {
    const paths = await fixture({ outputHtml: "nested/index.html" });
    await assert.rejects(
      execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath]),
      /outputHtml|single filename|nested/i
    );
  });

  await t.test("manuscript overwrite", async () => {
    const paths = await fixture({ outputHtml: "manuscript.html" });
    const collidingManuscript = join(paths.outputDir, "manuscript.html");
    await writeFile(collidingManuscript, "# Proof Book\n\n## Chapter\n\nKeep this source.");
    await assert.rejects(
      execFileAsync(process.execPath, [builder.pathname, paths.configPath, collidingManuscript]),
      /collides|input/i
    );
  });
});

test("builder rejects protocol-relative remote assets", async () => {
  const paths = await fixture({ coverImage: "//cdn.example.com/cover.png", partImages: {}, requirePartImages: false });
  await assert.rejects(
    execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath]),
    /protocol-relative|https/i
  );
});
