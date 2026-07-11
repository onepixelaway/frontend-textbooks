import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function commandResult(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 30_000,
    killSignal: "SIGKILL"
  });
}

function assertCommandCompleted(result, label) {
  if (result.error?.code === "ETIMEDOUT") throw new Error(`${label} timed out after 30 seconds`);
}

function isLetterSize(width, height) {
  const portrait = Math.abs(width - 612) <= 1 && Math.abs(height - 792) <= 1;
  const landscape = Math.abs(width - 792) <= 1 && Math.abs(height - 612) <= 1;
  return portrait || landscape;
}

function pdfStructureFromBytes(pdfPath) {
  const source = readFileSync(pdfPath).toString("latin1");
  if (!source.startsWith("%PDF-")) throw new Error("PDF output is missing the %PDF header");
  const pageCount = [...source.matchAll(/\/Type\s*\/Page\b/g)].length;
  const mediaBoxes = [...source.matchAll(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/g)]
    .map((match) => ({
      width: Number(match[3]) - Number(match[1]),
      height: Number(match[4]) - Number(match[2])
    }));
  if (pageCount <= 0) throw new Error("PDF output contains no pages");
  if (mediaBoxes.length < pageCount) {
    throw new Error("Cannot verify every PDF MediaBox without pdfinfo");
  }
  return { pageCount, pages: mediaBoxes.slice(0, pageCount), method: "pdf-bytes" };
}

function pdfStructureWithPdfinfo(pdfPath) {
  const summary = commandResult("pdfinfo", [pdfPath]);
  assertCommandCompleted(summary, "pdfinfo");
  if (summary.error?.code === "ENOENT") return null;
  if (summary.status !== 0) {
    throw new Error(`pdfinfo rejected PDF output: ${(summary.stderr || summary.stdout).trim()}`);
  }
  const pageCount = Number(summary.stdout.match(/^Pages:\s+(\d+)$/m)?.[1]);
  if (!Number.isInteger(pageCount) || pageCount <= 0) throw new Error("pdfinfo reported no PDF pages");

  const details = commandResult("pdfinfo", ["-f", "1", "-l", String(pageCount), "-box", pdfPath]);
  assertCommandCompleted(details, "pdfinfo -box");
  if (details.status !== 0) throw new Error("pdfinfo could not inspect every PDF page");
  const pageSizes = new Map();
  for (const match of details.stdout.matchAll(/^Page\s+(\d+)\s+MediaBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/gim)) {
    pageSizes.set(Number(match[1]), {
      width: Number(match[4]) - Number(match[2]),
      height: Number(match[5]) - Number(match[3])
    });
  }
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const size = pageSizes.get(index + 1);
    if (!size) throw new Error(`pdfinfo did not report a size for PDF page ${index + 1}`);
    return size;
  });
  return { pageCount, pages, method: "pdfinfo" };
}

function normalizedTokens(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("und")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function sequenceEnd(actualTokens, expectedTokens, start) {
  let actualIndex = start;
  for (const expected of expectedTokens) {
    if (actualTokens[actualIndex] === expected) {
      actualIndex += 1;
      continue;
    }
    if (expected.length < 3) return -1;
    let joined = "";
    const fragmentStart = actualIndex;
    while (actualIndex < actualTokens.length && actualTokens[actualIndex].length <= 2 && joined.length < expected.length) {
      joined += actualTokens[actualIndex];
      actualIndex += 1;
    }
    if (actualIndex === fragmentStart || joined !== expected) return -1;
  }
  return actualIndex;
}

function sequenceIndex(actualTokens, tokenInitialPositions, expectedTokens, start) {
  const positions = tokenInitialPositions.get(expectedTokens[0][0]) ?? [];
  let low = 0;
  let high = positions.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (positions[middle] < start) low = middle + 1;
    else high = middle;
  }
  for (let positionIndex = low; positionIndex < positions.length; positionIndex += 1) {
    const index = positions[positionIndex];
    if (sequenceEnd(actualTokens, expectedTokens, index) !== -1) return index;
  }
  return -1;
}

export function sourceTokenCoverage(blocks, actualText) {
  const actualTokens = normalizedTokens(actualText);
  const tokenPositions = new Map();
  actualTokens.forEach((token, index) => {
    const positions = tokenPositions.get(token[0]) ?? [];
    positions.push(index);
    tokenPositions.set(token[0], positions);
  });
  let cursor = 0;
  let covered = 0;
  let total = 0;
  for (const block of blocks) {
    const expectedTokens = normalizedTokens(block.expectedText ?? block.text);
    total += expectedTokens.length;
    if (!expectedTokens.length) continue;
    const foundAt = sequenceIndex(actualTokens, tokenPositions, expectedTokens, cursor);
    if (foundAt === -1) continue;
    covered += expectedTokens.length;
    cursor = sequenceEnd(actualTokens, expectedTokens, foundAt);
  }
  return total ? covered / total : 0;
}

export function validatePdfStructure(pdfPath, expectedPages = null, { requireText = false, sourceManifest = null } = {}) {
  const structure = pdfStructureWithPdfinfo(pdfPath) ?? pdfStructureFromBytes(pdfPath);
  if (expectedPages !== null && structure.pageCount !== expectedPages) {
    throw new Error(`PDF page count ${structure.pageCount} does not match rendered page count ${expectedPages}`);
  }
  structure.pages.forEach((page, index) => {
    if (!isLetterSize(page.width, page.height)) {
      throw new Error(`PDF page ${index + 1} MediaBox is ${page.width} x ${page.height} pt, expected Letter 612 x 792 pt`);
    }
  });
  if (requireText) {
    const extracted = commandResult("pdftotext", [pdfPath, "-"]);
    assertCommandCompleted(extracted, "pdftotext");
    if (extracted.error?.code === "ENOENT") {
      throw new Error("pdftotext is required to verify text-bearing PDFs; install Poppler and retry");
    }
    if (extracted.error) {
      throw new Error(`Could not run pdftotext: ${extracted.error.message}`);
    }
    if (!extracted.error && extracted.status !== 0) {
      throw new Error(`pdftotext rejected PDF output: ${(extracted.stderr || "unknown error").trim()}`);
    }
    if (!extracted.error && !String(extracted.stdout || "").trim()) {
      throw new Error("PDF text extraction is empty for a text-bearing book");
    }
    if (sourceManifest?.blocks?.length) {
      const ratio = sourceTokenCoverage(sourceManifest.blocks, extracted.stdout);
      const threshold = Number(sourceManifest.threshold) || 0.9;
      if (ratio < threshold) {
        throw new Error(`PDF source preservation coverage ${(ratio * 100).toFixed(1)}% is below the ${(threshold * 100).toFixed(1)}% threshold`);
      }
      structure.textPreservation = { ratio: Number(ratio.toFixed(4)), threshold };
    }
  }
  return structure;
}

export function renderPdfPages(pdfPath, outputPrefix) {
  const rendered = commandResult("pdftoppm", ["-png", pdfPath, outputPrefix]);
  assertCommandCompleted(rendered, "pdftoppm");
  if (rendered.error?.code === "ENOENT") {
    throw new Error("pdftoppm is required to render PDF pages; install Poppler and retry");
  }
  if (rendered.error) throw new Error(`Could not run pdftoppm: ${rendered.error.message}`);
  if (rendered.status !== 0) {
    throw new Error(`pdftoppm rejected PDF output: ${(rendered.stderr || rendered.stdout || "unknown error").trim()}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: node scripts/lib/pdf-structure.mjs <path-to-pdf>");
    process.exit(1);
  }
  try {
    const structure = validatePdfStructure(resolve(pdfPath));
    const renderIndex = process.argv.indexOf("--render");
    if (renderIndex !== -1) {
      const outputPrefix = process.argv[renderIndex + 1];
      if (!outputPrefix) throw new Error("--render requires an output prefix");
      renderPdfPages(resolve(pdfPath), resolve(outputPrefix));
    }
    process.stdout.write(`${structure.pageCount}\n`);
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}
