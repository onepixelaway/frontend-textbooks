import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { cleanPdfPageImages, normalizePdfPageImages } from "./pdf-page-images.mjs";

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
    let joined = "";
    const fragmentStart = actualIndex;
    while (actualIndex < actualTokens.length && joined.length < expected.length) {
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

export function sourceBlockCoverage(blocks, actualText) {
  const actualTokens = normalizedTokens(actualText);
  const tokenPositions = new Map();
  actualTokens.forEach((token, index) => {
    const positions = tokenPositions.get(token[0]) ?? [];
    positions.push(index);
    tokenPositions.set(token[0], positions);
  });
  let cursor = 0;
  let matchedWords = 0;
  let totalWords = 0;
  let matchedBlocks = 0;
  let totalBlocks = 0;
  const missingBlockIds = [];
  for (const [index, block] of blocks.entries()) {
    const expectedTokens = normalizedTokens(block.expectedText ?? block.text);
    totalWords += expectedTokens.length;
    if (!expectedTokens.length) continue;
    totalBlocks += 1;
    const foundAt = sequenceIndex(actualTokens, tokenPositions, expectedTokens, cursor);
    if (foundAt === -1) {
      missingBlockIds.push(String(block.id ?? `block-${index + 1}`));
      continue;
    }
    matchedBlocks += 1;
    matchedWords += expectedTokens.length;
    cursor = sequenceEnd(actualTokens, expectedTokens, foundAt);
  }
  return {
    blockRatio: totalBlocks ? Number((matchedBlocks / totalBlocks).toFixed(4)) : 0,
    wordRatio: totalWords ? Number((matchedWords / totalWords).toFixed(4)) : 0,
    matchedBlocks,
    totalBlocks,
    matchedWords,
    totalWords,
    missingBlockIds
  };
}

export function sourceTokenCoverage(blocks, actualText) {
  return sourceBlockCoverage(blocks, actualText).wordRatio;
}

export function sourceBlockPresence(blocks, actualText) {
  const actualTokens = normalizedTokens(actualText);
  const tokenPositions = new Map();
  actualTokens.forEach((token, index) => {
    const positions = tokenPositions.get(token[0]) ?? [];
    positions.push(index);
    tokenPositions.set(token[0], positions);
  });
  let matchedWords = 0;
  let totalWords = 0;
  let matchedBlocks = 0;
  let totalBlocks = 0;
  const missingBlockIds = [];
  for (const [index, block] of blocks.entries()) {
    const expectedTokens = normalizedTokens(block.expectedText ?? block.text);
    totalWords += expectedTokens.length;
    if (!expectedTokens.length) continue;
    totalBlocks += 1;
    if (sequenceIndex(actualTokens, tokenPositions, expectedTokens, 0) === -1) {
      missingBlockIds.push(String(block.id ?? `block-${index + 1}`));
      continue;
    }
    matchedBlocks += 1;
    matchedWords += expectedTokens.length;
  }
  return {
    blockRatio: totalBlocks ? Number((matchedBlocks / totalBlocks).toFixed(4)) : 0,
    wordRatio: totalWords ? Number((matchedWords / totalWords).toFixed(4)) : 0,
    matchedBlocks,
    totalBlocks,
    matchedWords,
    totalWords,
    missingBlockIds
  };
}

function coverageScore(coverage) {
  return [Math.min(coverage.blockRatio, coverage.wordRatio), coverage.blockRatio + coverage.wordRatio];
}

function strongerCoverage(left, right) {
  const leftScore = coverageScore(left.coverage);
  const rightScore = coverageScore(right.coverage);
  return leftScore[0] !== rightScore[0] ? leftScore[0] > rightScore[0] : leftScore[1] > rightScore[1];
}

function missingBlockEvidence(blocks, ids, sourceTopology) {
  const blocksById = new Map(blocks.map((block, index) => [String(block.id ?? `block-${index + 1}`), block]));
  const pagesById = new Map((sourceTopology ?? []).map((item) => [String(item.id), item.pages ?? []]));
  return ids.slice(0, 20).map((id) => ({
    id,
    expectedPages: pagesById.get(id) ?? [],
    snippet: String(blocksById.get(id)?.expectedText ?? blocksById.get(id)?.text ?? "").replace(/\s+/gu, " ").trim().slice(0, 180)
  }));
}

export function evaluatePdfTextCandidates(blocks, candidates, threshold = 0.9, sourceTopology = []) {
  const evaluated = candidates
    .filter((candidate) => String(candidate.text || "").trim())
    .map((candidate) => ({
      method: candidate.method,
      coverage: sourceBlockCoverage(blocks, candidate.text),
      presence: sourceBlockPresence(blocks, candidate.text)
    }));
  if (!evaluated.length) throw new Error("PDF text extraction produced no nonempty candidates");
  let best = evaluated[0];
  for (const candidate of evaluated.slice(1)) {
    if (strongerCoverage(candidate, best)) best = candidate;
  }
  let bestPresence = evaluated[0];
  for (const candidate of evaluated.slice(1)) {
    if (strongerCoverage({ coverage: candidate.presence }, { coverage: bestPresence.presence })) bestPresence = candidate;
  }
  const passes = best.coverage.blockRatio >= threshold && best.coverage.wordRatio >= threshold;
  const textIsPresent = bestPresence.presence.blockRatio >= threshold && bestPresence.presence.wordRatio >= threshold;
  const code = passes ? null : (textIsPresent ? "PDF_READING_ORDER_MISMATCH" : "PDF_SOURCE_PRESERVATION_LOW");
  return {
    status: passes ? "pass" : "fail",
    code,
    method: best.method,
    ratio: best.coverage.wordRatio,
    threshold,
    ...best.coverage,
    lexicalPresence: bestPresence.presence,
    candidates: evaluated.map((candidate) => ({
      method: candidate.method,
      blockRatio: candidate.coverage.blockRatio,
      wordRatio: candidate.coverage.wordRatio,
      presenceBlockRatio: candidate.presence.blockRatio,
      presenceWordRatio: candidate.presence.wordRatio,
      missingBlockIds: candidate.coverage.missingBlockIds.slice(0, 100)
    })),
    missingBlocks: missingBlockEvidence(blocks, best.coverage.missingBlockIds, sourceTopology)
  };
}

function extractPdfTextCandidates(pdfPath) {
  const modes = [
    { method: "reading-order", args: [pdfPath, "-"] },
    { method: "content-stream-order", args: ["-raw", pdfPath, "-"] },
    { method: "physical-layout", args: ["-layout", pdfPath, "-"] }
  ];
  return modes.map(({ method, args }) => {
    const extracted = commandResult("pdftotext", args);
    assertCommandCompleted(extracted, `pdftotext (${method})`);
    if (extracted.error?.code === "ENOENT") {
      throw new Error("pdftotext is required to verify text-bearing PDFs; install Poppler and retry");
    }
    if (extracted.error) throw new Error(`Could not run pdftotext (${method}): ${extracted.error.message}`);
    if (extracted.status !== 0) {
      throw new Error(`pdftotext (${method}) rejected PDF output: ${(extracted.stderr || "unknown error").trim()}`);
    }
    return { method, text: extracted.stdout };
  });
}

function textPreservationError(structure, preservation) {
  const percentages = `blocks ${(preservation.blockRatio * 100).toFixed(1)}%, words ${(preservation.wordRatio * 100).toFixed(1)}%`;
  const missing = preservation.missingBlocks.slice(0, 5).map((block) => `${block.id}${block.expectedPages.length ? ` (expected page${block.expectedPages.length === 1 ? "" : "s"} ${block.expectedPages.join(", ")})` : ""}: ${block.snippet}`).join(" | ");
  const reason = preservation.code === "PDF_READING_ORDER_MISMATCH"
    ? `PDF text is lexically present but no supported extraction mode preserves manuscript order (${percentages})`
    : `PDF source preservation is below the ${(preservation.threshold * 100).toFixed(1)}% threshold (${percentages})`;
  const error = new Error(`${preservation.code}: ${reason}${missing ? `. Missing-order evidence: ${missing}` : ""}`);
  error.code = preservation.code;
  error.report = { ...structure, status: "fail", textPreservation: preservation };
  return error;
}

export function validatePdfStructure(pdfPath, expectedPages = null, { requireText = false, sourceManifest = null, sourceTopology = [] } = {}) {
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
    const candidates = extractPdfTextCandidates(pdfPath);
    if (!candidates.some((candidate) => String(candidate.text || "").trim())) {
      throw new Error("PDF text extraction is empty for a text-bearing book");
    }
    if (sourceManifest?.blocks?.length) {
      const threshold = Number(sourceManifest.threshold) || 0.9;
      const preservation = evaluatePdfTextCandidates(sourceManifest.blocks, candidates, threshold, sourceTopology);
      structure.textPreservation = preservation;
      if (preservation.status !== "pass") throw textPreservationError(structure, preservation);
    }
  }
  return { ...structure, status: "pass" };
}

export function renderPdfPages(pdfPath, outputPrefix, expectedPageCount) {
  if (!Number.isInteger(expectedPageCount) || expectedPageCount < 1) {
    throw new Error(`Expected PDF page count must be a positive integer: ${expectedPageCount}`);
  }
  cleanPdfPageImages(outputPrefix);
  const rendered = commandResult("pdftoppm", ["-png", pdfPath, outputPrefix]);
  assertCommandCompleted(rendered, "pdftoppm");
  if (rendered.error?.code === "ENOENT") {
    throw new Error("pdftoppm is required to render PDF pages; install Poppler and retry");
  }
  if (rendered.error) throw new Error(`Could not run pdftoppm: ${rendered.error.message}`);
  if (rendered.status !== 0) {
    throw new Error(`pdftoppm rejected PDF output: ${(rendered.stderr || rendered.stdout || "unknown error").trim()}`);
  }
  return normalizePdfPageImages(outputPrefix, expectedPageCount);
}

function sourceManifestFromHtml(htmlPath) {
  const html = readFileSync(htmlPath, "utf8");
  const match = html.match(/<script\b[^>]*\bid=["']book-data["'][^>]*>([\s\S]*?)<\/script>/iu);
  if (!match) throw new Error(`Cannot find #book-data in companion HTML: ${htmlPath}`);
  let bookData;
  try {
    bookData = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`Cannot parse #book-data in companion HTML: ${error.message}`);
  }
  if (!bookData.sourceManifest?.blocks?.length) {
    throw new Error(`Companion HTML has no sourceManifest blocks: ${htmlPath}`);
  }
  return bookData.sourceManifest;
}

function companionHtml(options) {
  const html = options.html;
  if (html) return resolve(html);
  const manifestPath = options.manifest;
  if (!manifestPath) return null;
  const absoluteManifest = resolve(manifestPath);
  const manifest = JSON.parse(readFileSync(absoluteManifest, "utf8"));
  if (!manifest.entry || typeof manifest.entry !== "string") {
    throw new Error(`Build manifest has no HTML entry: ${absoluteManifest}`);
  }
  return resolve(dirname(absoluteManifest), manifest.entry);
}

function sourceTopologyFromReport(reportPath) {
  if (!reportPath) return [];
  const report = JSON.parse(readFileSync(resolve(reportPath), "utf8"));
  const topology = report?.print?.sourceBlockPages ?? report?.desktop?.sourceBlockPages ?? [];
  if (!Array.isArray(topology)) throw new Error("Render report sourceBlockPages must be an array");
  return topology;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  let cli;
  try {
    cli = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        html: { type: "string" },
        manifest: { type: "string" },
        "require-text": { type: "boolean" },
        "render-report": { type: "string" },
        render: { type: "string" },
        report: { type: "string" }
      },
      strict: true
    });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const pdfPath = cli.positionals[0];
  if (!pdfPath) {
    console.error("Usage: node scripts/lib/pdf-structure.mjs <path-to-pdf> [--html index.html | --manifest book-build-manifest.json] [--render-report render-report.json] [--require-text] [--render prefix] [--report report.json]");
    process.exit(1);
  }
  try {
    const htmlPath = companionHtml(cli.values);
    const sourceManifest = htmlPath ? sourceManifestFromHtml(htmlPath) : null;
    const structure = validatePdfStructure(resolve(pdfPath), null, {
      requireText: Boolean(cli.values["require-text"] || sourceManifest),
      sourceManifest,
      sourceTopology: sourceTopologyFromReport(cli.values["render-report"])
    });
    const outputPrefix = cli.values.render;
    if (outputPrefix) {
      renderPdfPages(resolve(pdfPath), resolve(outputPrefix), structure.pageCount);
    }
    const reportPath = cli.values.report;
    if (reportPath) writeFileSync(resolve(reportPath), JSON.stringify(structure, null, 2));
    process.stdout.write(`${structure.pageCount}\n`);
  } catch (error) {
    const reportPath = cli.values.report;
    if (reportPath && error.report) writeFileSync(resolve(reportPath), JSON.stringify(error.report, null, 2));
    console.error(error.message);
    process.exit(2);
  }
}
