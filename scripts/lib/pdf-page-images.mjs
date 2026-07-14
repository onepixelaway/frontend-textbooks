import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

function escapedPattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function pagePattern(outputPrefix) {
  return new RegExp(`^${escapedPattern(basename(outputPrefix))}-(\\d+)\\.png$`, "u");
}

export function canonicalPdfPagePath(outputPrefix, page) {
  if (!Number.isInteger(page) || page < 1) throw new Error(`PDF page number must be a positive integer: ${page}`);
  return `${outputPrefix}-${page}.png`;
}

export function cleanPdfPageImages(outputPrefix) {
  const directory = dirname(outputPrefix);
  if (!existsSync(directory)) return;
  const pattern = pagePattern(outputPrefix);
  for (const name of readdirSync(directory)) {
    if (pattern.test(name)) rmSync(join(directory, name), { force: true });
  }
}

export function discoverPdfPageImages(outputPrefix) {
  const directory = dirname(outputPrefix);
  if (!existsSync(directory)) return [];
  const pattern = pagePattern(outputPrefix);
  return readdirSync(directory)
    .map((name) => {
      const match = name.match(pattern);
      return match ? { page: Number(match[1]), path: join(directory, name), name } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.page - b.page || a.name.localeCompare(b.name));
}

export function normalizePdfPageImages(outputPrefix, expectedPageCount) {
  const discovered = discoverPdfPageImages(outputPrefix);
  const byPage = new Map();
  for (const entry of discovered) {
    if (byPage.has(entry.page)) {
      throw new Error(`Rendered PDF page ${entry.page} has multiple filename variants`);
    }
    byPage.set(entry.page, entry);
  }
  const expected = Array.from({ length: expectedPageCount }, (_, index) => index + 1);
  const missing = expected.filter((page) => !byPage.has(page));
  const unexpected = [...byPage.keys()].filter((page) => page < 1 || page > expectedPageCount);
  if (missing.length || unexpected.length) {
    throw new Error(`Rendered PDF page set is incomplete (missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"})`);
  }

  const temporary = [];
  for (const page of expected) {
    const source = byPage.get(page).path;
    const target = canonicalPdfPagePath(outputPrefix, page);
    if (source === target) continue;
    const staging = `${outputPrefix}-.normalize-${randomUUID()}-${page}.png`;
    renameSync(source, staging);
    temporary.push({ staging, target });
  }
  for (const { staging, target } of temporary) renameSync(staging, target);
  return expected.map((page) => canonicalPdfPagePath(outputPrefix, page));
}
