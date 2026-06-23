#!/usr/bin/env node
import { createServer } from "node:http";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { chromium } from "playwright";

const SHORT_SINGLE_CHAR_LIMIT = 1300;
const LONG_FLOW_WORD_LIMIT = 1400;
const NARROW_FLOW_WORD_LIMIT = 250;
const NARROW_FLOW_MEASURE_IN = 3.75;
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf"
};

function usage() {
  console.error(`Usage:
  node book-browser.mjs export --html <index.html> --pdf <output.pdf> [--wait networkidle|ready]
  node book-browser.mjs verify --html <index.html> --output-dir <dir> [--wait networkidle|ready]`);
  process.exit(1);
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  if (!mode || !["export", "verify"].includes(mode)) usage();
  const args = { mode, wait: "ready" };
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
  if (mode === "export" && !args.pdf) usage();
  if (mode === "verify" && !args["output-dir"]) usage();
  if (!["ready", "networkidle"].includes(args.wait)) usage();
  return args;
}

function htmlContext(htmlPath) {
  const html = resolve(htmlPath);
  return {
    htmlPath: html,
    serveDir: dirname(html),
    htmlFile: basename(html)
  };
}

function safeJoin(root, htmlFile, requestPath) {
  const decoded = decodeURIComponent((requestPath || "/").split("?")[0]);
  const relative = decoded === "/" ? htmlFile : decoded.replace(/^\/+/, "");
  const rootPath = resolve(root);
  const full = resolve(join(rootPath, relative));
  if (full !== rootPath && !full.startsWith(`${rootPath}/`)) {
    throw new Error("Blocked path outside serve directory");
  }
  return full;
}

async function withServer(context, callback) {
  const server = createServer((req, res) => {
    try {
      const filePath = safeJoin(context.serveDir, context.htmlFile, req.url || "/");
      const content = readFileSync(filePath);
      res.writeHead(200, { "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream" });
      res.end(content);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  });
  const port = await new Promise((resolvePort) => server.listen(0, () => resolvePort(server.address().port)));
  try {
    return await callback(`http://127.0.0.1:${port}/`);
  } finally {
    server.close();
  }
}

async function loadBook(page, url, waitMode) {
  const waitUntil = waitMode === "networkidle" ? "networkidle" : "domcontentloaded";
  await page.goto(url, { waitUntil, timeout: 45000 });
  await page.evaluate(async () => {
    await Promise.race([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, 6000))
    ]);
    await Promise.all([...document.images].map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolveImage) => {
        img.addEventListener("load", resolveImage, { once: true });
        img.addEventListener("error", resolveImage, { once: true });
      });
    }));
  });

  const shouldWaitForBookReady = await page.evaluate(() => {
    if (!document.getElementById("book-data")) return false;
    if (window.__BOOK_READY === true || window.__BOOK_READY === false) return true;
    return [...document.scripts].some((script) => script.textContent.includes("__BOOK_READY"));
  });
  if (shouldWaitForBookReady) {
    await page.waitForFunction(() => window.__BOOK_READY === true || window.__BOOK_READY === false, null, { timeout: 60000 });
  }
}

async function renderedReport(page) {
  return await page.evaluate((limits) => {
    const {
      shortSingleCharLimit,
      longFlowWordLimit,
      narrowFlowWordLimit,
      narrowFlowMeasureIn
    } = limits;

    function intersects(a, b) {
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    function tailFurnitureOverlaps(tail) {
      const page = tail.closest(".text-page");
      const frame = page?.querySelector(".text-frame");
      if (!frame) return false;
      const tailRect = tail.getBoundingClientRect();
      return [...frame.children].some((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && intersects(rect, tailRect);
      });
    }

    function normalizeAssetUrl(value) {
      const text = String(value || "").trim();
      if (!text || text === "none") return "";
      try {
        return new URL(text, document.baseURI).href;
      } catch {
        return text;
      }
    }

    function cssUrls(value) {
      const urls = [];
      const pattern = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
      let match;
      while ((match = pattern.exec(String(value || "")))) {
        const url = normalizeAssetUrl(match[2]);
        if (url) urls.push(url);
      }
      return urls;
    }

    function assetUrlsFor(root) {
      if (!root) return [];
      const urls = [];
      const nodes = [root, ...root.querySelectorAll("*")];
      for (const node of nodes) {
        if (node instanceof HTMLImageElement) {
          const url = normalizeAssetUrl(node.currentSrc || node.getAttribute("src"));
          if (url) urls.push(url);
        }
        urls.push(...cssUrls(getComputedStyle(node).backgroundImage));
      }
      return [...new Set(urls)];
    }

    function pageLabel(page, index) {
      if (!page) return "unknown page";
      return page.id || page.getAttribute("aria-label") || `page ${index + 1}`;
    }

    function explicitBoolean(value) {
      if (value === true || value === "true") return true;
      if (value === false || value === "false") return false;
      return null;
    }

    function embeddedBookData() {
      const node = document.getElementById("book-data");
      if (!node) return {};
      try {
        return JSON.parse(node.textContent || "{}");
      } catch {
        return {};
      }
    }

    function requiresPartDividerImages(coverAssetUrls) {
      const policyNode = document.querySelector("[data-require-part-images]");
      const attrPolicy = explicitBoolean(policyNode?.dataset.requirePartImages);
      if (attrPolicy !== null) return attrPolicy;

      const dataPolicy = explicitBoolean(embeddedBookData().requirePartImages);
      if (dataPolicy !== null) return dataPolicy;

      return coverAssetUrls.size > 0;
    }

    function requiresDiagrams() {
      const policyNode = document.querySelector("[data-require-diagrams]");
      const attrPolicy = explicitBoolean(policyNode?.dataset.requireDiagrams);
      if (attrPolicy !== null) return attrPolicy;

      const dataPolicy = explicitBoolean(embeddedBookData().requireDiagrams);
      if (dataPolicy !== null) return dataPolicy;

      return false;
    }

    function normalizeText(value) {
      return String(value || "")
        .replace(/\s+/g, " ")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .trim();
    }

    function wordCountText(value) {
      const text = normalizeText(value);
      return text ? text.split(/\s+/).length : 0;
    }

    function allowsFlowingProse(node) {
      return Boolean(node?.closest?.("[data-allow-flowing-prose='true'], [data-plain-reader='true']"));
    }

    function measurePxPerIn() {
      const probe = document.createElement("div");
      probe.style.position = "absolute";
      probe.style.left = "-1000px";
      probe.style.top = "0";
      probe.style.width = "1in";
      probe.style.height = "1px";
      document.body.appendChild(probe);
      const width = probe.getBoundingClientRect().width || 96;
      probe.remove();
      return width;
    }

    function chapterFlowSectionsFor() {
      const pxPerIn = measurePxPerIn();
      return [...document.querySelectorAll(".chapter-flow")].map((flow, index) => {
        const rect = flow.getBoundingClientRect();
        const styles = getComputedStyle(flow);
        const paddingX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
        const contentWidthPx = Math.max(0, rect.width - paddingX);
        return {
          section: flow.id || flow.getAttribute("aria-label") || `chapter-flow ${index + 1}`,
          className: flow.className,
          words: wordCountText(flow.innerText || flow.textContent),
          contentWidthIn: Number((contentWidthPx / pxPerIn).toFixed(2)),
          allowFlowingProse: allowsFlowingProse(flow)
        };
      });
    }

    function frameText(frame) {
      return normalizeText(frame?.textContent || "");
    }

    function hasRichFrameContent(frame) {
      return Boolean(frame?.querySelector("figure, table, .diagram-card, .comparison-diagram, .callout, .span-all"));
    }

    function repeatedOpeningExcerptsFor(pages) {
      const repeats = [];
      pages.forEach((page, index) => {
        if (!page.classList.contains("spread-right")) return;
        const nextTextPage = pages.slice(index + 1).find((candidate) => candidate.classList.contains("text-page"));
        if (!nextTextPage) return;
        const nextText = normalizeText(nextTextPage.innerText);
        const paragraphs = [...page.querySelectorAll(".spread-columns p, .opening-excerpt p")]
          .filter((node) => !node.closest("blockquote"))
          .map((node) => normalizeText(node.innerText))
          .filter((text) => text.length >= 120);
        for (const paragraph of paragraphs) {
          if (nextText.includes(paragraph)) {
            repeats.push({
              spread: pageLabel(page, index),
              body: pageLabel(nextTextPage, pages.indexOf(nextTextPage)),
              text: paragraph.slice(0, 160)
            });
          }
        }
      });
      return repeats;
    }

    function isAllowedOpeningPage(page) {
      return page.dataset.allowOpeningSpread === "true" ||
        page.dataset.allowOpeningPage === "true" ||
        page.classList.contains("allow-opening-spread") ||
        page.classList.contains("allow-opening-page");
    }

    function unrequestedOpeningPagesFor(pages) {
      return [...document.querySelectorAll(".editorial-spread, .spread-left, .spread-right, .chapter-opener")]
        .filter((page) => !isAllowedOpeningPage(page))
        .map((page) => ({
          page: pageLabel(page, pages.indexOf(page)),
          className: page.className
        }));
    }

    function shortTwoColumnPagesFor(pages) {
      return pages
        .filter((page) => page.classList.contains("text-page") && page.classList.contains("text-two") && !page.classList.contains("text-short-single"))
        .map((page, index) => {
          const frame = page.querySelector(".text-frame");
          return {
            page: pageLabel(page, index),
            chars: frameText(frame).length,
            className: page.className,
            hasRichContent: hasRichFrameContent(frame)
          };
        })
        .filter((item) => item.chars > 0 && item.chars <= shortSingleCharLimit && !item.hasRichContent);
    }

    function gridTrackCount(trackList) {
      const text = String(trackList || "").trim();
      if (!text || text === "none") return 0;
      return text.split(/\s+/).filter(Boolean).length;
    }

    function isSparseRowLayout(grid) {
      return grid.classList.contains("sparse-item-rows") ||
        grid.classList.contains("sparse-rows") ||
        grid.classList.contains("tool-rows") ||
        grid.classList.contains("canvas-rows");
    }

    function sparseItemColumnGridsFor(pages) {
      return [...document.querySelectorAll(".canvas-grid, .tool-grid, .feature-grid, .feature-columns, .taxonomy-grid")]
        .map((grid) => {
          const items = [...grid.children]
            .filter((child) => child instanceof HTMLElement && normalizeText(child.innerText).length);
          const itemChars = items.map((item) => normalizeText(item.innerText).length);
          const totalChars = itemChars.reduce((sum, chars) => sum + chars, 0);
          const page = grid.closest(".page");
          return {
            page: pageLabel(page, pages.indexOf(page)),
            className: grid.className,
            items: items.length,
            columns: gridTrackCount(getComputedStyle(grid).gridTemplateColumns),
            totalChars,
            averageChars: items.length ? Math.round(totalChars / items.length) : 0,
            isSparseRows: isSparseRowLayout(grid)
          };
        })
        .filter((item) => item.items >= 4 &&
          item.items <= 6 &&
          item.columns >= 4 &&
          item.totalChars > 0 &&
          item.totalChars <= 1400 &&
          item.averageChars <= 260 &&
          !item.isSparseRows);
    }

    function diagramElementsFor(pages) {
      const diagramTerms = /\b(diagram|map|matrix|taxonomy|anatomy|system|process|workflow|framework|canvas|loop|timeline|flow|comparison|decision)\b/i;
      const candidates = [
        ...document.querySelectorAll(".diagram-page, .anatomy-page, .taxonomy-page, .loop-page, .canvas-page, .process-page, .system-map, .matrix, .comparison-diagram, .diagram-card, .generated-diagram, .canvas-grid, .framework-grid, .process-map"),
        ...document.querySelectorAll("figure")
      ];
      const unique = [...new Set(candidates)].filter((node) => {
        if (!(node instanceof HTMLElement)) return false;
        const page = node.closest(".page");
        if (!page || page.classList.contains("cover") || page.classList.contains("part-divider") || page.classList.contains("option-cover")) return false;
        const descriptor = [
          node.className,
          node.getAttribute("aria-label"),
          node.querySelector("figcaption")?.textContent,
          node.querySelector("title")?.textContent
        ].join(" ");
        return diagramTerms.test(descriptor) || Boolean(node.querySelector("svg"));
      });
      return unique.map((node) => {
        const page = node.closest(".page");
        return {
          page: pageLabel(page, pages.indexOf(page)),
          className: node.className || node.tagName.toLowerCase(),
          label: normalizeText(node.getAttribute("aria-label") || node.querySelector("figcaption")?.textContent || node.querySelector("title")?.textContent || pageLabel(page, pages.indexOf(page))).slice(0, 160)
        };
      });
    }

    const pages = [...document.querySelectorAll(".page")];
    const frames = [...document.querySelectorAll(".text-frame")];
    const overflowFrames = frames.filter((frame) => frame.scrollHeight > frame.clientHeight + 1 || frame.scrollWidth > frame.clientWidth + 1);
    const tailOverlaps = [...document.querySelectorAll(".text-page .tail-furniture")].filter(tailFurnitureOverlaps);
    const missingTocTargets = [...document.querySelectorAll("[data-toc-page-for]")]
      .map((node) => {
        const target = node.dataset.tocPageFor || "";
        return {
          target,
          text: node.textContent.trim(),
          label: normalizeText(node.closest("li")?.innerText || target)
        };
      })
      .filter((item) => !item.text || !document.getElementById(item.target));
    const continuationMarks = [...document.querySelectorAll(".continuation-mark")].map((node) => ({
      text: node.textContent.trim(),
      page: pageLabel(node.closest(".page"), pages.indexOf(node.closest(".page")))
    }));
    const cover = document.querySelector(".page.cover, .cover");
    const coverAssetUrls = new Set(assetUrlsFor(cover));
    const coverAssetReuses = [];
    pages.forEach((page, index) => {
      if (page.classList.contains("cover") || page.classList.contains("option-cover")) return;
      for (const asset of assetUrlsFor(page)) {
        if (coverAssetUrls.has(asset)) {
          coverAssetReuses.push({ page: pageLabel(page, index), asset });
        }
      }
    });
    const partDividers = [...document.querySelectorAll(".part-divider")];
    const textOnlyPartDividers = [];
    const duplicatePartDividerAssets = [];
    const partAssetOwners = new Map();
    const requirePartImages = requiresPartDividerImages(coverAssetUrls);
    partDividers.forEach((part, index) => {
      const assets = assetUrlsFor(part);
      if (requirePartImages && !assets.length) textOnlyPartDividers.push(pageLabel(part, pages.indexOf(part)));
      for (const asset of assets) {
        const owner = partAssetOwners.get(asset);
        const label = pageLabel(part, pages.indexOf(part));
        if (owner && owner !== label) {
          duplicatePartDividerAssets.push({ asset, first: owner, second: label });
        } else {
          partAssetOwners.set(asset, label);
        }
      }
    });
    const repeatedOpeningExcerpts = repeatedOpeningExcerptsFor(pages);
    const unrequestedOpeningPages = unrequestedOpeningPagesFor(pages);
    const shortTwoColumnPages = shortTwoColumnPagesFor(pages);
    const sparseItemColumnGrids = sparseItemColumnGridsFor(pages);
    const chapterFlowSections = chapterFlowSectionsFor();
    const unallowedChapterFlows = chapterFlowSections.filter((section) => !section.allowFlowingProse);
    const unallowedChapterFlowWords = unallowedChapterFlows.reduce((sum, section) => sum + section.words, 0);
    const missingMeasuredTextPages = !frames.length && unallowedChapterFlowWords >= longFlowWordLimit
      ? [{ sections: unallowedChapterFlows.length, words: unallowedChapterFlowWords }]
      : [];
    const unmeasuredChapterFlows = chapterFlowSections.filter((section) =>
      !section.allowFlowingProse && section.words >= longFlowWordLimit);
    const narrowChapterFlows = chapterFlowSections.filter((section) =>
      !section.allowFlowingProse &&
      section.words >= narrowFlowWordLimit &&
      section.contentWidthIn > 0 &&
      section.contentWidthIn < narrowFlowMeasureIn);
    const diagramElements = diagramElementsFor(pages);
    const requireDiagrams = requiresDiagrams();
    const text = document.body.innerText.replace(/\s+/g, " ").trim();
    return {
      ready: window.__BOOK_READY !== false,
      error: window.__BOOK_ERROR || null,
      pages: pages.length,
      frames: frames.length,
      overflowFrames: overflowFrames.length,
      tailOverlaps: tailOverlaps.length,
      missingTocTargets,
      continuationMarks,
      coverAssetReuses,
      textOnlyPartDividers,
      duplicatePartDividerAssets,
      requirePartImages,
      requireDiagrams,
      diagramElements,
      diagramCount: diagramElements.length,
      repeatedOpeningExcerpts,
      unrequestedOpeningPages,
      shortTwoColumnPages,
      sparseItemColumnGrids,
      chapterFlows: chapterFlowSections.length,
      chapterFlowWords: chapterFlowSections.reduce((sum, section) => sum + section.words, 0),
      missingMeasuredTextPages,
      unmeasuredChapterFlows,
      narrowChapterFlows,
      words: text ? text.split(/\s+/).length : 0,
      customPages: [...document.querySelectorAll(".custom-feature")].map((node) => node.id || node.getAttribute("aria-label") || "custom-feature")
    };
  }, {
    shortSingleCharLimit: SHORT_SINGLE_CHAR_LIMIT,
    longFlowWordLimit: LONG_FLOW_WORD_LIMIT,
    narrowFlowWordLimit: NARROW_FLOW_WORD_LIMIT,
    narrowFlowMeasureIn: NARROW_FLOW_MEASURE_IN
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
  countFailure("overflowFrames", "text frame(s) overflow"),
  countFailure("tailOverlaps", "tail furniture block(s) overlap text"),
  countFailure("missingTocTargets", "table-of-contents page reference(s) are missing or blank"),
  countFailure("continuationMarks", "continuation marker(s) are visible in text-page titles"),
  countFailure("coverAssetReuses", "interior page asset(s) reuse the cover image"),
  countFailure("textOnlyPartDividers", "part divider(s) are missing generated image assets"),
  countFailure("duplicatePartDividerAssets", "duplicated part-divider image asset(s)"),
  {
    failed: (report) => report.requireDiagrams && reportCount(report, "diagramElements") === 0,
    message: () => "required diagram policy is enabled, but no diagrams or diagram-like tools were found"
  },
  countFailure("repeatedOpeningExcerpts", "opening spread excerpt(s) repeat on the following body page"),
  countFailure("unrequestedOpeningPages", "unrequested opening page(s)"),
  countFailure("shortTwoColumnPages", "short text page(s) should use text-short-single instead of sparse two-column layout"),
  countFailure("sparseItemColumnGrids", "sparse item grid(s) should use sparse-item-rows instead of skinny columns"),
  countFailure("missingMeasuredTextPages", "book(s) have substantial unmeasured chapter-flow prose but no measured text pages"),
  countFailure("unmeasuredChapterFlows", "long unmeasured chapter-flow section(s); use .page.text-page pagination or mark intentional plain-reader flow with data-allow-flowing-prose"),
  countFailure("narrowChapterFlows", "chapter-flow section(s) have accidentally narrow text measures")
];

function reportFailures(report) {
  return reportFailureRules
    .filter((rule) => rule.failed(report))
    .map((rule) => rule.message(report));
}

async function assertReady(page) {
  const report = await renderedReport(page);
  const failures = reportFailures(report);
  if (failures.length) throw new Error(failures[0]);
  return report;
}

async function screenshotIfPresent(page, outputDir, name, selector) {
  const locator = page.locator(selector).first();
  if (await locator.count()) {
    await locator.screenshot({ path: join(outputDir, `${name}.png`) });
  }
}

async function exportPdf(args) {
  const context = htmlContext(args.html);
  const outputPdf = resolve(args.pdf);
  mkdirSync(dirname(outputPdf), { recursive: true });

  return await withServer(context, async (url) => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: 1 });
    try {
      await loadBook(page, url, args.wait);
      await page.emulateMedia({ media: "print" });
      const readiness = await assertReady(page);
      await page.pdf({
        path: outputPdf,
        format: "Letter",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
        displayHeaderFooter: false
      });
      return { outputPdf, bytes: statSync(outputPdf).size, readiness };
    } finally {
      await browser.close();
    }
  });
}

async function inspectViewport(browser, url, name, viewport, outputDir, waitMode) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 600 });
  try {
    await loadBook(page, url, waitMode);
    const report = await renderedReport(page);
    await page.screenshot({ path: join(outputDir, `${name}-viewport.png`), fullPage: false });
    await screenshotIfPresent(page, outputDir, `${name}-cover`, ".cover, .page");
    await screenshotIfPresent(page, outputDir, `${name}-text-page`, ".text-page");

    const featureSelectors = await page.evaluate(() => {
      return [...document.querySelectorAll(".custom-feature, .canvas-page, .model-card-page, .anatomy-page, .taxonomy-page, .loop-page")]
        .slice(0, 8)
        .map((node, index) => {
          if (!node.id) node.id = `verified-feature-${index + 1}`;
          return `#${CSS.escape(node.id)}`;
        });
    });
    for (let index = 0; index < featureSelectors.length; index += 1) {
      await screenshotIfPresent(page, outputDir, `${name}-feature-${String(index + 1).padStart(2, "0")}`, featureSelectors[index]);
    }
    return report;
  } finally {
    await page.close();
  }
}

async function verifyBook(args) {
  const context = htmlContext(args.html);
  const outputDir = resolve(args["output-dir"]);
  mkdirSync(outputDir, { recursive: true });

  return await withServer(context, async (url) => {
    const browser = await chromium.launch();
    try {
      const [desktop, mobile] = await Promise.all([
        inspectViewport(browser, url, "desktop", { width: 1200, height: 1600 }, outputDir, args.wait),
        inspectViewport(browser, url, "mobile", { width: 390, height: 844 }, outputDir, args.wait)
      ]);
      const result = {
        html: context.htmlPath,
        htmlBytes: statSync(context.htmlPath).size,
        screenshots: outputDir,
        desktop,
        mobile,
        failures: {
          desktop: reportFailures(desktop),
          mobile: reportFailures(mobile)
        }
      };
      if (result.failures.desktop.length || result.failures.mobile.length) {
        result.failed = true;
      }
      writeFileSync(join(outputDir, "render-report.json"), JSON.stringify(result, null, 2));
      return result;
    } finally {
      await browser.close();
    }
  });
}

const args = parseArgs(process.argv.slice(2));
const result = args.mode === "export" ? await exportPdf(args) : await verifyBook(args);
console.log(JSON.stringify(result, null, 2));
if (result.failed) process.exit(2);
