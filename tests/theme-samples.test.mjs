import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  buildThemeSamples,
  themeSampleSourceHash,
  THEME_GALLERY_GENERATOR,
  THEME_SAMPLE_PAGE_NAMES
} from "../scripts/build-theme-samples.mjs";
import { sha256 } from "../scripts/lib/content-hash.mjs";
import { renderThemeSamples } from "../scripts/render-theme-samples.mjs";
import editorialThemes from "../themes/editorial-themes.mjs";

const execFileAsync = promisify(execFile);
const builder = new URL("../scripts/build-theme-samples.mjs", import.meta.url);
const examplesDirectory = fileURLToPath(new URL("../examples", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const committedGallery = join(examplesDirectory, "theme-gallery");
const outputDirectories = [];
const themeIds = [
  "mazius-libre",
  "regina-poppins",
  "monument-space",
  "sporting-agrandir",
  "millimetre-mondwest"
];
const promptReadyThemeIds = new Set(themeIds);
const themesById = new Map(editorialThemes.map((theme) => [theme.id, theme]));

after(async () => Promise.all(outputDirectories.map((directory) => rm(directory, { recursive: true, force: true }))));

test("theme sample builder emits three offline report pages for every selected pairing", async () => {
  const outputDirectory = await mkdtemp(join(examplesDirectory, ".theme-gallery-test-"));
  outputDirectories.push(outputDirectory);
  await execFileAsync(process.execPath, [builder.pathname, "--output-dir", outputDirectory]);
  const firstManifest = JSON.parse(await readFile(join(outputDirectory, "manifest.json"), "utf8"));
  const firstGallery = await readFile(join(outputDirectory, "index.html"), "utf8");
  assert.equal(firstManifest.generator, THEME_GALLERY_GENERATOR);
  assert.ok(firstManifest.themes.every(({ screenshots, screenshotSourceHash }) => (
    screenshots.length === 0 && screenshotSourceHash === null
  )));
  assert.doesNotMatch(firstGallery, /<img src="[^"]+\/cover\.png"/u);

  for (const theme of firstManifest.themes) {
    const html = await readFile(join(outputDirectory, theme.id, "index.html"), "utf8");
    theme.screenshots = THEME_SAMPLE_PAGE_NAMES.map((name) => `${name}.png`);
    theme.screenshotSourceHash = await themeSampleSourceHash(themesById.get(theme.id), html, theme.promptExamples);
    await Promise.all(theme.screenshots.map((name) => copyFile(
      join(committedGallery, theme.id, name),
      join(outputDirectory, theme.id, name)
    )));
  }
  await writeFile(join(outputDirectory, "manifest.json"), `${JSON.stringify(firstManifest, null, 2)}\n`);

  const staleDirectory = join(outputDirectory, "retired-theme");
  await mkdir(staleDirectory);
  await writeFile(join(staleDirectory, "index.html"), "stale gallery page");
  const existingScreenshot = Buffer.from("existing sample screenshot");
  const existingThemeDirectory = join(outputDirectory, themeIds[0]);
  await writeFile(join(existingThemeDirectory, "cover.png"), existingScreenshot);

  const result = await execFileAsync(process.execPath, [builder.pathname, "--output-dir", outputDirectory]);
  const manifest = JSON.parse(await readFile(join(outputDirectory, "manifest.json"), "utf8"));

  assert.equal(result.stderr, "");
  assert.match(result.stdout, /5 themes, 15 pages/u);
  assert.equal(manifest.generator, THEME_GALLERY_GENERATOR);
  assert.deepEqual(manifest.themes.map(({ id }) => id), themeIds);
  assert.equal(manifest.report.title, "The Deliberate Life");
  assert.equal(manifest.report.author, "Tareq Ismail");
  assert.equal((await readdir(outputDirectory)).includes("retired-theme"), false);
  assert.deepEqual(await readFile(join(outputDirectory, themeIds[0], "cover.png")), existingScreenshot);
  assert.deepEqual(await readdir(outputDirectory).then((entries) => entries.filter((entry) => themeIds.includes(entry))), themeIds.toSorted());

  for (const theme of manifest.themes) {
    const html = await readFile(join(outputDirectory, theme.id, "index.html"), "utf8");
    assert.equal((html.match(/class="report-page/gu) ?? []).length, 3, `${theme.id} must have three pages`);
    assert.match(html, /data-page="cover"/u);
    assert.match(html, /data-page="control-audit"/u);
    assert.match(html, /data-page="agency-plan"/u);
    assert.match(html, /The Deliberate Life/u);
    assert.match(html, /Tareq Ismail/u);
    assert.match(html, /@font-face/u);
    assert.match(html, new RegExp(`themes/${theme.id}/fonts`, "u"));
    assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/u);
    assert.equal(theme.pageCount, 3);
    assert.equal(
      theme.screenshotSourceHash,
      await themeSampleSourceHash(themesById.get(theme.id), html, theme.promptExamples)
    );
    assert.deepEqual(theme.screenshots, THEME_SAMPLE_PAGE_NAMES.map((name) => `${name}.png`));
    await Promise.all(theme.screenshots.map((name) => access(join(outputDirectory, theme.id, name))));
    if (promptReadyThemeIds.has(theme.id)) {
      assert.ok(theme.imagePrompt?.template);
      assert.equal(theme.promptExamples.length, 3);
      assert.match(html, /class="report-page cover-page has-cover-art route-minimal"/u);
      assert.match(html, /data-cover-route="minimal"/u);
      assert.match(html, /class="plan-hero has-plan-art"/u);
      assert.match(html, /class="plan-art"/u);
      assert.match(html, new RegExp(theme.promptExamples[1].file.replace(".", "\\."), "u"));
      for (const example of theme.promptExamples) {
        assert.ok((await readFile(join(outputDirectory, theme.id, example.path))).length > 0);
      }
    } else {
      assert.equal(theme.imagePrompt, null);
      assert.deepEqual(theme.promptExamples, []);
    }
  }

  const gallery = await readFile(join(outputDirectory, "index.html"), "utf8");
  assert.equal((gallery.match(/class="theme-card"/gu) ?? []).length, 5);
  assert.match(gallery, /Renee Fleck/u);
  assert.match(gallery, /Davide Baratta/u);

  for (const path of ["index.html", "manifest.json", ...themeIds.map((id) => `${id}/index.html`)]) {
    assert.equal(
      await readFile(join(outputDirectory, path), "utf8"),
      await readFile(join(committedGallery, path), "utf8"),
      `${path} must be regenerated and committed with its theme source`
    );
  }

  const staleManifest = JSON.parse(await readFile(join(outputDirectory, "manifest.json"), "utf8"));
  staleManifest.themes[0].screenshotSourceHash = sha256(
    await readFile(join(outputDirectory, staleManifest.themes[0].id, "index.html"), "utf8")
  );
  await writeFile(join(outputDirectory, "manifest.json"), `${JSON.stringify(staleManifest, null, 2)}\n`);
  const staleResult = await execFileAsync(process.execPath, [builder.pathname, "--output-dir", outputDirectory]);
  assert.match(staleResult.stderr, /THEME_GALLERY_SCREENSHOTS_STALE/u);
  assert.match(staleResult.stderr, new RegExp(staleManifest.themes[0].id, "u"));
  const refreshedManifest = JSON.parse(await readFile(join(outputDirectory, "manifest.json"), "utf8"));
  assert.deepEqual(refreshedManifest.themes[0].screenshots, []);
});

test("theme sample provenance changes with rendered font or artwork bytes", async () => {
  const theme = { id: "test-theme" };
  const promptExamples = [{ file: "example.png" }];
  const baseOptions = {
    fontFingerprint: () => [{ path: "fonts/example.woff2", sha256: "font-one" }],
    readAsset: async () => Buffer.from("art-one")
  };
  const base = await themeSampleSourceHash(theme, "<html></html>", promptExamples, baseOptions);
  const changedFont = await themeSampleSourceHash(theme, "<html></html>", promptExamples, {
    ...baseOptions,
    fontFingerprint: () => [{ path: "fonts/example.woff2", sha256: "font-two" }]
  });
  const changedArtwork = await themeSampleSourceHash(theme, "<html></html>", promptExamples, {
    ...baseOptions,
    readAsset: async () => Buffer.from("art-two")
  });

  assert.notEqual(changedFont, base);
  assert.notEqual(changedArtwork, base);
});

test("theme sample publication rejects broad and unrelated populated targets before mutation", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "frontend-textbooks-theme-target-"));
  outputDirectories.push(temporaryRoot);
  const unrelated = join(temporaryRoot, "unrelated-output");
  const sentinel = join(unrelated, "keep.txt");
  await mkdir(unrelated);
  await writeFile(sentinel, "keep me");

  await assert.rejects(
    buildThemeSamples({ outputDirectory: unrelated }),
    /not an owned theme gallery/u
  );
  assert.equal(await readFile(sentinel, "utf8"), "keep me");

  await assert.rejects(
    buildThemeSamples({ outputDirectory: repositoryRoot }),
    /protected.*repository|repository.*protected/u
  );
  await access(join(repositoryRoot, "package.json"));
});

test("failed theme screenshot rendering preserves the last published gallery", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "frontend-textbooks-theme-render-"));
  outputDirectories.push(outputDirectory);
  await buildThemeSamples({ outputDirectory });
  const before = await Promise.all(["index.html", "manifest.json"].map((name) => readFile(join(outputDirectory, name))));

  await assert.rejects(
    renderThemeSamples({
      outputDirectory,
      launchBrowser: async () => {
        throw new Error("injected browser failure");
      }
    }),
    /injected browser failure/u
  );

  const afterFailure = await Promise.all(["index.html", "manifest.json"].map((name) => readFile(join(outputDirectory, name))));
  assert.deepEqual(afterFailure, before);
});

test("successful theme screenshot rendering publishes every screenshot and closes the browser", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "frontend-textbooks-theme-render-success-"));
  outputDirectories.push(outputDirectory);
  let browserClosed = false;
  let evaluateCall = 0;
  const page = {
    on() {},
    async goto() {},
    async evaluate() {
      const phase = evaluateCall % 3;
      evaluateCall += 1;
      if (phase === 1) return true;
      if (phase === 2) return [];
      return undefined;
    },
    locator() {
      return {
        async count() {
          return THEME_SAMPLE_PAGE_NAMES.length;
        },
        nth(index) {
          return {
            async screenshot({ path }) {
              await writeFile(path, `screenshot-${index}`);
            }
          };
        }
      };
    }
  };

  const result = await renderThemeSamples({
    outputDirectory,
    launchBrowser: async () => ({
      async newPage() {
        return page;
      },
      async close() {
        browserClosed = true;
      }
    })
  });

  assert.equal(result.screenshotCount, themeIds.length * THEME_SAMPLE_PAGE_NAMES.length);
  assert.equal(browserClosed, true);
  const manifest = JSON.parse(await readFile(join(outputDirectory, "manifest.json"), "utf8"));
  for (const theme of manifest.themes) {
    const html = await readFile(join(outputDirectory, theme.id, "index.html"), "utf8");
    assert.deepEqual(theme.screenshots, THEME_SAMPLE_PAGE_NAMES.map((name) => `${name}.png`));
    assert.equal(
      theme.screenshotSourceHash,
      await themeSampleSourceHash(themesById.get(theme.id), html, theme.promptExamples)
    );
    await Promise.all(theme.screenshots.map((name) => access(join(outputDirectory, theme.id, name))));
    await assert.rejects(access(join(outputDirectory, theme.id, ".render-assets")), { code: "ENOENT" });
  }
});
