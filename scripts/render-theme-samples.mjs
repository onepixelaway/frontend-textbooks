#!/usr/bin/env node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertThemeSampleOutputDirectory,
  cleanupThemeSampleStage,
  DEFAULT_THEME_SAMPLE_OUTPUT_DIRECTORY,
  resolveThemeSampleOutputDirectory,
  stageThemeSamples,
  writeThemeSampleMetadata,
  THEME_SAMPLE_PAGE_NAMES
} from "./build-theme-samples.mjs";
import { publishGeneratedTargets } from "./lib/generated-publication.mjs";
import { launchChromium } from "./lib/playwright-runtime.mjs";

export async function renderThemeSamples({
  outputDirectory = DEFAULT_THEME_SAMPLE_OUTPUT_DIRECTORY,
  launchBrowser = launchChromium
} = {}) {
  const absoluteOutput = await assertThemeSampleOutputDirectory(outputDirectory);
  const outputParent = dirname(absoluteOutput);
  await mkdir(outputParent, { recursive: true });
  const stageContainer = await mkdtemp(join(outputParent, ".theme-gallery-render-stage-"));
  const stageRoot = join(stageContainer, "next");
  let browser;
  let staged;

  try {
    staged = await stageThemeSamples({
      outputDirectory: absoluteOutput,
      stageRoot,
      preserveScreenshots: false,
      mirrorAssets: true
    });
    browser = await launchBrowser({ headless: true });
    const page = await browser.newPage({ viewport: { width: 920, height: 1200 }, deviceScaleFactor: 1 });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    for (const theme of staged.sampleThemes) {
      const directory = resolve(staged.stagedOutput, theme.id);
      await page.goto(pathToFileURL(resolve(directory, "index.html")).href, { waitUntil: "load" });
      await page.evaluate(async () => Promise.all([...document.fonts].map((font) => font.load())));
      const loaded = await page.evaluate(() => [...document.fonts].every((font) => font.status === "loaded"));
      if (!loaded) throw new Error(`${theme.id} did not load every declared font`);
      const brokenImages = await page.evaluate(() => [...document.images]
        .filter((image) => !image.complete || image.naturalWidth === 0)
        .map((image) => image.getAttribute("src")));
      if (brokenImages.length) {
        throw new Error(`${theme.id} did not load every declared image: ${brokenImages.join(", ")}`);
      }

      const pages = page.locator(".report-page");
      if (await pages.count() !== THEME_SAMPLE_PAGE_NAMES.length) {
        throw new Error(`${theme.id} did not render ${THEME_SAMPLE_PAGE_NAMES.length} report pages`);
      }
      const screenshotNames = [];
      for (const [index, name] of THEME_SAMPLE_PAGE_NAMES.entries()) {
        const filename = `${name}.png`;
        await pages.nth(index).screenshot({ path: resolve(directory, filename) });
        screenshotNames.push(filename);
      }
      const artifact = staged.themeArtifacts.get(theme.id);
      artifact.manifestTheme.screenshots = screenshotNames;
      artifact.manifestTheme.screenshotSourceHash = artifact.sourceHash;
      await writeFile(resolve(directory, "index.html"), artifact.html);
      await rm(resolve(directory, ".render-assets"), { recursive: true, force: true });
    }
    if (consoleErrors.length) throw new Error(`Sample browser errors:\n${consoleErrors.join("\n")}`);
    await writeThemeSampleMetadata(staged.stagedOutput, staged.manifestThemes);
    publishGeneratedTargets({ outputDir: outputParent, stageRoot, targets: [staged.outputTarget] });
  } finally {
    try {
      await browser?.close();
    } finally {
      await cleanupThemeSampleStage(stageContainer);
    }
  }

  return {
    outputDirectory: absoluteOutput,
    themeCount: staged.sampleThemes.length,
    pageCount: staged.sampleThemes.length * THEME_SAMPLE_PAGE_NAMES.length,
    screenshotCount: staged.sampleThemes.length * THEME_SAMPLE_PAGE_NAMES.length
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const result = await renderThemeSamples({ outputDirectory: resolveThemeSampleOutputDirectory(process.argv.slice(2)) });
  process.stdout.write(`Rendered ${result.screenshotCount} sample page screenshots in ${result.outputDirectory}\n`);
}
