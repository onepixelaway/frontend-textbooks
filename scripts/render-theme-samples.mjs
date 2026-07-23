#!/usr/bin/env node

import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import editorialThemes from "../themes/editorial-themes.mjs";
import {
  buildThemeSamples,
  DEFAULT_THEME_SAMPLE_OUTPUT_DIRECTORY,
  resolveThemeSampleOutputDirectory,
  THEME_SAMPLE_PAGE_NAMES
} from "./build-theme-samples.mjs";
import { publishGeneratedTargets } from "./lib/generated-publication.mjs";
import { launchChromium } from "./lib/playwright-runtime.mjs";

export async function renderThemeSamples({ outputDirectory = DEFAULT_THEME_SAMPLE_OUTPUT_DIRECTORY } = {}) {
  const built = await buildThemeSamples({ outputDirectory });
  const stageContainer = await mkdtemp(resolve(built.outputDirectory, ".theme-screenshots-stage-"));
  const stageRoot = resolve(stageContainer, "next");
  await mkdir(stageRoot);
  const screenshotTargets = [];
  let browser;

  try {
    browser = await launchChromium({ headless: true });
    const page = await browser.newPage({ viewport: { width: 920, height: 1200 }, deviceScaleFactor: 1 });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    for (const theme of editorialThemes) {
      const directory = resolve(built.outputDirectory, theme.id);
      const stagedDirectory = resolve(stageRoot, theme.id);
      await mkdir(stagedDirectory);
      await page.goto(pathToFileURL(resolve(directory, "index.html")).href, { waitUntil: "load" });
      await page.evaluate(async () => Promise.all([...document.fonts].map((font) => font.load())));
      const loaded = await page.evaluate(() => [...document.fonts].every((font) => font.status === "loaded"));
      if (!loaded) throw new Error(`${theme.id} did not load every declared font`);

      const pages = page.locator(".report-page");
      if (await pages.count() !== THEME_SAMPLE_PAGE_NAMES.length) {
        throw new Error(`${theme.id} did not render ${THEME_SAMPLE_PAGE_NAMES.length} report pages`);
      }
      for (const [index, name] of THEME_SAMPLE_PAGE_NAMES.entries()) {
        const target = `${theme.id}/${name}.png`;
        await pages.nth(index).screenshot({ path: resolve(stageRoot, target) });
        screenshotTargets.push(target);
      }
    }
    if (consoleErrors.length) throw new Error(`Sample browser errors:\n${consoleErrors.join("\n")}`);
    publishGeneratedTargets({ outputDir: built.outputDirectory, stageRoot, targets: screenshotTargets });
  } finally {
    try {
      await browser?.close();
    } finally {
      await rm(stageContainer, { recursive: true, force: true });
    }
  }

  return { ...built, screenshotCount: editorialThemes.length * THEME_SAMPLE_PAGE_NAMES.length };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const result = await renderThemeSamples({ outputDirectory: resolveThemeSampleOutputDirectory(process.argv.slice(2)) });
  process.stdout.write(`Rendered ${result.screenshotCount} sample page screenshots in ${result.outputDirectory}\n`);
}
