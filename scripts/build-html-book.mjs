#!/usr/bin/env node
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_THEME_NAME, STYLE_NAMES, getTheme, renderThemeFontLinks, themeColors, themeFontStack } from "../themes/index.mjs";
import { parseManuscript, wordCount } from "./lib/manuscript.mjs";
import { assertContract, readContractFile } from "./lib/json-contracts.mjs";
import { assertPlanMatchesManuscript, assertPlanPolicy, hasPlanException } from "./lib/plan-contract.mjs";
import { createSourceInventory } from "./lib/source-inventory.mjs";
import { resolveLocalAsset } from "./lib/local-assets.mjs";
import { compilePlan } from "./lib/plan-compiler.mjs";
import { acquirePipelineLock } from "./lib/pipeline-lock.mjs";
import { serializeBookClientProgram } from "./lib/book-client-program.mjs";
import { resolveBookPaths } from "./lib/book-paths.mjs";
import { assertCoverGenerationReceiptFile, assertCoverImageRequestFile } from "./lib/cover-image-request.mjs";
import { assertCoverAssetNotReused, inspectCoverBitmap, resolveRequiredCoverAsset } from "./lib/cover-assets.mjs";
import { sha256 } from "./lib/content-hash.mjs";
import { defaultRequireDiagrams, defaultRequireFeaturePages } from "./lib/book-policy.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(scriptDir, "..");
const LETTER_WIDTH_IN = 8.5;
const LETTER_HEIGHT_IN = 11;
const DEFAULT_COVER_BAND_HEIGHT_IN = 3.55;
const BODY_COLUMN_CLASSES = ["text-two", "text-single", "text-three"];
const COVER_ROUTES = Object.freeze([
  { id: "photo", label: "Editorial image route", decoration: () => "" },
  { id: "minimal", label: "High-contrast minimal", decoration: () => '<div class="route-minimal-mark" aria-hidden="true"></div>' }
]);
const COVER_ROUTE_IDS = COVER_ROUTES.map((route) => route.id);

function numberInRange(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function usage() {
  console.error(`Usage: node scripts/build-html-book.mjs <book.json> <manuscript.md> <book-plan.json>

book.json fields:
  title        required
  author       required
  subtitle     optional
  outputDir    optional, default: directory containing book.json
  outputHtml   optional, default: index.html
  coverImage   required local generated bitmap path, relative to outputDir
               with the default band, split-cover art slot is ${LETTER_WIDTH_IN}in x ${(LETTER_HEIGHT_IN - DEFAULT_COVER_BAND_HEIGHT_IN).toFixed(2)}in, aspect ${(LETTER_WIDTH_IN / (LETTER_HEIGHT_IN - DEFAULT_COVER_BAND_HEIGHT_IN)).toFixed(2)}:1
  coverBandHeight optional inches for the bottom cover band, default 3.55
  requirePartImages optional boolean; defaults to true when coverImage is set and the manuscript has parts
  requireDiagrams optional boolean; defaults to true for designed nonfiction, false for plain/literary reader editions
  requireFeaturePages optional boolean; defaults to true for designed nonfiction, false for plain/literary reader editions
  chapterOpeners optional boolean; default false. When false, chapters start directly on text pages.
  chapterClosers optional object keyed by chapter id, title, or number for generated chapter-close copy
  partImages   optional object keyed by part id, title, label, or number for generated part-divider art; if provided, must cover every part and use unique values
  style         optional: ${STYLE_NAMES.join(" | ")}
  themeOverrides optional object of known theme color keys using hex colors
  selectedCoverRoute optional: ${COVER_ROUTE_IDS.join(" | ")}, default: photo
  bodyColumns   optional: ${BODY_COLUMN_CLASSES.join(" | ")}, default: text-two
`);
  process.exit(1);
}

const [configPathArg, manuscriptPathArg, planPathArg] = process.argv.slice(2);
if (!configPathArg || !manuscriptPathArg || !planPathArg) usage();

const requestedConfigPath = resolve(configPathArg);
const manuscriptPath = realpathSync(resolve(manuscriptPathArg));
const config = assertContract("book-config", JSON.parse(readFileSync(requestedConfigPath, "utf8")));
const resolvedPaths = resolveBookPaths({ configPath: requestedConfigPath, config, forbiddenRoots: [skillDir] });
const configPath = resolvedPaths.configPath;
const planPath = realpathSync(resolve(planPathArg));
const plan = readContractFile("book-plan", planPath);
const manuscript = readFileSync(manuscriptPath, "utf8");
const outputDir = resolvedPaths.outputDir;
const outputHtml = basename(resolvedPaths.outputHtml);
if (typeof outputHtml !== "string" || basename(outputHtml) !== outputHtml) {
  throw new Error("outputHtml must be a single filename inside outputDir; nested paths are not supported.");
}
if (![".html", ".htm"].includes(extname(outputHtml).toLowerCase())) {
  throw new Error("outputHtml must use an .html or .htm extension.");
}
const outputPath = resolvedPaths.outputHtml;
const coverOptionsPath = resolve(outputDir, "cover-options.html");
const buildManifestPath = resolve(outputDir, "book-build-manifest.json");
const buildSummaryPath = resolve(outputDir, "book-build-summary.json");
const sourceInventoryPath = resolve(outputDir, "source-inventory.json");
const planReceiptPath = resolve(outputDir, "book-plan-receipt.json");
const coverRequestPath = resolve(outputDir, "cover-image-request.json");
const coverGenerationReceiptPath = resolve(outputDir, "cover-generation-receipt.json");
const coverReceiptPath = resolve(outputDir, "cover-image-receipt.json");
const baseCss = readFileSync(resolve(skillDir, "page-base.css"), "utf8");

const generatedPaths = new Map([
  [outputPath, "outputHtml"],
  [coverOptionsPath, "cover options"],
  [buildManifestPath, "build manifest"],
  [buildSummaryPath, "build summary"],
  [sourceInventoryPath, "source inventory"],
  [planReceiptPath, "plan receipt"],
  [coverReceiptPath, "cover image receipt"]
]);
if (generatedPaths.size !== 7) throw new Error("outputHtml collides with a reserved generated filename.");
for (const [inputPath, label] of [[configPath, "configuration"], [manuscriptPath, "manuscript"], [planPath, "plan"]]) {
  if (generatedPaths.has(inputPath)) {
    throw new Error(`${generatedPaths.get(inputPath)} collides with the ${label} input: ${inputPath}`);
  }
}

mkdirSync(outputDir, { recursive: true });
const releaseBuildLock = acquirePipelineLock(outputDir);
process.once("exit", releaseBuildLock);

function isOutsideDirectory(root, candidate) {
  const path = relative(root, candidate);
  return path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path);
}

function canonicalRelativeFile(root, candidate, label) {
  if (isOutsideDirectory(root, candidate)) {
    throw new Error(`${label} resolves outside outputDir: ${candidate}`);
  }
  if (existsSync(candidate)) {
    const canonicalRoot = realpathSync(root);
    const canonicalCandidate = realpathSync(candidate);
    if (isOutsideDirectory(canonicalRoot, canonicalCandidate)) {
      throw new Error(`${label} resolves outside outputDir through a symbolic link: ${candidate}`);
    }
  }
  return relative(root, candidate).split(sep).join("/");
}

function localAssetManifestPath(value, label) {
  const candidate = resolveLocalAsset(value, dirname(outputPath), label, outputDir);
  if (!candidate) return null;
  if (!existsSync(candidate)) throw new Error(`${label} does not exist: ${candidate}`);
  if (!lstatSync(candidate).isFile()) throw new Error(`${label} must name a regular file: ${candidate}`);
  if (generatedPaths.has(candidate)) {
    throw new Error(`${label} collides with generated ${generatedPaths.get(candidate)}: ${candidate}`);
  }
  return canonicalRelativeFile(outputDir, candidate, label);
}

const manifestEntry = canonicalRelativeFile(outputDir, outputPath, "outputHtml");
const manifestCoverOptions = canonicalRelativeFile(outputDir, coverOptionsPath, "coverOptions");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainText(value) {
  return String(value ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function trimmedText(value) {
  return String(value ?? "").trim();
}

function cssString(value) {
  return JSON.stringify(String(value ?? ""))
    .replace(/</g, "\\3C ")
    .replace(/>/g, "\\3E ");
}

function cssUrl(value) {
  const text = String(value ?? "").trim();
  return text ? `url(${cssString(text)})` : "";
}

function jsonForHtmlScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function enumValue(value, field, allowed, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const text = String(value).trim();
  if (allowed.includes(text)) return text;
  throw new Error(`${field} must be one of: ${allowed.join(", ")}`);
}

function booleanValue(value, field, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (["true", "yes", "1"].includes(text)) return true;
    if (["false", "no", "0"].includes(text)) return false;
  }
  throw new Error(`${field} must be a boolean.`);
}

function normalizeMap(value, field, cleanValue = plainText) {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) throw new Error(`${field} must be an object keyed by book ids, titles, labels, or numbers.`);
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, raw]) => [plainText(key), cleanValue(raw)])
      .filter(([key, text]) => key && text)
  );
}

function lookupMap(map, keys) {
  for (const key of keys) {
    const value = map[plainText(key)];
    if (value) return value;
  }
  return "";
}

function hasMapEntries(map) {
  return Object.keys(map).length > 0;
}

function clipText(value, maxLength = 160) {
  const text = plainText(value);
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength + 1).replace(/\s+\S*$/, "").trim();
  return `${clipped || text.slice(0, maxLength).trim()}...`;
}

const configMaps = {
  chapterClosers: normalizeMap(config.chapterClosers, "chapterClosers"),
  partImages: normalizeMap(config.partImages, "partImages", trimmedText)
};

const parsed = parseManuscript(manuscript);
if (!parsed.chapters.length) throw new Error("No chapters found in manuscript.");

assertPlanMatchesManuscript(plan, parsed, STYLE_NAMES);
assertPlanPolicy(plan, config, parsed);

const expectedCoverRequest = assertCoverImageRequestFile(coverRequestPath, { config, plan, outputDir });
const coverAssetPath = resolveRequiredCoverAsset(config.coverImage, outputDir);
const coverAssetReport = inspectCoverBitmap(coverAssetPath, {
  frame: expectedCoverRequest.constraints.frame,
  minimumDpi: expectedCoverRequest.constraints.minimumDpi
});
const coverAssetHash = coverAssetReport.sha256;
const coverGenerationReceipt = assertCoverGenerationReceiptFile(coverGenerationReceiptPath, { config, plan, outputDir }, { assetPath: coverAssetPath, report: coverAssetReport });
assertCoverAssetNotReused({
  coverPath: coverAssetPath,
  coverReport: coverAssetReport,
  outputDir,
  assets: [
    ...Object.entries(config.partImages ?? {}).map(([scope, value]) => ({ label: `partImages.${scope}`, value })),
    ...parsed.assetReferences.map((value, index) => ({ label: `manuscript image ${index + 1}`, value }))
  ]
});

const coverImage = trimmedText(config.coverImage);
const coverDecision = plan.visuals.cover;
const book = {
  title: plainText(config.title),
  subtitle: plainText(config.subtitle ?? ""),
  author: plainText(config.author),
  bookType: plainText(config.bookType ?? "Book"),
  coverKicker: plainText(config.coverKicker ?? "A book"),
  coverImage,
  coverAltText: coverDecision.altText,
  coverSubject: coverDecision.subject,
  coverFocalPoint: coverDecision.focalPoint,
  coverRequestHash: expectedCoverRequest.requestHash,
  coverBandHeight: numberInRange(config.coverBandHeight, DEFAULT_COVER_BAND_HEIGHT_IN, 2.8, 4.4),
  requirePartImages: hasPlanException(plan, "waive-part-images") ? false : booleanValue(config.requirePartImages, "requirePartImages", Boolean(coverImage && parsed.parts.length)),
  requireDiagrams: hasPlanException(plan, "waive-diagrams") ? false : booleanValue(config.requireDiagrams, "requireDiagrams", defaultRequireDiagrams(config)),
  requireFeaturePages: hasPlanException(plan, "waive-feature-pages") ? false : booleanValue(config.requireFeaturePages, "requireFeaturePages", defaultRequireFeaturePages(config)),
  chapterOpeners: plan.layout.chapterOpeners,
  style: plan.theme.id,
  themeOverrides: config.themeOverrides ?? {},
  selectedCoverRoute: plan.layout.coverRoute,
  bodyColumns: plan.layout.bodyColumns,
  fontMode: config.fontMode ?? "system"
};

if (!book.title || !book.author) throw new Error("book.json must include non-empty title and author.");
const matchingManuscriptTitle = parsed.metadata.find((entry) => entry.title === book.title);

function firstContentBlock(chapter) {
  const block = chapter.blocks.find((candidate) => candidate.expectedText && !/^h[1-6]$/u.test(candidate.type));
  return block?.expectedText ?? plainText(block?.html ?? "");
}

function excerpt(chapter, words = 42) {
  const text = plainText(firstContentBlock(chapter));
  const parts = text.split(/\s+/).filter(Boolean);
  return parts.slice(0, words).join(" ") + (parts.length > words ? "." : "");
}

function chapterLookupKeys(chapter) {
  return [chapter.id, chapter.title, String(chapter.number)];
}

function partLookupKeys(part, index) {
  return [part.id, part.title, part.label, String(index + 1), `part-${String(index + 1).padStart(2, "0")}`];
}

function partDisplayName(part) {
  return [part.label, part.title].filter(Boolean).join(": ") || part.id;
}

function normalizedAssetPath(value) {
  return trimmedText(value).replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
}

function assertUniquePartImages(parts) {
  const seen = new Map();
  for (const part of parts) {
    const asset = normalizedAssetPath(part.image);
    if (!asset) continue;
    const previous = seen.get(asset);
    if (previous) {
      throw new Error(`partImages must use a distinct image asset for each part divider. "${part.image}" resolves to the same asset as "${previous.image}" for "${partDisplayName(previous)}" and "${partDisplayName(part)}". Generate separate section-grounded images or distinct variants.`);
    }
    seen.set(asset, part);
  }
}

function assertCompletePartImages(parts, hasExplicitPartImages, required) {
  if (!required && !hasExplicitPartImages) return;
  if (!parts.length) {
    throw new Error(required ? "requirePartImages is true, but the manuscript has no parsed part dividers." : "partImages were provided, but the manuscript has no parsed part dividers.");
  }
  const missing = parts.filter((part) => !part.image);
  if (missing.length) {
    const names = missing.map(partDisplayName).join("; ");
    throw new Error(`partImages must cover every parsed part divider when used. Missing image asset(s) for: ${names}. Generate section-grounded art for each part, using the same cover-image format and prompt style with distinct subjects.`);
  }
}

function assertPartImagesDoNotReuseCover(parts, coverImage) {
  const cover = normalizedAssetPath(coverImage);
  if (!cover) return;
  const reused = parts.filter((part) => normalizedAssetPath(part.image) === cover);
  if (reused.length) {
    const names = reused.map(partDisplayName).join("; ");
    throw new Error(`partImages must not reuse the cover image asset (${coverImage}). Generate distinct section-grounded art for: ${names}.`);
  }
}

function sourceTailText(chapter) {
  const sample = plainText(firstContentBlock(chapter)) || chapter.title;
  return sample.split(/(?<=[.!?])\s+/).find((part) => part.length > 48) || chapter.title;
}

parsed.parts.forEach((part, index) => {
  const image = lookupMap(configMaps.partImages, partLookupKeys(part, index));
  if (image) part.image = image;
});
assertCompletePartImages(parsed.parts, hasMapEntries(configMaps.partImages), book.requirePartImages);
assertUniquePartImages(parsed.parts);
assertPartImagesDoNotReuseCover(parsed.parts, book.coverImage);
const compiledPlan = compilePlan(plan, parsed, book, { ...coverAssetReport, sha256: coverAssetHash });
const partNumbers = new Map(parsed.parts.map((part, index) => [part.id, index + 1]));

for (const chapter of parsed.chapters) {
  const closer = lookupMap(configMaps.chapterClosers, chapterLookupKeys(chapter));
  chapter.tailText = clipText(closer || sourceTailText(chapter));
}

function fontLinks() {
  const remoteApproved = hasPlanException(plan, "allow-remote-fonts");
  return book.fontMode === "remote" && (!plan || remoteApproved) ? renderThemeFontLinks(getTheme(book.style)) : "";
}

function themeCss() {
  const theme = getTheme(book.style);
  const colors = themeColors(theme, book.themeOverrides);
  const heading = colors.heading ?? colors.ink;
  const deck = colors.deck ?? colors.steel;
  const muted = colors.muted;
  const meta = colors.meta ?? muted;
  const accent = colors.accent ?? deck;
  const soft = colors.soft ?? colors.rule ?? muted;
  const rule = colors.rule ?? `color-mix(in srgb, ${muted} 28%, ${colors.page})`;
  const callout = colors.callout ?? `color-mix(in srgb, ${colors.page} 84%, ${muted})`;
  const coverBandHeight = book.coverBandHeight.toFixed(2);
  const coverArtHeight = (LETTER_HEIGHT_IN - book.coverBandHeight).toFixed(2);
  const coverArtAspect = (LETTER_WIDTH_IN / (LETTER_HEIGHT_IN - book.coverBandHeight)).toFixed(3);
  return `
:root {
  --browser-bg: ${colors.browser};
  --page-bg: ${colors.page};
  --ink: ${colors.ink};
  --heading-ink: ${heading};
  --deck-ink: ${deck};
  --muted-ink: ${muted};
  --label-ink: ${meta};
  --running-ink: ${meta};
  --accent: ${accent};
  --soft-accent: ${soft};
  --steel: ${colors.steel ?? deck};
  --cover-band: ${colors.coverBand ?? heading};
  --cover-band-height: ${coverBandHeight}in;
  --cover-art-height: ${coverArtHeight}in;
  --cover-art-aspect: ${coverArtAspect};
  --rule: ${rule};
  --callout-bg: ${callout};
  --font-display: ${themeFontStack(theme, "display")};
  --font-body: ${themeFontStack(theme, "body")};
  --font-ui: ${themeFontStack(theme, "ui")};
  --page-margin-top: 0.72in;
  --page-margin-bottom: 0.72in;
  --page-margin-inner: 0.78in;
  --page-margin-outer: 0.78in;
  --text-page-margin-top: 0.74in;
  --text-page-margin-bottom: 0.68in;
  --text-page-margin-inner: 0.86in;
  --text-page-margin-outer: 0.86in;
  --text-column-gap: 0.54in;
  --short-single-width: 7.54in;
  --paragraph-indent: 0.9em;
}`;
}

function bookCss() {
  return `
body { font-size: 10.7pt; }
.book-controls a { font: 600 13px/1 var(--font-ui); border: 1px solid var(--rule); border-radius: 6px; padding: 9px 12px; color: var(--ink); background: var(--page-bg); text-decoration: none; }
.cover-kicker, .chapter-kicker, .part-label, .model-label { font-family: var(--font-ui); font-size: 8pt; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase; color: var(--label-ink); }
.cover-kicker { color: #fff; }
.cover-kicker::after { content: ""; display: block; width: 0.62in; height: 0.06in; margin: 0.14in 0 0.18in; background: var(--accent); }
.cover-title { max-width: 6.8in; margin: 0; font-size: 44pt; line-height: 0.94; color: #fff; text-shadow: none; }
.cover-subtitle { max-width: 6.3in; margin: 0.18in 0 0; font-family: var(--font-ui); font-size: 12pt; font-weight: 700; line-height: 1.35; color: #fff; }
.cover-author { margin-top: 0.3in; font-family: var(--font-ui); font-size: 8pt; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; color: #fff; }
.title-grid { display: grid; grid-template-rows: auto 1fr auto; }
.title-grid h1 { align-self: end; max-width: 6in; font-size: 56pt; }
.title-page.has-unbreakable-title h1 { overflow-wrap: anywhere; word-break: break-word; hyphens: none; }
.title-subtitle { max-width: 5.6in; font-family: var(--font-ui); font-size: 14pt; line-height: 1.38; color: var(--deck-ink); }
.title-author { font-family: var(--font-ui); color: var(--muted-ink); }
.toc-list { list-style: none; margin: 0.42in 0 0; padding: 0; font-family: var(--font-ui); }
.toc-list li { display: grid; grid-template-columns: 0.95in minmax(0, 1fr) 0.35in; gap: 0.16in; align-items: baseline; margin-bottom: 0.125in; padding-bottom: 0.09in; border-bottom: 1px solid var(--rule); }
.toc-list span:first-child { font-size: 7.5pt; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; color: var(--label-ink); }
.toc-list span:nth-child(2) { font-size: 10.5pt; font-weight: 700; }
.toc-list span:last-child { text-align: right; color: var(--muted-ink); }
.part-divider .page-inner { display: grid; grid-template-rows: auto auto 1fr auto; padding: 0.82in; background: linear-gradient(135deg, color-mix(in srgb, var(--steel) 10%, transparent), transparent 42%), var(--page-bg); }
.part-divider h1 { max-width: 6.2in; margin-top: 1.5in; font-size: 50pt; line-height: 0.96; }
.part-number { align-self: end; font-family: var(--font-ui); font-size: 104pt; font-weight: 900; line-height: 0.8; color: color-mix(in srgb, var(--accent) 16%, transparent); }
.part-divider.has-part-image { background: var(--cover-band, var(--heading-ink)); }
.part-divider.has-part-image .page-inner { display: grid; grid-template-rows: var(--cover-art-height) var(--cover-band-height); gap: 0; padding: 0; background: var(--cover-band, var(--heading-ink)); }
.part-image-frame { min-height: 0; margin: 0; overflow: hidden; background: linear-gradient(135deg, color-mix(in srgb, var(--soft-accent) 24%, var(--page-bg)), var(--page-bg)); }
.part-image-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
.part-divider-copy { min-height: var(--cover-band-height); display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto; gap: 0.1in 0.3in; align-content: center; align-items: end; padding: 0.48in 0.62in 0.56in; background: var(--cover-band, var(--heading-ink)); color: #fff; }
.part-divider-copy .part-label { grid-column: 1 / -1; margin: 0; color: #fff; }
.part-divider.has-part-image h1 { max-width: 5.9in; margin: 0; font-size: 38pt; line-height: 0.96; color: #fff; }
.part-divider.has-part-image .part-number { font-size: 74pt; color: color-mix(in srgb, #fff 20%, transparent); }
.chapter-opener .page-inner { display: grid; grid-template-rows: auto 1fr auto auto; }
.chapter-title { align-self: end; max-width: 6.2in; font-size: 44pt; }
.chapter-summary { max-width: 5.7in; margin-top: 0.22in; font-family: var(--font-ui); font-size: 12pt; line-height: 1.45; color: var(--deck-ink); }
.opener-axis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.1in; margin-top: 0.55in; }
.opener-axis span { height: 0.08in; background: var(--accent); }
.text-page-title { font-size: 16pt; font-family: var(--font-ui); }
.text-frame { font-size: 9.7pt; line-height: 1.49; }
.text-frame h3 { margin: 0.04in 0 0.08in; font-family: var(--font-ui); font-size: 9.5pt; letter-spacing: 0.08em; text-transform: uppercase; color: var(--deck-ink, var(--steel)); }
.numbered-item, .bullet-item { display: grid; grid-template-columns: 0.24in minmax(0,1fr); gap: 0.08in; text-indent: 0; break-inside: avoid; page-break-inside: avoid; }
.numbered-item span { font-family: var(--font-ui); font-size: 10.5pt; font-weight: 600; color: var(--accent); }
.bullet-item span { font-family: var(--font-ui); font-size: 7.5pt; font-weight: 900; color: var(--accent); }
.text-page.has-tail-furniture .page-inner { grid-template-rows: auto minmax(0, 1fr) auto; }
.text-page.has-tail-furniture .tail-furniture { align-self: end; display: grid; grid-template-columns: 0.08in minmax(0,1fr); gap: 0.18in; align-items: start; padding-top: 0.18in; }
.text-page.has-tail-furniture .tail-furniture::before { content: ""; width: 0.08in; min-height: 0.7in; background: var(--accent); }
.tail-label { margin: 0 0 0.06in; font-family: var(--font-ui); font-size: 7.5pt; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); }
.tail-quote { margin: 0; max-width: 5.1in; font-family: var(--font-display); font-size: 16pt; line-height: 1.24; color: var(--heading-ink); text-indent: 0; }
.feature-page .page-inner { display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 0.26in; padding: 0.72in 0.78in; }
.feature-page h1 { max-width: 6.65in; margin: 0; font-size: 35pt; line-height: 0.98; }
.feature-page.feature-title-long h1 { font-size: 29pt; line-height: 1.02; }
.feature-header { display: grid; gap: 0.12in; }
.feature-deck { max-width: 6.1in; margin: 0; font-size: 12.5pt; line-height: 1.44; color: var(--muted-ink); text-indent: 0; }
.framework-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 0.14in 0.34in; min-height: 0; }
.framework-item { position: relative; display: grid; grid-template-columns: 0.52in minmax(0, 1fr); grid-template-rows: auto 1fr; gap: 0.04in 0.12in; align-content: start; padding: 0.17in 0.12in 0.14in 0; border-top: 1px solid var(--rule); }
.framework-number { grid-row: 1 / 3; font: 900 24pt/1 var(--font-display); color: var(--accent); }
.framework-item h2 { margin: 0; font: 800 14pt/1.1 var(--font-display); color: var(--deck-ink); }
.framework-item p { margin: 0; font-size: 9.7pt; line-height: 1.42; text-indent: 0; }
.framework-footer { display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.18in; align-items: center; margin: 0; font: 900 7.5pt/1.2 var(--font-ui); letter-spacing: 0.12em; text-align: center; text-transform: uppercase; color: var(--label-ink); }
.framework-footer::before, .framework-footer::after { content: ""; height: 0.06in; background: var(--accent); }
.framework-footer::after { background: var(--deck-ink); }
.scorecard-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5in; min-height: 0; }
.scorecard-side { display: grid; grid-template-rows: auto auto 1fr; align-content: start; min-width: 0; padding-top: 0.12in; border-top: 0.05in solid var(--accent); }
.scorecard-side:nth-child(2) { border-color: var(--deck-ink); }
.scorecard-side h2 { margin: 0 0 0.06in; font-size: 25pt; line-height: 1; }
.scorecard-descriptor { margin: 0 0 0.18in; font: 800 7.4pt/1.3 var(--font-ui); letter-spacing: 0.1em; text-transform: uppercase; color: var(--label-ink); text-indent: 0; }
.scorecard-metrics { display: grid; align-content: stretch; }
.scorecard-metric { display: grid; grid-template-columns: minmax(0, 0.9in) minmax(0, 1fr); gap: 0.14in; align-items: baseline; padding: 0.14in 0; border-top: 1px solid var(--rule); }
.scorecard-metric strong { font: 900 21pt/1 var(--font-display); color: var(--heading-ink); overflow-wrap: anywhere; }
.scorecard-metric span { font: 700 8pt/1.3 var(--font-ui); letter-spacing: 0.045em; text-transform: uppercase; color: var(--muted-ink); }
.scorecard-verdict { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.24in; align-items: center; margin: 0; padding-top: 0.2in; border-top: 0.04in solid var(--soft-accent); font-size: 13pt; line-height: 1.35; text-indent: 0; }
.scorecard-verdict strong { font: 900 42pt/0.8 var(--font-display); color: var(--accent); }
.numbers-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.16in 0.34in; align-content: start; min-height: 0; }
.numbers-panel { padding: 0.18in 0; border-top: 1px solid var(--rule); }
.numbers-panel h2 { margin: 0 0 0.12in; font: 800 10.5pt/1.2 var(--font-ui); color: var(--muted-ink); }
.numbers-entries { display: grid; gap: 0.09in; }
.numbers-entry { display: grid; grid-template-columns: minmax(0, 0.82in) minmax(0, 1fr) minmax(0, 0.55in); gap: 0.1in; align-items: center; }
.numbers-entry-label { font: 800 7.4pt/1 var(--font-ui); text-transform: uppercase; overflow-wrap: anywhere; }
.numbers-bar { height: 0.16in; overflow: hidden; background: color-mix(in srgb, var(--rule) 28%, var(--page-bg)); }
.numbers-bar-fill { display: block; height: 100%; background: var(--deck-ink); }
.numbers-entry:first-child .numbers-bar-fill { background: var(--heading-ink); }
.numbers-entry strong { text-align: right; font: 900 14pt/1 var(--font-display); color: var(--heading-ink); overflow-wrap: anywhere; }
.numbers-highlight { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.24in; align-items: center; margin: 0; padding: 0.24in; background: var(--callout-bg); font-size: 12.5pt; line-height: 1.32; text-indent: 0; }
.numbers-highlight strong { font: 900 38pt/0.9 var(--font-display); color: var(--accent); }
.planned-callout, .planned-definition { padding: 0.16in 0.18in; border-left: 0.06in solid var(--accent); background: var(--callout-bg); break-inside: avoid; }
.planned-diagram { padding: 0.18in; border: 1px solid var(--rule); border-radius: 0.06in; background: var(--callout-bg); break-inside: avoid; }
.diagram-heading { display: grid; gap: 0.04in; }
.diagram-heading p { margin: 0; }
.diagram-caption { font-size: 8.8pt; line-height: 1.35; color: var(--muted-ink); }
.diagram-flow { display: grid; grid-template-columns: repeat(auto-fit, minmax(1.05in, 1fr)); gap: 0.1in; align-items: stretch; margin-top: 0.12in; }
.diagram-layout-comparison, .diagram-layout-matrix { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.diagram-layout-hierarchy .diagram-node:first-child, .diagram-layout-taxonomy .diagram-node:first-child { grid-column: 1 / -1; justify-self: center; width: min(2.2in, 100%); }
.diagram-node { display: grid; place-items: center; align-content: center; gap: 0.04in; min-height: 0.62in; padding: 0.1in; border: 1px solid var(--rule); background: var(--page-bg); text-align: center; }
.diagram-node-label { font: 800 8.6pt/1.2 var(--font-ui); color: var(--heading-ink); }
.diagram-node-detail { font-size: 8pt; line-height: 1.28; color: var(--muted-ink); }
.diagram-relationships { display: grid; grid-template-columns: repeat(auto-fit, minmax(1.5in, 1fr)); gap: 0.06in 0.16in; margin: 0.12in 0 0; padding: 0.1in 0 0 0.18in; border-top: 1px solid var(--rule); font-size: 7.8pt; line-height: 1.25; }
.diagram-relationships[hidden] { display: none; }
.diagram-takeaway { margin-top: 0.12in; padding-top: 0.1in; border-top: 2px solid var(--accent); font-weight: 700; color: var(--heading-ink); }
.planned-table, .planned-checklist { padding: 0.12in 0.16in; border-top: 2px solid var(--accent); border-bottom: 1px solid var(--rule); break-inside: avoid; }
.planned-quote { padding-left: 0.2in; border-left: 0.04in solid var(--accent); font-family: var(--font-display); font-size: 12pt; font-style: italic; }
.option-cover { position: relative; overflow: hidden; background: var(--cover-band); }
.cover-art-frame { position: absolute; inset: 0 0 auto; height: var(--cover-art-height); margin: 0; overflow: hidden; background: var(--soft-accent); }
.cover-art { display: block; width: 100%; height: 100%; object-fit: cover; object-position: calc(var(--cover-focal-x) * 1%) calc(var(--cover-focal-y) * 1%); }
.option-cover .page-inner { position: absolute; z-index: 2; left: 0; right: 0; bottom: 0; height: var(--cover-band-height); min-height: var(--cover-band-height); display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr auto auto; align-content: center; padding: 0.46in 0.62in 0.52in; background: var(--cover-band); }
.option-cover h1 { align-self: end; min-width: 0; max-width: 6.15in; overflow-wrap: normal; word-break: normal; hyphens: none; font-size: 44pt; line-height: 0.92; }
.option-cover.title-long h1 { font-size: 34pt; line-height: 0.96; }
.option-cover.title-very-long h1 { font-size: 27pt; line-height: 1; }
.option-cover.has-unbreakable-title h1 { overflow-wrap: anywhere; word-break: break-word; }
.option-cover.has-unbreakable-title.title-short h1 { font-size: 30pt; }
.option-cover.has-unbreakable-title.title-long h1 { font-size: 29pt; }
.option-cover.has-unbreakable-title.title-very-long h1 { font-size: 23pt; }
.cover.option-cover h1 { font-size: 40pt; }
.cover.option-cover.title-long h1 { font-size: 30pt; }
.cover.option-cover.title-very-long h1 { font-size: 21pt; }
.cover.option-cover.has-unbreakable-title.title-short h1 { font-size: 28pt; }
.cover.option-cover.has-unbreakable-title.title-long h1 { font-size: 26pt; }
.cover.option-cover.has-unbreakable-title.title-very-long h1 { font-size: 20pt; }
.option-subtitle, .option-author, .cover-route-label { font-family: var(--font-ui); }
.route-photo .page-inner { background: var(--cover-band, var(--heading-ink)); color: #fff; }
.route-photo h1, .route-photo p { color: #fff; }
.route-minimal .page-inner { padding-right: 1.55in; background: var(--page-bg); color: var(--ink); }
.route-minimal-mark { position: absolute; z-index: 3; right: 0.62in; bottom: 0.58in; width: 0.72in; height: calc(var(--cover-band-height) - 1.16in); background: var(--accent); }
.route-minimal .cover-kicker { color: var(--label-ink); }
@media screen and (max-width: 920px) {
  .book { gap: 0; }
  .page { margin-bottom: 18px; }
  .text-page { margin-bottom: 0; }
  .option-cover .cover-art-frame { position: relative; inset: auto; width: 100%; height: auto; aspect-ratio: var(--cover-art-aspect); }
  .option-cover .page-inner { position: relative; inset: auto; width: 100%; height: auto; min-height: 42vw; padding: 7.5vw; }
  .part-divider.has-part-image .page-inner { height: auto; min-height: 0; grid-template-rows: auto auto; }
  .cover-image, .part-image-frame { position: relative; display: block; min-height: 72vw; inset: auto; }
  .cover-title, .part-divider h1, .chapter-title { font-size: 38pt; }
  .title-grid h1 { font-size: 34pt; }
  .title-grid > *, .title-grid h1 { min-width: 0; max-width: 100%; }
  .option-cover h1, .cover.option-cover h1 { font-size: 34pt; }
  .option-cover.title-long h1, .cover.option-cover.title-long h1 { font-size: 21pt; line-height: 1; }
  .option-cover.title-very-long h1, .cover.option-cover.title-very-long h1 { font-size: 18pt; line-height: 1.04; }
  .option-cover.has-unbreakable-title.title-short h1, .cover.option-cover.has-unbreakable-title.title-short h1 { font-size: 25pt; }
  .option-cover.has-unbreakable-title.title-long h1, .cover.option-cover.has-unbreakable-title.title-long h1 { font-size: 19pt; }
  .option-cover.has-unbreakable-title.title-very-long h1, .cover.option-cover.has-unbreakable-title.title-very-long h1 { font-size: 17pt; }
  .route-minimal .page-inner { padding-right: 26%; }
  .route-minimal-mark { top: auto; right: 8.5%; bottom: 8.5%; width: 10%; height: 30%; }
  .feature-page .page-inner { display: block; padding: 8.5%; }
  .feature-page .chapter-kicker, .feature-page .feature-header, .feature-page .framework-grid, .feature-page .scorecard-grid, .feature-page .numbers-grid { margin-bottom: 1.25rem; }
  .feature-page h1, .feature-page.feature-title-long h1 { font-size: clamp(27px, 9vw, 35pt); }
  .framework-grid, .scorecard-grid, .numbers-grid { grid-template-columns: 1fr; grid-auto-rows: auto; }
  .framework-item { min-height: 0; }
  .framework-footer { grid-template-columns: 0.35fr auto 0.35fr; }
  .scorecard-verdict, .numbers-highlight { grid-template-columns: 1fr; }
  .scorecard-verdict strong, .numbers-highlight strong { font-size: 30pt; }
  .diagram-flow, .diagram-layout-comparison, .diagram-layout-matrix { grid-template-columns: 1fr; }
}`;
}

function renderTitlePage() {
  const titleClass = book.title.split(/\s+/u).some((token) => token.length > 24) ? " has-unbreakable-title" : "";
  return `
<section class="page title-page${titleClass}" id="title-page" aria-label="Title page">
  <div class="page-inner title-grid">
    <p class="chapter-kicker no-indent">${escapeHtml(book.bookType)}</p>
    <div>
      <h1${matchingManuscriptTitle ? ` data-source-block-id="${escapeHtml(matchingManuscriptTitle.sourceBlockId)}"` : ""}>${escapeHtml(book.title)}</h1>
      ${book.subtitle ? `<p class="title-subtitle no-indent">${escapeHtml(book.subtitle)}</p>` : ""}
    </div>
    <p class="title-author no-indent">by ${escapeHtml(book.author)}</p>
  </div>
</section>`;
}

function renderToc(chapters) {
  return `
<section class="page toc-page-section" id="contents" aria-label="Table of contents">
  <div class="page-inner">
    <p class="chapter-kicker no-indent">Contents</p>
    <h1>Contents</h1>
    <ol class="toc-list">
      ${chapters.map((chapter) => `
      <li>
        <span>${["Introduction", "Opening"].includes(chapter.number) ? "Introduction" : `Chapter ${chapter.number}`}</span>
        <span>${escapeHtml(chapter.title.replace(/^Introduction:\s*/, ""))}</span>
        <span data-toc-page-for="${chapter.id}"></span>
      </li>`).join("")}
    </ol>
  </div>
</section>`;
}

function renderPartCopy(part, index) {
  return `
    <p class="part-label no-indent">${escapeHtml(`${part.label}${part.labelSuffix ?? " "}`)}</p>
    <h1>${escapeHtml(part.title)}</h1>
    <div class="part-number">${String(index).padStart(2, "0")}</div>`;
}

function renderPartDivider(part, index) {
  if (part.image) {
    return `
<section class="page part-divider has-part-image" id="${part.id}" data-source-block-id="${escapeHtml(part.sourceBlockId)}" aria-label="${escapeHtml(part.label)}">
  <div class="page-inner">
    <figure class="part-image-frame">
      <img src="${escapeHtml(part.image)}" alt="${escapeHtml(part.imageAlt || `Editorial image for ${part.title}`)}">
    </figure>
    <div class="part-divider-copy">
      ${renderPartCopy(part, index)}
    </div>
  </div>
</section>`;
  }
  return `
<section class="page part-divider" id="${part.id}" data-source-block-id="${escapeHtml(part.sourceBlockId)}" aria-label="${escapeHtml(part.label)}">
  <div class="page-inner">
    ${renderPartCopy(part, index)}
  </div>
</section>`;
}

function renderChapterOpener(chapter) {
  return `
<section class="page chapter-opener" id="${chapter.id}-opener" data-allow-opening-spread="true" aria-label="${escapeHtml(chapter.title)} opener">
  <div class="page-inner">
    <p class="chapter-kicker no-indent">${["Introduction", "Opening"].includes(chapter.number) ? "Introduction" : `Chapter ${chapter.number}`}</p>
    <h1 class="chapter-title">${escapeHtml(chapter.title)}</h1>
    <p class="chapter-summary no-indent">${escapeHtml(excerpt(chapter, 44))}</p>
    <div class="opener-axis" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
  </div>
</section>`;
}

function renderCoverRouteCopy(label, final = false) {
  return `
          <p class="${final ? "cover-kicker" : "cover-route-label"} no-indent">${escapeHtml(final ? book.coverKicker : label)}</p>
          <h1>${escapeHtml(book.title)}</h1>
          ${book.subtitle ? `<p class="option-subtitle no-indent">${escapeHtml(book.subtitle)}</p>` : ""}
          <p class="option-author no-indent">by ${escapeHtml(book.author)}</p>`;
}

function renderCoverArt() {
  return `<figure class="cover-art-frame"><img class="cover-art" src="${escapeHtml(book.coverImage)}" alt="${escapeHtml(book.coverAltText)}" style="--cover-focal-x:${book.coverFocalPoint.x};--cover-focal-y:${book.coverFocalPoint.y}"></figure>`;
}

function renderCoverRoute(route, { final = false } = {}) {
  if (!route) throw new Error(`Unsupported cover route: ${book.selectedCoverRoute}`);
  const routeClass = `route-${route.id}`;
  const hasUnbreakableTitle = book.title.split(/\s+/u).some((token) => token.length > 24);
  const titleLengthClass = book.title.length > 82 ? "title-very-long" : (book.title.length > 46 ? "title-long" : "title-short");
  const classes = ["page", "option-cover", "has-cover-art", titleLengthClass, ...(final ? ["cover"] : []), ...(hasUnbreakableTitle ? ["has-unbreakable-title"] : []), routeClass].join(" ");
  const decoration = route.decoration(book);
  const label = route.label;
  return `
      <section class="${classes}"${final ? ' id="cover" aria-label="Cover"' : ""} data-cover-route="${route.id}" data-cover-asset="${escapeHtml(book.coverImage)}" data-cover-request-hash="${book.coverRequestHash}">
        ${renderCoverArt()}
        ${decoration}
        <div class="page-inner">
          ${renderCoverRouteCopy(label, final)}
        </div>
      </section>`;
}

function renderCover() {
  return renderCoverRoute(COVER_ROUTES.find((route) => route.id === book.selectedCoverRoute), { final: true });
}

function renderCoverOptions() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(book.title)} Cover Options</title>
  ${fontLinks()}
  <style>${themeCss()}\n${baseCss}\n${bookCss()}</style>
</head>
<body>
  <main class="book-shell">
    <article class="book">
      ${COVER_ROUTES.map((route) => renderCoverRoute(route)).join("\n")}
    </article>
  </main>
</body>
</html>`;
}

function renderBook() {
  const body = [renderCover(), renderTitlePage(), renderToc(parsed.chapters)];
  let currentPartId = null;

  for (const chapter of parsed.chapters) {
    if (chapter.part && chapter.part.id !== currentPartId) {
      currentPartId = chapter.part.id;
      body.push(renderPartDivider(chapter.part, partNumbers.get(chapter.part.id) ?? 0));
    }
    if (book.chapterOpeners) body.push(renderChapterOpener(chapter));
    body.push(`<div class="chapter-mount" data-chapter-id="${chapter.id}"${chapter.sourceBlockId ? ` data-source-block-id="${escapeHtml(chapter.sourceBlockId)}"` : ""}></div>`);
  }

  const clientChapters = parsed.chapters.map((chapter) => ({
    ...chapter,
    featurePages: compiledPlan.featurePagesByChapter.get(chapter.id) ?? [],
    blocks: chapter.blocks.map(({ expectedText: _expectedText, ...block }) => ({
      ...block,
      ...(compiledPlan.annotations.has(block.sourceBlockId) ? { plan: compiledPlan.annotations.get(block.sourceBlockId) } : {})
    }))
  }));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(book.title)} by ${escapeHtml(book.author)}</title>
  ${fontLinks()}
  <style>${themeCss()}\n${baseCss}\n${bookCss()}</style>
</head>
<body>
  <div class="book-controls screen-only" aria-label="Book controls">
    <button type="button" onclick="window.print()">Print / Save PDF</button>
    <a href="cover-options.html">Cover options</a>
  </div>
  <main class="book-shell">
    <article class="book" id="book" data-require-part-images="${book.requirePartImages ? "true" : "false"}" data-require-diagrams="${book.requireDiagrams ? "true" : "false"}" data-require-feature-pages="${book.requireFeaturePages ? "true" : "false"}">${body.join("\n")}</article>
  </main>
  <script type="application/json" id="book-data">${jsonForHtmlScript({ chapters: clientChapters, sourceManifest: parsed.sourceManifest, bodyColumns: book.bodyColumns, requirePartImages: book.requirePartImages, requireDiagrams: book.requireDiagrams, requireFeaturePages: book.requireFeaturePages })}</script>
  <script>${serializeBookClientProgram()}</script>
</body>
</html>`;
}


const manifestFiles = [manifestEntry, manifestCoverOptions];
const coverAsset = localAssetManifestPath(book.coverImage, "coverImage");
if (coverAsset) manifestFiles.push(coverAsset);
parsed.parts.forEach((part, index) => {
  const asset = localAssetManifestPath(part.image, `partImages[${index + 1}]`);
  if (asset) manifestFiles.push(asset);
});
parsed.assetReferences.forEach((reference, index) => {
  const asset = localAssetManifestPath(reference, `manuscript image ${index + 1}`);
  if (asset) manifestFiles.push(asset);
});
const allowlistedFiles = [...new Set(manifestFiles)];

writeFileSync(outputPath, renderBook());
writeFileSync(coverOptionsPath, renderCoverOptions());
writeFileSync(buildManifestPath, JSON.stringify({
  schemaVersion: 2,
  entry: manifestEntry,
  coverOptions: manifestCoverOptions,
  files: allowlistedFiles,
  cover: {
    asset: coverAsset,
    sha256: coverAssetHash,
    requestHash: expectedCoverRequest.requestHash,
    generationReceiptHash: sha256(coverGenerationReceipt),
    generationId: coverDecision.generationId,
    route: book.selectedCoverRoute,
    subject: book.coverSubject,
    altText: book.coverAltText,
    focalPoint: book.coverFocalPoint,
    format: coverAssetReport.format,
    width: coverAssetReport.width,
    height: coverAssetReport.height,
    frame: coverAssetReport.frame,
    effectiveDpi: coverAssetReport.effectiveDpi,
    minimumDpi: coverAssetReport.minimumDpi
  },
  featurePages: compiledPlan.receipt.featurePages.map(({ id, kind, chapterId, anchorSourceBlockId, sourceBlockIds, title }) => ({ id, kind, chapterId, anchorSourceBlockId, sourceBlockIds, title })),
  source: {
    sha256: parsed.sourceManifest.sha256,
    wordCount: parsed.sourceManifest.totalWords,
    threshold: parsed.sourceManifest.threshold,
    blocks: parsed.sourceManifest.blocks.map(({ id, kind, wordCount, sha256 }) => ({ id, kind, wordCount, sha256 }))
  }
}, null, 2));
writeFileSync(buildSummaryPath, JSON.stringify({
  title: book.title,
  author: book.author,
  chapters: parsed.chapters.length,
  parts: parsed.parts.length,
  sourceWords: wordCount(manuscript),
  outputHtml: relative(outputDir, outputPath),
  cover: {
    asset: coverAsset,
    route: book.selectedCoverRoute,
    width: coverAssetReport.width,
    height: coverAssetReport.height,
    frame: coverAssetReport.frame,
    effectiveDpi: coverAssetReport.effectiveDpi,
    minimumDpi: coverAssetReport.minimumDpi
  },
  featurePages: {
    count: compiledPlan.receipt.featurePages.length,
    kinds: compiledPlan.receipt.featurePages.map((feature) => feature.kind)
  }
}, null, 2));
writeFileSync(sourceInventoryPath, JSON.stringify(createSourceInventory(parsed), null, 2));
writeFileSync(planReceiptPath, JSON.stringify(compiledPlan.receipt, null, 2));
writeFileSync(coverReceiptPath, JSON.stringify({
  schemaVersion: 1,
  requestHash: expectedCoverRequest.requestHash,
  generationReceiptHash: sha256(coverGenerationReceipt),
  manuscriptHash: plan.manuscriptHash,
  generationId: coverDecision.generationId,
  asset: coverAsset,
  sha256: coverAssetHash,
  format: coverAssetReport.format,
  width: coverAssetReport.width,
  height: coverAssetReport.height,
  frame: coverAssetReport.frame,
  effectiveDpi: coverAssetReport.effectiveDpi,
  minimumDpi: coverAssetReport.minimumDpi
}, null, 2));

console.log(JSON.stringify({
  html: outputPath,
  coverOptions: coverOptionsPath,
  manifest: buildManifestPath,
  summary: buildSummaryPath,
  sourceInventory: sourceInventoryPath,
  planReceipt: planReceiptPath,
  coverRequest: coverRequestPath,
  coverGenerationReceipt: coverGenerationReceiptPath,
  coverReceipt: coverReceiptPath,
  sourceWords: wordCount(manuscript),
  chapters: parsed.chapters.length,
  parts: parsed.parts.length
}, null, 2));
