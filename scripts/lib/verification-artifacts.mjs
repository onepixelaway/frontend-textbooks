import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createImageContactSheets } from "./contact-sheet.mjs";
import { createRepairTasks, normalizeDiagnostics } from "./diagnostics.mjs";

export function cleanVerificationOutput(outputDir) {
  mkdirSync(outputDir, { recursive: true });
  const ownedOutput = /^(?:desktop|mobile)-(?:viewport|cover|late-text|text-(?:first|last)|feature-\d+|page-\d+)\.png$|^mobile-part-\d+\.png$|^contact-sheet(?:-\d+)?\.png$|^(?:render-report|diagnostics|repair-tasks|source-accounting|pdf-report|aesthetic-review|aesthetic-review-request)\.json$/;
  for (const name of readdirSync(outputDir)) {
    if (ownedOutput.test(name)) rmSync(join(outputDir, name), { force: true });
  }
}

export async function screenshotIfPresent(page, outputDir, name, selector) {
  const locator = page.locator(selector).first();
  if (await locator.count() && await locator.isVisible()) {
    await locator.screenshot({ path: join(outputDir, `${name}.png`), timeout: 8000 });
  }
}

export async function screenshotEveryPage(page, outputDir, prefix) {
  const pages = page.locator(".page");
  const count = await pages.count();
  for (let index = 0; index < count; index += 1) {
    const locator = pages.nth(index);
    if (await locator.isVisible()) {
      await locator.screenshot({ path: join(outputDir, `${prefix}-page-${String(index + 1).padStart(4, "0")}.png`), timeout: 10000 });
    }
  }
}

export async function screenshotSourcePages(page, outputDir, sourceIds) {
  if (!sourceIds.length) return;
  const pageIndexes = await page.evaluate((ids) => {
    const pages = [...document.querySelectorAll(".page")];
    return [...new Set(ids.flatMap((id) => [...document.querySelectorAll(`[data-source-block-id="${CSS.escape(id)}"]`)]
      .map((node) => pages.indexOf(node.closest(".page")))
      .filter((index) => index >= 0)))].sort((a, b) => a - b);
  }, sourceIds);
  const pages = page.locator(".page");
  for (const index of pageIndexes) {
    const locator = pages.nth(index);
    if (await locator.isVisible()) {
      await locator.screenshot({ path: join(outputDir, `desktop-page-${String(index + 1).padStart(4, "0")}.png`), timeout: 10000 });
    }
  }
}

export async function createContactSheet(browser, outputDir) {
  const outputNames = readdirSync(outputDir);
  const allImages = outputNames.filter((name) => /^desktop-page-\d+\.png$/u.test(name)).sort();
  if (!allImages.length && outputNames.includes("desktop-viewport.png")) allImages.push("desktop-viewport.png");
  return createImageContactSheets(browser, {
    inputDir: outputDir,
    imageNames: allImages,
    outputPath: join(outputDir, "contact-sheet.png")
  });
}

export function writeVerificationArtifacts(outputDir, result) {
  const diagnostics = normalizeDiagnostics(result);
  const repairs = createRepairTasks(diagnostics);
  const source = result.desktop?.sourcePreservation ?? { required: false };
  const sourceAccounting = {
    schemaVersion: 1,
    threshold: source.threshold ?? null,
    totalWords: source.totalWords ?? 0,
    viewports: Object.fromEntries(["desktop", "print", "mobile"].map((name) => [name, {
      ratio: result[name]?.sourcePreservation?.ratio ?? null,
      blockRatio: result[name]?.sourcePreservation?.blockRatio ?? null,
      coveredWords: result[name]?.sourcePreservation?.coveredWords ?? 0,
      coveredBlocks: result[name]?.sourcePreservation?.coveredBlocks ?? 0,
      failedBlockIds: result[name]?.sourcePreservation?.failedBlockIds ?? []
    }])),
    status: diagnostics.status
  };
  writeFileSync(join(outputDir, "diagnostics.json"), JSON.stringify(diagnostics, null, 2));
  writeFileSync(join(outputDir, "repair-tasks.json"), JSON.stringify(repairs, null, 2));
  writeFileSync(join(outputDir, "source-accounting.json"), JSON.stringify(sourceAccounting, null, 2));
  return { diagnostics, repairs, sourceAccounting };
}
