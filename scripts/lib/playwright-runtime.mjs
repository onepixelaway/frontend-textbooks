import { accessSync, constants } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

let playwrightPromise;

function packageEntry() {
  const packageDirectory = process.env.FRONTEND_TEXTBOOKS_PLAYWRIGHT_PACKAGE;
  if (!packageDirectory) return null;
  return pathToFileURL(join(resolve(packageDirectory), "index.mjs")).href;
}

async function loadPlaywright() {
  playwrightPromise ??= import(packageEntry() ?? "playwright");
  const playwright = await playwrightPromise;
  if (!playwright.chromium) throw new Error("The resolved Playwright package does not expose Chromium.");
  return playwright;
}

function executableChrome() {
  const candidate = process.env.FRONTEND_TEXTBOOKS_CHROME_EXECUTABLE;
  if (!candidate) return null;
  try {
    accessSync(candidate, constants.X_OK);
    return candidate;
  } catch {
    return null;
  }
}

function executableBundledChromium(chromium) {
  if (Object.hasOwn(process.env, "FRONTEND_TEXTBOOKS_PLAYWRIGHT_BUNDLED_EXECUTABLE")) {
    const candidate = process.env.FRONTEND_TEXTBOOKS_PLAYWRIGHT_BUNDLED_EXECUTABLE;
    if (!candidate) return null;
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      return null;
    }
  }
  try {
    const candidate = chromium.executablePath();
    accessSync(candidate, constants.X_OK);
    return candidate;
  } catch {
    return null;
  }
}

export async function launchChromium(options = {}) {
  const { chromium } = await loadPlaywright();
  const chrome = executableChrome();
  const bundled = executableBundledChromium(chromium);
  const preferSystem = process.env.FRONTEND_TEXTBOOKS_PREFER_SYSTEM_CHROME === "1";
  const bundledAttempt = bundled ? [{ executablePath: bundled }] : [];
  const systemAttempt = chrome ? [{ executablePath: chrome }] : [];
  const attempts = preferSystem ? [...systemAttempt, ...bundledAttempt] : [...bundledAttempt, ...systemAttempt];
  if (!attempts.length) {
    throw new Error("Could not launch a browser. Install Playwright Chromium or Chrome/Chromium, then retry.");
  }
  const failures = [];
  for (const override of attempts) {
    try {
      return await chromium.launch({ ...options, ...override });
    } catch (error) {
      const source = override.executablePath === bundled ? "Playwright Chromium" : `system Chrome (${override.executablePath})`;
      failures.push(`${source}: ${error.message}`);
    }
  }
  throw new Error(`Could not launch a browser. ${failures.join(" | ")}`);
}
