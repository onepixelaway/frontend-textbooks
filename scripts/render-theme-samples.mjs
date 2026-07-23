#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import dribbblePairingThemes from "../themes/dribbble-pairings.mjs";
import {
  buildThemeSamples,
  DEFAULT_THEME_SAMPLE_OUTPUT_DIRECTORY,
  resolveThemeSampleOutputDirectory
} from "./build-theme-samples.mjs";
import { launchChromium } from "./lib/playwright-runtime.mjs";

const pageNames = ["cover", "control-audit", "agency-plan"];

export async function renderThemeSamples({ outputDirectory = DEFAULT_THEME_SAMPLE_OUTPUT_DIRECTORY } = {}) {
  const built = await buildThemeSamples({ outputDirectory });
  const browser = await launchChromium({ headless: true });
  const page = await browser.newPage({ viewport: { width: 920, height: 1200 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    for (const theme of dribbblePairingThemes) {
      const directory = resolve(built.outputDirectory, theme.id);
      await page.goto(pathToFileURL(resolve(directory, "index.html")).href, { waitUntil: "load" });
      await page.evaluate(async () => Promise.all([...document.fonts].map((font) => font.load())));
      const loaded = await page.evaluate(() => [...document.fonts].every((font) => font.status === "loaded"));
      if (!loaded) throw new Error(`${theme.id} did not load every declared font`);

      const pages = page.locator(".report-page");
      if (await pages.count() !== pageNames.length) throw new Error(`${theme.id} did not render three report pages`);
      for (const [index, name] of pageNames.entries()) {
        await pages.nth(index).screenshot({ path: resolve(directory, `${name}.png`) });
      }
    }
  } finally {
    await browser.close();
  }

  if (consoleErrors.length) throw new Error(`Sample browser errors:\n${consoleErrors.join("\n")}`);
  return { ...built, screenshotCount: dribbblePairingThemes.length * pageNames.length };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const result = await renderThemeSamples({ outputDirectory: resolveThemeSampleOutputDirectory(process.argv.slice(2)) });
  process.stdout.write(`Rendered ${result.screenshotCount} sample page screenshots in ${result.outputDirectory}\n`);
}
