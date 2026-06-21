#!/usr/bin/env node
import { createServer } from "node:http";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { chromium } from "playwright";

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

  const hasBookData = await page.evaluate(() => Boolean(document.getElementById("book-data")));
  if (hasBookData) {
    await page.waitForFunction(() => window.__BOOK_READY === true || window.__BOOK_READY === false, null, { timeout: 60000 });
  }
}

async function renderedReport(page) {
  return await page.evaluate(() => {
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

    const pages = [...document.querySelectorAll(".page")];
    const frames = [...document.querySelectorAll(".text-frame")];
    const overflowFrames = frames.filter((frame) => frame.scrollHeight > frame.clientHeight + 1 || frame.scrollWidth > frame.clientWidth + 1);
    const tailOverlaps = [...document.querySelectorAll(".text-page .tail-furniture")].filter(tailFurnitureOverlaps);
    const text = document.body.innerText.replace(/\s+/g, " ").trim();
    return {
      ready: window.__BOOK_READY !== false,
      error: window.__BOOK_ERROR || null,
      pages: pages.length,
      frames: frames.length,
      overflowFrames: overflowFrames.length,
      tailOverlaps: tailOverlaps.length,
      words: text ? text.split(/\s+/).length : 0,
      customPages: [...document.querySelectorAll(".custom-feature")].map((node) => node.id || node.getAttribute("aria-label") || "custom-feature")
    };
  });
}

async function assertReady(page) {
  const report = await renderedReport(page);
  if (!report.ready) throw new Error(`Book did not become ready: ${report.error || "unknown error"}`);
  if (report.overflowFrames) throw new Error(`${report.overflowFrames} text frame(s) overflow`);
  if (report.tailOverlaps) throw new Error(`${report.tailOverlaps} tail furniture block(s) overlap text`);
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
        mobile
      };
      if (!desktop.ready || desktop.overflowFrames || desktop.tailOverlaps || !mobile.ready || mobile.overflowFrames || mobile.tailOverlaps) {
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
