import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

import {
  allowRemoteStylesheetDependencies,
  browserRequestPolicy,
  resolveAllowedRequest
} from "./static-assets.mjs";

const DIAGNOSTIC_LIMIT = 100;
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

export async function withServer(context, callback) {
  const assetReads = new Map();
  const server = createServer(async (req, res) => {
    if (req.method !== "GET") {
      res.writeHead(405, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
      res.end("Method not allowed");
      return;
    }
    try {
      const filePath = resolveAllowedRequest(context, req.url || "/");
      let pending = assetReads.get(filePath);
      if (!pending) {
        pending = readFile(filePath);
        assetReads.set(filePath, pending);
      }
      const content = await pending;
      res.writeHead(200, {
        "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      });
      res.end(content);
    } catch (error) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(error.message || "Not found");
    }
  });
  const port = await new Promise((resolvePort, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolvePort(server.address().port));
  });
  try {
    const origin = `http://127.0.0.1:${port}`;
    return await callback(`${origin}/`, origin);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

function uniqueMessages(values) {
  return [...new Set(values.filter(Boolean))];
}

function recordDiagnostic(diagnostics, field, value) {
  const message = String(value || "").trim();
  const entries = diagnostics[field];
  if (!message || entries.includes(message) || entries.length >= DIAGNOSTIC_LIMIT) return;
  entries.push(message);
}

export async function installPageGuards(page, context, localOrigin) {
  const diagnostics = {
    pageErrors: [],
    blockedRequests: [],
    requestFailures: [],
    httpFailures: [],
    assetFailures: [],
    readinessFailures: []
  };
  page.on("pageerror", (error) => recordDiagnostic(diagnostics, "pageErrors", error.message || String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText || "request failed";
    recordDiagnostic(diagnostics, "requestFailures", `${request.method()} ${request.url()}: ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      recordDiagnostic(diagnostics, "httpFailures", `${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const policy = browserRequestPolicy(context, request.url(), localOrigin, request.method());
    if (!policy.allowed) {
      recordDiagnostic(diagnostics, "blockedRequests", policy.reason);
      await route.abort("blockedbyclient");
      return;
    }
    if (request.resourceType() === "stylesheet" && new URL(request.url()).origin !== localOrigin) {
      try {
        const response = await route.fetch({ timeout: 8000 });
        const body = await response.text();
        allowRemoteStylesheetDependencies(context, request.url(), body);
        await route.fulfill({ response, body });
      } catch (error) {
        recordDiagnostic(diagnostics, "assetFailures", `Stylesheet failed to load: ${request.url()} (${error.message})`);
        await route.abort("failed");
      }
      return;
    }
    await route.continue();
  });
  return diagnostics;
}

export async function loadBook(page, url, waitMode, diagnostics) {
  const waitUntil = waitMode === "networkidle" ? "networkidle" : "domcontentloaded";
  await page.goto(url, { waitUntil, timeout: 45000 });
  const hasContract = await page.evaluate(() => Boolean(document.getElementById("book-data")));
  if (hasContract) {
    const initialReadiness = await page.evaluate(() => window.__BOOK_READY);
    if (initialReadiness === undefined) {
      try {
        await page.waitForFunction(() => window.__BOOK_READY === true || window.__BOOK_READY === false, null, { timeout: 8000 });
      } catch {
        recordDiagnostic(diagnostics, "readinessFailures", "Book contract exists but window.__BOOK_READY remained undefined");
      }
    }
    const readiness = await page.evaluate(() => window.__BOOK_READY);
    if (readiness === false) {
      const detail = await page.evaluate(() => window.__BOOK_ERROR || "unknown browser-side error");
      recordDiagnostic(diagnostics, "readinessFailures", `Book explicitly reported readiness false: ${detail}`);
    } else if (readiness !== true) {
      recordDiagnostic(diagnostics, "readinessFailures", "Book contract exists but readiness was not explicitly true");
    }
  }

  const assetFailures = await page.evaluate(async (timeoutMs) => {
    const failures = [];
    const bounded = async (label, operation) => {
      let timer;
      try {
        await Promise.race([
          operation(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
          })
        ]);
      } catch (error) {
        failures.push(error.message || String(error));
      } finally {
        clearTimeout(timer);
      }
    };

    if (document.fonts) {
      await bounded("Font loading", async () => {
        await document.fonts.ready;
        const failed = [];
        document.fonts.forEach((face) => {
          if (face.status === "error") failed.push(`${face.family} (${face.status})`);
        });
        if (failed.length) throw new Error(`Fonts did not load: ${failed.join(", ")}`);
      });
    }

    await Promise.all([...document.images].map(async (img, index) => {
      const label = img.currentSrc || img.getAttribute("src") || `image ${index + 1}`;
      await bounded(`Image ${label}`, async () => {
        if (!img.complete) {
          await new Promise((resolveImage, rejectImage) => {
            img.addEventListener("load", resolveImage, { once: true });
            img.addEventListener("error", () => rejectImage(new Error(`Image failed to load: ${label}`)), { once: true });
          });
        }
        await img.decode();
        if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
          throw new Error(`Image decoded with zero dimensions: ${label}`);
        }
      });
    }));

    const backgroundUrls = new Set();
    const pattern = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
    for (const node of document.querySelectorAll("*")) {
      let match;
      const value = getComputedStyle(node).backgroundImage;
      while ((match = pattern.exec(value))) {
        if (match[2]) backgroundUrls.add(new URL(match[2], document.baseURI).href);
      }
      pattern.lastIndex = 0;
    }
    await Promise.all([...backgroundUrls].map(async (asset) => {
      await bounded(`Background image ${asset}`, async () => {
        const image = new Image();
        image.src = asset;
        await image.decode();
        if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
          throw new Error(`Background image decoded with zero dimensions: ${asset}`);
        }
      });
    }));
    return failures;
  }, 8000);
  for (const failure of assetFailures) recordDiagnostic(diagnostics, "assetFailures", failure);
  await page.waitForTimeout(100);
  for (const key of Object.keys(diagnostics)) diagnostics[key] = uniqueMessages(diagnostics[key]);
  return diagnostics;
}

