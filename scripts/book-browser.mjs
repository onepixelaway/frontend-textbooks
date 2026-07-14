#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { installPageGuards, loadBook, withServer } from "./lib/browser-runtime.mjs";
import { collectRenderedReport } from "./lib/rendered-report.mjs";
import { launchChromium } from "./lib/playwright-runtime.mjs";
import { createStaticAssetContext } from "./lib/static-assets.mjs";
import { validatePdfStructure } from "./lib/pdf-structure.mjs";
import { VERIFICATION_PROFILES, verificationProfile } from "./lib/verification-profiles.mjs";
import { cleanVerificationOutput, createContactSheet, screenshotEveryPage, screenshotIfPresent, screenshotSourcePages, writeVerificationArtifacts } from "./lib/verification-artifacts.mjs";
import { GUARD_CHECKS, REPORT_CHECKS } from "./lib/verification-checks.mjs";
import { acquirePipelineLock } from "./lib/pipeline-lock.mjs";

const SHORT_SINGLE_CHAR_LIMIT = 1300;
const LONG_FLOW_WORD_LIMIT = 1400;
const NARROW_FLOW_WORD_LIMIT = 250;
const NARROW_FLOW_MEASURE_IN = 3.75;
const FEATURE_PAGE_SELECTOR = "[data-verify-feature], .custom-feature, .feature-page, .scorecard-page, .numbers-page, .canvas-page, .model-card-page, .anatomy-page, .taxonomy-page, .loop-page";
function usage() {
  console.error(`Usage:
  node book-browser.mjs export --html <index.html> --pdf <output.pdf> [--wait networkidle|ready]
  node book-browser.mjs verify --html <index.html> --output-dir <dir> [--wait networkidle|ready]
  node book-browser.mjs finalize --html <index.html> --pdf <output.pdf> --output-dir <dir> [--format summary|json]`);
  process.exit(1);
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  if (!mode || !["export", "verify", "finalize"].includes(mode)) usage();
  const args = { mode, wait: "ready", format: "summary", profile: "full" };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) usage();
    const key = token.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) usage();
    args[key] = value;
    index += 1;
  }
  if (!args.html) usage();
  if (["export", "finalize"].includes(mode) && !args.pdf) usage();
  if (["verify", "finalize"].includes(mode) && !args["output-dir"]) usage();
  if (!["ready", "networkidle"].includes(args.wait)) usage();
  if (!["summary", "json"].includes(args.format)) usage();
  if (!Object.hasOwn(VERIFICATION_PROFILES, args.profile)) usage();
  if (mode === "finalize" && args.profile !== "full") usage();
  return args;
}

function htmlContext(htmlPath) {
  const context = createStaticAssetContext(htmlPath);
  return { ...context, htmlPath: context.entryReal };
}

async function renderedReport(page, diagnostics = {}) {
  return await page.evaluate(collectRenderedReport, {
    limits: {
      shortSingleCharLimit: SHORT_SINGLE_CHAR_LIMIT,
      longFlowWordLimit: LONG_FLOW_WORD_LIMIT,
      narrowFlowWordLimit: NARROW_FLOW_WORD_LIMIT,
      narrowFlowMeasureIn: NARROW_FLOW_MEASURE_IN
    },
    diagnostics,
    featureSelector: FEATURE_PAGE_SELECTOR
  });
}

function reportCount(report, field) {
  const value = report[field];
  if (Array.isArray(value)) return value.length;
  return Number(value) || 0;
}

function countFailure(field, message) {
  return {
    failed: (report) => reportCount(report, field) > 0,
    message: (report) => `${reportCount(report, field)} ${message}`
  };
}

const reportFailureRules = [
  {
    failed: (report) => !report.ready,
    message: (report) => `Book did not become ready: ${report.error || "unknown error"}`
  },
  {
    failed: (report) => Boolean(report.bookDataError),
    message: (report) => report.bookDataError
  },
  ...GUARD_CHECKS.map(({ field }) => ({
    failed: (report) => (report.diagnostics?.[field]?.length || 0) > 0,
    message: (report) => report.diagnostics[field][0]
  })),
  {
    failed: (report) => (report.customBookFailures?.length || 0) > 0,
    message: (report) => report.customBookFailures[0]
  },
  {
    failed: (report) => (report.sourcePreservation?.errors?.length || 0) > 0,
    message: (report) => `Invalid source preservation contract: ${report.sourcePreservation.errors[0]}`
  },
  {
    failed: (report) => report.sourcePreservation?.required && report.sourcePreservation.ratio < report.sourcePreservation.threshold,
    message: (report) => `Source preservation coverage ${(report.sourcePreservation.ratio * 100).toFixed(1)}% is below the ${(report.sourcePreservation.threshold * 100).toFixed(1)}% threshold`
  },
  {
    failed: (report) => report.sourcePreservation?.required && report.sourcePreservation.blockRatio < report.sourcePreservation.threshold,
    message: (report) => `Source block preservation coverage ${(report.sourcePreservation.blockRatio * 100).toFixed(1)}% is below the ${(report.sourcePreservation.threshold * 100).toFixed(1)}% threshold`
  },
  ...REPORT_CHECKS.slice(0, 10).map(({ field, message }) => countFailure(field, message)),
  {
    failed: (report) => report.requireDiagrams && reportCount(report, "diagramElements") === 0,
    message: () => "required diagram policy is enabled, but no diagrams or diagram-like tools were found"
  },
  ...REPORT_CHECKS.slice(10).map(({ field, message }) => countFailure(field, message))
];

function reportFailures(report) {
  return reportFailureRules
    .filter((rule) => rule.failed(report))
    .map((rule) => rule.message(report));
}

async function assertReady(page, diagnostics) {
  const report = await renderedReport(page, diagnostics);
  const failures = reportFailures(report);
  if (failures.length) throw new Error(failures[0]);
  return report;
}

function pdfOutputContext(args, context) {
  const outputPdf = resolve(args.pdf);
  if (extname(outputPdf).toLowerCase() !== ".pdf") throw new Error("PDF output path must use a .pdf extension");
  const protectedPaths = new Set([...context.allowedFiles].map((file) => resolve(context.rootReal, file)));
  if (protectedPaths.has(outputPdf)) throw new Error("PDF output path must not overwrite the HTML entry or a declared book asset");
  mkdirSync(dirname(outputPdf), { recursive: true });
  return { outputPdf, temporaryPdf: join(dirname(outputPdf), `.${basename(outputPdf)}.${randomUUID()}.tmp.pdf`) };
}

async function exportPdfInBrowser(browser, context, url, origin, args, readySession = null) {
  const { outputPdf, temporaryPdf } = pdfOutputContext(args, context);
  const page = readySession?.page ?? await browser.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: 1 });
  try {
    const diagnostics = readySession?.diagnostics ?? await installPageGuards(page, context, origin);
    let readiness = readySession?.report;
    if (!readySession) {
      await page.emulateMedia({ media: "print" });
      await loadBook(page, url, args.wait, diagnostics);
      diagnostics.manifestSource = context.manifest?.source ?? null;
      readiness = await assertReady(page, diagnostics);
    }
    const sourceManifest = await page.evaluate(() => {
      const node = document.getElementById("book-data");
      if (!node) return null;
      try {
        return JSON.parse(node.textContent || "{}").sourceManifest || null;
      } catch {
        return null;
      }
    });
    await page.pdf({
      path: temporaryPdf,
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      displayHeaderFooter: false
    });
    await assertReady(page, diagnostics);
    const pdf = validatePdfStructure(temporaryPdf, readiness.printSheets, {
      requireText: readiness.words > 0 && !readiness.imageOnly,
      sourceManifest
    });
    renameSync(temporaryPdf, outputPdf);
    return { outputPdf, bytes: statSync(outputPdf).size, readiness, pdf };
  } finally {
    rmSync(temporaryPdf, { force: true });
    await page.close();
  }
}

async function exportPdf(args) {
  const context = htmlContext(args.html);
  return await withServer(context, async (url, origin) => {
    const browser = await launchChromium();
    try {
      return await exportPdfInBrowser(browser, context, url, origin, args);
    } finally {
      await browser.close();
    }
  });
}

async function inspectViewport(browser, context, url, origin, {
  name,
  viewport,
  outputDir,
  waitMode,
  media = "screen",
  captureAllPages = true,
  sourceIds = [],
  retain = false
}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 600 });
  let keepPage = false;
  try {
    await page.emulateMedia({ media });
    const diagnostics = await installPageGuards(page, context, origin);
    await loadBook(page, url, waitMode, diagnostics);
    diagnostics.manifestSource = context.manifest?.source ?? null;
    diagnostics.expectedMobile = viewport.width < 600;
    if (media === "screen") {
      await page.screenshot({ path: join(outputDir, `${name}-viewport.png`), fullPage: false });
      if (name === "desktop" && captureAllPages) {
        await screenshotEveryPage(page, outputDir, "desktop");
      } else if (name === "desktop") {
        await screenshotSourcePages(page, outputDir, sourceIds);
      } else {
        await screenshotIfPresent(page, outputDir, `${name}-cover`, ".cover, .page");
        const textPages = page.locator(".text-page");
        const textPageCount = await textPages.count();
        if (textPageCount > 0) {
          await textPages.first().screenshot({ path: join(outputDir, `${name}-text-first.png`), timeout: 10000 });
          await textPages.last().screenshot({ path: join(outputDir, `${name}-text-last.png`), timeout: 10000 });
        }
        const dividerCount = await page.locator(".part-divider").count();
        for (let index = 0; index < dividerCount; index += 1) {
          const divider = page.locator(".part-divider").nth(index);
          if (await divider.isVisible()) {
            await divider.screenshot({ path: join(outputDir, `mobile-part-${String(index + 1).padStart(3, "0")}.png`), timeout: 10000 });
          }
        }
      }
    }

    const featureSelectors = media === "screen" ? await page.evaluate((featureSelector) => {
      return [...document.querySelectorAll(featureSelector)]
        .map((node, index) => {
          if (!node.id) node.id = `verified-feature-${index + 1}`;
          return `#${CSS.escape(node.id)}`;
        });
    }, FEATURE_PAGE_SELECTOR) : [];
    for (let index = 0; index < featureSelectors.length; index += 1) {
      await screenshotIfPresent(page, outputDir, `${name}-feature-${String(index + 1).padStart(2, "0")}`, featureSelectors[index]);
    }
    const report = await renderedReport(page, diagnostics);
    if (retain) {
      keepPage = true;
      return { report, page, diagnostics };
    }
    return report;
  } finally {
    if (!keepPage) await page.close();
  }
}

async function verifyInBrowser(browser, context, url, origin, args, { retainPrint = false } = {}) {
  const outputDir = resolve(args["output-dir"]);
  cleanVerificationOutput(outputDir);

  const profile = verificationProfile(args.profile);
  const includePrint = profile.includePrint;
  const sourceIds = String(args["source-ids"] ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  const views = await Promise.all([
    inspectViewport(browser, context, url, origin, {
      name: "desktop",
      viewport: { width: 1200, height: 1600 },
      outputDir,
      waitMode: args.wait,
      captureAllPages: profile.captureAllPages,
      sourceIds
    }),
    inspectViewport(browser, context, url, origin, {
      name: "mobile",
      viewport: { width: 390, height: 844 },
      outputDir,
      waitMode: args.wait
    }),
    ...(includePrint ? [inspectViewport(browser, context, url, origin, {
      name: "print",
      viewport: { width: 1200, height: 1600 },
      outputDir,
      waitMode: args.wait,
      media: "print",
      retain: retainPrint
    })] : [])
  ]);
  const [desktop, mobile, printView] = views;
  const printSession = retainPrint ? printView : null;
  const print = retainPrint ? printView.report : printView ?? null;
  const contactSheet = await createContactSheet(browser, outputDir);
  const result = {
    schemaVersion: 2,
    html: context.htmlPath,
    htmlBytes: statSync(context.htmlPath).size,
    screenshots: outputDir,
    contactSheet: contactSheet.primary,
    contactSheets: contactSheet.sheets,
    contactSheetPages: contactSheet.pageCount,
    desktop,
    print,
    mobile,
    failures: {
      desktop: reportFailures(desktop),
      print: print ? reportFailures(print) : [],
      mobile: reportFailures(mobile)
    }
  };
  if (result.failures.desktop.length || result.failures.print.length || result.failures.mobile.length) result.failed = true;
  const artifacts = writeVerificationArtifacts(outputDir, result);
  result.diagnosticSummary = artifacts.diagnostics.counts;
  writeFileSync(join(outputDir, "render-report.json"), JSON.stringify(result, null, 2));
  if (printSession) Object.defineProperty(result, "printSession", { value: printSession, enumerable: false });
  return result;
}

async function verifyBook(args) {
  const context = htmlContext(args.html);
  return await withServer(context, async (url, origin) => {
    const browser = await launchChromium();
    try {
      return await verifyInBrowser(browser, context, url, origin, args);
    } finally {
      await browser.close();
    }
  });
}

async function finalizeBook(args) {
  const context = htmlContext(args.html);
  return await withServer(context, async (url, origin) => {
    const browser = await launchChromium();
    try {
      const verification = await verifyInBrowser(browser, context, url, origin, args, { retainPrint: true });
      if (verification.failed) {
        await verification.printSession?.page.close();
        return { mode: "finalize", failed: true, verification };
      }
      const pdf = await exportPdfInBrowser(browser, context, url, origin, args, verification.printSession);
      writeFileSync(join(resolve(args["output-dir"]), "pdf-report.json"), JSON.stringify(pdf, null, 2));
      return { mode: "finalize", verification, pdf };
    } finally {
      await browser.close();
    }
  });
}

function conciseResult(args, result) {
  const verification = args.mode === "finalize" ? result.verification : (args.mode === "verify" ? result : null);
  const pdf = args.mode === "finalize" ? result.pdf : (args.mode === "export" ? result : null);
  const failed = Boolean(result.failed || verification?.failed);
  return {
    status: failed ? "fail" : "pass",
    mode: args.mode,
    pages: verification?.print?.pages ?? verification?.desktop?.pages ?? pdf?.pdf?.pageCount ?? 0,
    sourceCoverage: verification?.print?.sourcePreservation?.ratio ?? verification?.desktop?.sourcePreservation?.ratio ?? pdf?.readiness?.sourcePreservation?.ratio ?? null,
    sourceBlockCoverage: verification?.print?.sourcePreservation?.blockRatio ?? verification?.desktop?.sourcePreservation?.blockRatio ?? pdf?.pdf?.textPreservation?.blockRatio ?? null,
    errors: verification?.diagnosticSummary?.error ?? (failed ? 1 : 0),
    ...(verification ? { report: join(resolve(args["output-dir"]), "render-report.json") } : {}),
    ...(pdf ? { pdf: pdf.outputPdf } : {})
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const handlers = { export: exportPdf, finalize: finalizeBook, verify: verifyBook };
  const releaseLock = acquirePipelineLock(dirname(resolve(args.html)));
  try {
    const result = await handlers[args.mode](args);
    console.log(args.format === "json" ? JSON.stringify(result, null, 2) : JSON.stringify(conciseResult(args, result)));
    if (result.failed || result.verification?.failed) process.exitCode = 2;
  } finally {
    releaseLock();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    await main();
  } catch (error) {
    console.error(`Book verification failed: ${error.message}`);
    process.exitCode = 2;
  }
}
