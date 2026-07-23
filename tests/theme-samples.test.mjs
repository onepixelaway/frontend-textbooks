import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const builder = new URL("../scripts/build-theme-samples.mjs", import.meta.url);
const examplesDirectory = fileURLToPath(new URL("../examples", import.meta.url));
const committedGallery = join(examplesDirectory, "theme-gallery");
const outputDirectories = [];
const themeIds = [
  "mazius-libre",
  "regina-poppins",
  "monument-space",
  "sporting-agrandir",
  "millimetre-mondwest"
];

after(async () => Promise.all(outputDirectories.map((directory) => rm(directory, { recursive: true, force: true }))));

test("theme sample builder emits three offline report pages for every selected pairing", async () => {
  const outputDirectory = await mkdtemp(join(examplesDirectory, ".theme-gallery-test-"));
  outputDirectories.push(outputDirectory);
  const staleDirectory = join(outputDirectory, "retired-theme");
  await mkdir(staleDirectory);
  await writeFile(join(staleDirectory, "index.html"), "stale gallery page");
  const existingScreenshot = Buffer.from("existing sample screenshot");
  const existingThemeDirectory = join(outputDirectory, themeIds[0]);
  await mkdir(existingThemeDirectory);
  await writeFile(join(existingThemeDirectory, "cover.png"), existingScreenshot);

  const result = await execFileAsync(process.execPath, [builder.pathname, "--output-dir", outputDirectory]);
  const manifest = JSON.parse(await readFile(join(outputDirectory, "manifest.json"), "utf8"));

  assert.equal(result.stderr, "");
  assert.match(result.stdout, /5 themes, 15 pages/u);
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
    assert.equal(theme.imagePrompt, null);
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
});
