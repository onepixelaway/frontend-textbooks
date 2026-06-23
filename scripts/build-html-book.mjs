#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(scriptDir, "..");
const LETTER_WIDTH_IN = 8.5;
const LETTER_HEIGHT_IN = 11;
const DEFAULT_COVER_BAND_HEIGHT_IN = 3.55;
const SHORT_SINGLE_CHAR_LIMIT = 1300;
const DEFAULT_THEME = {
  browser: "#d7d7d3", page: "#fbfaf6", ink: "#10131A", heading: "#0A3695", deck: "#19419A", muted: "#2C3342", meta: "#69738F", accent: "#4F76D9", soft: "#B7C8F3", rule: "#9BB2EA", steel: "#19419A", coverBand: "#0A3695", callout: "#f1f5ff",
  display: '"Poppins", "Avenir Next", Helvetica, Arial, sans-serif', body: '"Halant", Georgia, serif', ui: '"Poppins", "Avenir Next", Helvetica, Arial, sans-serif'
};
const THEMES = {
  default: DEFAULT_THEME,
  executive: DEFAULT_THEME,
  "field-guide": {
    browser: "#c7c0ad", page: "#f7f1e5", ink: "#202018", muted: "#657060", accent: "#3f6f46", steel: "#1f2d22",
    display: '"Avenir Next", Inter, Helvetica, Arial, sans-serif', body: 'Georgia, "Times New Roman", serif', ui: '"Avenir Next", Inter, Helvetica, Arial, sans-serif'
  },
  scholarly: {
    browser: "#d9d2c4", page: "#fbf7ed", ink: "#191714", muted: "#6f6659", accent: "#8d2f24", steel: "#15130f",
    display: 'Georgia, "Times New Roman", serif', body: 'Georgia, "Times New Roman", serif', ui: '"Avenir Next", Inter, Helvetica, Arial, sans-serif'
  },
  technical: {
    browser: "#c9d0d2", page: "#ffffff", ink: "#15191d", muted: "#5b6770", accent: "#0b6fa4", steel: "#0e2638",
    display: 'Arial, Helvetica, sans-serif', body: 'Arial, Helvetica, sans-serif', ui: 'Arial, Helvetica, sans-serif'
  },
  literary: {
    browser: "#d3ccc0", page: "#fcfaf5", ink: "#1b1814", muted: "#6e675f", accent: "#6c2d2a", steel: "#1b1814",
    display: 'Georgia, "Times New Roman", serif', body: 'Georgia, "Times New Roman", serif', ui: '"Avenir Next", Inter, Helvetica, Arial, sans-serif'
  }
};
const STYLE_NAMES = Object.keys(THEMES);
const BODY_COLUMN_CLASSES = ["text-two", "text-single", "text-three"];

function numberInRange(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function usage() {
  console.error(`Usage: node scripts/build-html-book.mjs <book.json> <manuscript.md>

book.json fields:
  title        required
  author       required
  subtitle     optional
  outputDir    optional, default: directory containing book.json
  outputHtml   optional, default: index.html
  coverImage   optional, path or URL as it should appear from outputHtml
               with the default band, split-cover art slot is ${LETTER_WIDTH_IN}in x ${(LETTER_HEIGHT_IN - DEFAULT_COVER_BAND_HEIGHT_IN).toFixed(2)}in, aspect ${(LETTER_WIDTH_IN / (LETTER_HEIGHT_IN - DEFAULT_COVER_BAND_HEIGHT_IN)).toFixed(2)}:1
  coverBandHeight optional inches for the bottom cover band, default 3.55
  requirePartImages optional boolean; defaults to true when coverImage is set and the manuscript has parts
  requireDiagrams optional boolean; defaults to true for designed nonfiction, false for plain/literary reader editions
  chapterOpeners optional boolean; default false. When false, chapters start directly on text pages.
  chapterClosers optional object keyed by chapter id, title, or number for generated chapter-close copy
  partImages   optional object keyed by part id, title, label, or number for generated part-divider art; if provided, must cover every part and use unique values
  style         optional: ${STYLE_NAMES.join(" | ")}
  bodyColumns   optional: ${BODY_COLUMN_CLASSES.join(" | ")}, default: text-two
`);
  process.exit(1);
}

const [configPathArg, manuscriptPathArg] = process.argv.slice(2);
if (!configPathArg || !manuscriptPathArg) usage();

const configPath = resolve(configPathArg);
const manuscriptPath = resolve(manuscriptPathArg);
const config = JSON.parse(readFileSync(configPath, "utf8"));
const manuscript = readFileSync(manuscriptPath, "utf8");
const outputDir = resolve(config.outputDir ?? dirname(configPath));
const outputHtml = config.outputHtml ?? "index.html";
const outputPath = resolve(outputDir, outputHtml);
const baseCss = readFileSync(resolve(skillDir, "page-base.css"), "utf8");

mkdirSync(outputDir, { recursive: true });

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
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

function defaultRequireDiagrams(config) {
  const style = plainText(config.style ?? "").toLowerCase();
  const type = plainText(config.bookType ?? "").toLowerCase();
  const title = plainText(config.title ?? "").toLowerCase();
  const combined = `${style} ${type} ${title}`;
  if (/\b(plain|literary|reader|novel|fiction|poetry|memoir|essay collection)\b/.test(combined)) return false;
  return true;
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

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function wordCount(value) {
  const text = String(value ?? "").replace(/[#*_>`-]/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(/\s+/).length : 0;
}

function parseManuscript(markdown) {
  const blocks = markdown.trim().split(/\n\s*\n/);
  const parts = [];
  const chapters = [];
  let currentPart = null;
  let currentChapter = null;
  let chapterCounter = 0;

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (!block) continue;

    if (/^##\s+Part\b/i.test(block)) {
      const label = block.replace(/^##\s+/, "");
      currentPart = {
        id: slugify(label),
        label: label.split(":")[0],
        title: label.replace(/^Part\s+[IVXLC0-9]+:\s*/i, "")
      };
      parts.push(currentPart);
      continue;
    }

    if (block.startsWith("## ")) {
      const title = block.replace(/^##\s+/, "");
      currentChapter = {
        id: slugify(title) || "introduction",
        number: /^introduction\b/i.test(title) ? "Introduction" : String(++chapterCounter),
        sortNumber: chapterCounter,
        title,
        part: currentPart,
        blocks: []
      };
      chapters.push(currentChapter);
      continue;
    }

    if (block.startsWith("### ")) {
      const heading = block.replace(/^###\s+/, "");
      const match = heading.match(/^(\d+)\.\s*(.+)$/);
      const number = match ? match[1] : String(++chapterCounter);
      chapterCounter = Math.max(chapterCounter, Number(number) || chapterCounter);
      currentChapter = {
        id: `chapter-${String(number).padStart(2, "0")}`,
        number,
        sortNumber: Number(number) || chapterCounter,
        title: match ? match[2] : heading,
        part: currentPart,
        blocks: []
      };
      chapters.push(currentChapter);
      continue;
    }

    if (!currentChapter) {
      currentChapter = {
        id: "front-note",
        number: "Opening",
        sortNumber: -1,
        title: "Opening",
        part: null,
        blocks: []
      };
      chapters.push(currentChapter);
    }

    if (block.startsWith("#### ")) {
      currentChapter.blocks.push({ type: "h3", html: inlineMarkdown(block.replace(/^####\s+/, "")) });
      continue;
    }

    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const orderedLines = lines.length > 1 && lines.every((line) => /^\d+\.\s+/.test(line));
    const bulletLines = lines.length > 1 && lines.every((line) => /^[-*]\s+/.test(line));

    if (orderedLines) {
      for (const line of lines) {
        const [, marker, text] = line.match(/^(\d+)\.\s+(.+)$/);
        currentChapter.blocks.push({ type: "numbered", marker, html: inlineMarkdown(text) });
      }
      continue;
    }

    if (bulletLines) {
      for (const line of lines) {
        currentChapter.blocks.push({ type: "bullet", html: inlineMarkdown(line.replace(/^[-*]\s+/, "")) });
      }
      continue;
    }

    currentChapter.blocks.push({ type: "p", html: inlineMarkdown(block.replace(/\n/g, " ")) });
  }

  return { parts, chapters };
}

const configMaps = {
  chapterClosers: normalizeMap(config.chapterClosers, "chapterClosers"),
  partImages: normalizeMap(config.partImages, "partImages", trimmedText)
};

const parsed = parseManuscript(manuscript);
if (!parsed.chapters.length) throw new Error("No chapters found in manuscript.");

const coverImage = trimmedText(config.coverImage);
const book = {
  title: plainText(config.title),
  subtitle: plainText(config.subtitle ?? ""),
  author: plainText(config.author),
  bookType: plainText(config.bookType ?? "Book"),
  coverKicker: plainText(config.coverKicker ?? "A book"),
  coverImage,
  coverBandHeight: numberInRange(config.coverBandHeight, DEFAULT_COVER_BAND_HEIGHT_IN, 2.8, 4.4),
  requirePartImages: booleanValue(config.requirePartImages, "requirePartImages", Boolean(coverImage && parsed.parts.length)),
  requireDiagrams: booleanValue(config.requireDiagrams, "requireDiagrams", defaultRequireDiagrams(config)),
  chapterOpeners: booleanValue(config.chapterOpeners, "chapterOpeners", false),
  style: enumValue(config.style, "style", STYLE_NAMES, "default"),
  bodyColumns: enumValue(config.bodyColumns, "bodyColumns", BODY_COLUMN_CLASSES, "text-two")
};

if (!book.title || !book.author) throw new Error("book.json must include non-empty title and author.");

function firstParagraph(chapter) {
  return chapter.blocks.find((block) => block.type === "p")?.html ?? "";
}

function excerpt(chapter, words = 42) {
  const text = plainText(firstParagraph(chapter));
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
  const sample = plainText(firstParagraph(chapter)) || chapter.title;
  return sample.split(/(?<=[.!?])\s+/).find((part) => part.length > 48) || chapter.title;
}

parsed.parts.forEach((part, index) => {
  const image = lookupMap(configMaps.partImages, partLookupKeys(part, index));
  if (image) part.image = image;
});
assertCompletePartImages(parsed.parts, hasMapEntries(configMaps.partImages), book.requirePartImages);
assertUniquePartImages(parsed.parts);
assertPartImagesDoNotReuseCover(parsed.parts, book.coverImage);
const partNumbers = new Map(parsed.parts.map((part, index) => [part.id, index + 1]));

for (const chapter of parsed.chapters) {
  const closer = lookupMap(configMaps.chapterClosers, chapterLookupKeys(chapter));
  chapter.tailText = clipText(closer || sourceTailText(chapter));
}

function coverBackground() {
  if (!book.coverImage) return "";
  return `background-image: ${cssUrl(book.coverImage)};`;
}

function fontLinks() {
  return `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Halant:wght@400;500;600&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">`;
}

function themeCss() {
  const theme = THEMES[book.style] ?? DEFAULT_THEME;
  const heading = theme.heading ?? theme.ink;
  const deck = theme.deck ?? theme.steel;
  const muted = theme.muted;
  const meta = theme.meta ?? muted;
  const accent = theme.accent ?? deck;
  const soft = theme.soft ?? theme.rule ?? muted;
  const rule = theme.rule ?? `color-mix(in srgb, ${muted} 28%, ${theme.page})`;
  const callout = theme.callout ?? `color-mix(in srgb, ${theme.page} 84%, ${muted})`;
  const coverBandHeight = book.coverBandHeight.toFixed(2);
  const coverArtHeight = (LETTER_HEIGHT_IN - book.coverBandHeight).toFixed(2);
  const coverArtAspect = (LETTER_WIDTH_IN / (LETTER_HEIGHT_IN - book.coverBandHeight)).toFixed(3);
  return `
:root {
  --browser-bg: ${theme.browser};
  --page-bg: ${theme.page};
  --ink: ${theme.ink};
  --heading-ink: ${heading};
  --deck-ink: ${deck};
  --muted-ink: ${muted};
  --label-ink: ${meta};
  --running-ink: ${meta};
  --accent: ${accent};
  --soft-accent: ${soft};
  --steel: ${theme.steel ?? deck};
  --cover-band: ${theme.coverBand ?? heading};
  --cover-band-height: ${coverBandHeight}in;
  --cover-art-height: ${coverArtHeight}in;
  --cover-art-aspect: ${coverArtAspect};
  --rule: ${rule};
  --callout-bg: ${callout};
  --font-display: ${theme.display};
  --font-body: ${theme.body};
  --font-ui: ${theme.ui};
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
.cover { background: var(--cover-band, var(--heading-ink)); }
.cover .page-inner { position: absolute; z-index: 2; left: 0; right: 0; bottom: 0; height: var(--cover-band-height); min-height: var(--cover-band-height); display: grid; align-content: center; padding: 0.48in 0.62in 0.56in; color: #fff; background: var(--cover-band, var(--heading-ink)); }
.cover-image { position: absolute; inset: 0 0 var(--cover-band-height) 0; background: linear-gradient(135deg, color-mix(in srgb, var(--page-bg) 84%, white), color-mix(in srgb, var(--soft-accent) 18%, var(--page-bg))); background-size: cover; background-position: center; ${coverBackground()} }
.cover-kicker, .chapter-kicker, .part-label, .model-label { font-family: var(--font-ui); font-size: 8pt; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase; color: var(--label-ink); }
.cover-kicker { color: #fff; }
.cover-kicker::after { content: ""; display: block; width: 0.62in; height: 0.06in; margin: 0.14in 0 0.18in; background: var(--accent); }
.cover-title { max-width: 6.8in; margin: 0; font-size: 44pt; line-height: 0.94; color: #fff; text-shadow: none; }
.cover-subtitle { max-width: 6.3in; margin: 0.18in 0 0; font-family: var(--font-ui); font-size: 12pt; font-weight: 700; line-height: 1.35; color: #fff; }
.cover-author { margin-top: 0.3in; font-family: var(--font-ui); font-size: 8pt; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; color: #fff; }
.title-grid { display: grid; grid-template-rows: auto 1fr auto; }
.title-grid h1 { align-self: end; max-width: 6in; font-size: 56pt; }
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
.option-cover .page-inner { position: relative; z-index: 2; display: grid; grid-template-rows: auto 1fr auto auto; padding: 0.7in; }
.option-cover h1 { align-self: end; max-width: 6.4in; font-size: 70pt; line-height: 0.9; }
.option-subtitle, .option-author, .cover-route-label { font-family: var(--font-ui); }
.route-type { background: var(--ink); color: #fff; }
.route-type h1, .route-type p { color: #fff; }
.route-symbol-mark { position: absolute; inset: 0.8in; display: grid; grid-template-columns: 1fr 0.32in 1fr; gap: 0.18in; }
.route-symbol-mark span { border: 2px solid var(--ink); }
.route-symbol-mark span:nth-child(2) { background: var(--accent); border-color: var(--accent); }
.route-photo { color: #fff; background: var(--cover-band, var(--heading-ink)); }
.route-photo .page-inner { position: absolute; left: 0; right: 0; bottom: 0; height: var(--cover-band-height); min-height: var(--cover-band-height); background: var(--cover-band, var(--heading-ink)); color: #fff; }
.route-photo h1, .route-photo p { color: #fff; }
.route-photo-image { position: absolute; inset: 0 0 var(--cover-band-height) 0; background: ${book.coverImage ? `${cssUrl(book.coverImage)} center/cover no-repeat` : "linear-gradient(135deg, var(--page-bg), var(--soft-accent))"}; }
.route-minimal-mark { position: absolute; right: 0.7in; top: 0.7in; width: 1.1in; height: 7.7in; background: var(--accent); }
@media screen and (max-width: 920px) {
  .book { gap: 0; }
  .page { margin-bottom: 18px; }
  .text-page { margin-bottom: 0; }
  .cover .page-inner, .route-photo .page-inner { position: relative; height: auto; min-height: 0; }
  .part-divider.has-part-image .page-inner { height: auto; min-height: 0; grid-template-rows: auto auto; }
  .cover-image, .route-photo-image, .part-image-frame { position: relative; display: block; min-height: 72vw; inset: auto; }
  .cover-title, .title-grid h1, .part-divider h1, .chapter-title, .option-cover h1 { font-size: 38pt; }
}`;
}

function renderCover() {
  return `
<section class="page cover" id="cover" aria-label="Cover">
  <div class="cover-image" aria-hidden="true"></div>
  <div class="page-inner">
    <p class="cover-kicker no-indent">${escapeHtml(book.coverKicker)}</p>
    <h1 class="cover-title">${escapeHtml(book.title)}</h1>
    ${book.subtitle ? `<p class="cover-subtitle no-indent">${escapeHtml(book.subtitle)}</p>` : ""}
    <p class="cover-author no-indent">by ${escapeHtml(book.author)}</p>
  </div>
</section>`;
}

function renderTitlePage() {
  return `
<section class="page title-page" id="title-page" aria-label="Title page">
  <div class="page-inner title-grid">
    <p class="chapter-kicker no-indent">${escapeHtml(book.bookType)}</p>
    <div>
      <h1>${escapeHtml(book.title)}</h1>
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
        <span>${chapter.number === "Introduction" ? "Introduction" : `Chapter ${chapter.number}`}</span>
        <span>${escapeHtml(chapter.title.replace(/^Introduction:\s*/, ""))}</span>
        <span data-toc-page-for="${chapter.id}"></span>
      </li>`).join("")}
    </ol>
  </div>
</section>`;
}

function renderPartCopy(part, index) {
  return `
    <p class="part-label no-indent">${escapeHtml(part.label)}</p>
    <h1>${escapeHtml(part.title)}</h1>
    <div class="part-number">${String(index).padStart(2, "0")}</div>`;
}

function renderPartDivider(part, index) {
  if (part.image) {
    return `
<section class="page part-divider has-part-image" id="${part.id}" aria-label="${escapeHtml(part.label)}">
  <div class="page-inner">
    <figure class="part-image-frame">
      <img src="${escapeHtml(part.image)}" alt="${escapeHtml(`Editorial image for ${part.title}`)}">
    </figure>
    <div class="part-divider-copy">
      ${renderPartCopy(part, index)}
    </div>
  </div>
</section>`;
  }
  return `
<section class="page part-divider" id="${part.id}" aria-label="${escapeHtml(part.label)}">
  <div class="page-inner">
    ${renderPartCopy(part, index)}
  </div>
</section>`;
}

function renderChapterOpener(chapter) {
  return `
<section class="page chapter-opener" id="${chapter.id}-opener" data-allow-opening-spread="true" aria-label="${escapeHtml(chapter.title)} opener">
  <div class="page-inner">
    <p class="chapter-kicker no-indent">${chapter.number === "Introduction" ? "Introduction" : `Chapter ${chapter.number}`}</p>
    <h1 class="chapter-title">${escapeHtml(chapter.title)}</h1>
    <p class="chapter-summary no-indent">${escapeHtml(excerpt(chapter, 44))}</p>
    <div class="opener-axis" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
  </div>
</section>`;
}

function renderCoverRouteCopy(label) {
  return `
          <p class="cover-route-label no-indent">${escapeHtml(label)}</p>
          <h1>${escapeHtml(book.title)}</h1>
          ${book.subtitle ? `<p class="option-subtitle no-indent">${escapeHtml(book.subtitle)}</p>` : ""}
          <p class="option-author no-indent">by ${escapeHtml(book.author)}</p>`;
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
      <section class="page option-cover route-type">
        <div class="page-inner">
          ${renderCoverRouteCopy("Type as image")}
        </div>
      </section>
      <section class="page option-cover route-symbol">
        <div class="route-symbol-mark" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="page-inner">
          ${renderCoverRouteCopy("Conceptual symbol")}
        </div>
      </section>
      <section class="page option-cover route-photo">
        <div class="route-photo-image" aria-hidden="true"></div>
        <div class="page-inner">
          ${renderCoverRouteCopy(`Editorial image route${book.coverImage ? " / candidate" : ""}`)}
        </div>
      </section>
      <section class="page option-cover route-minimal">
        <div class="route-minimal-mark" aria-hidden="true"></div>
        <div class="page-inner">
          ${renderCoverRouteCopy("High-contrast minimal")}
        </div>
      </section>
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
    body.push(`<div class="chapter-mount" data-chapter-id="${chapter.id}"></div>`);
  }

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
    <article class="book" id="book" data-require-part-images="${book.requirePartImages ? "true" : "false"}" data-require-diagrams="${book.requireDiagrams ? "true" : "false"}">${body.join("\n")}</article>
  </main>
  <script type="application/json" id="book-data">${jsonForHtmlScript({ chapters: parsed.chapters, bodyColumns: book.bodyColumns, requirePartImages: book.requirePartImages, requireDiagrams: book.requireDiagrams })}</script>
  <script>${clientScript()}</script>
</body>
</html>`;
}

function clientScript() {
  return `
const bookData = JSON.parse(document.getElementById("book-data").textContent);

function blockNode(block) {
  if (block.type === "h3") {
    const node = document.createElement("h3");
    node.innerHTML = block.html;
    return node;
  }
  const node = document.createElement("p");
  if (block.type === "numbered") {
    node.className = "numbered-item";
    node.innerHTML = "<span>" + block.marker + ".</span><span>" + block.html + "</span>";
  } else if (block.type === "bullet") {
    node.className = "bullet-item";
    node.innerHTML = "<span>-</span><span>" + block.html + "</span>";
  } else {
    node.innerHTML = block.html;
  }
  return node;
}

function appendText(parent, tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function paginationUnits(nodes) {
  const units = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const block = nodes[index];
    if (block.matches("h3") && nodes[index + 1]) {
      const wrapper = document.createElement("div");
      wrapper.className = "keep-with-next";
      wrapper.appendChild(block);
      wrapper.appendChild(nodes[index + 1]);
      units.push(wrapper);
      index += 1;
    } else {
      units.push(block);
    }
  }
  return units;
}

function overflows(frame) {
  return frame.scrollHeight > frame.clientHeight + 1 || frame.scrollWidth > frame.clientWidth + 1;
}

const SHORT_SINGLE_CHAR_LIMIT = ${SHORT_SINGLE_CHAR_LIMIT};

function frameText(frame) {
  return (frame?.textContent || "").replace(/\\s+/g, " ").trim();
}

function frameWordCount(frame) {
  const text = frameText(frame);
  return text ? text.split(/\\s+/).length : 0;
}

function hasRichFrameContent(frame) {
  return Boolean(frame?.querySelector("figure, table, .diagram-card, .comparison-diagram, .callout, .span-all"));
}

function applyShortSingleMeasure(page, frame) {
  const chars = frameText(frame).length;
  if (!page || !frame || chars === 0 || chars > SHORT_SINGLE_CHAR_LIMIT || hasRichFrameContent(frame)) return false;
  page.classList.add("text-short-single");
  if (overflows(frame)) {
    page.classList.remove("text-short-single");
    return false;
  }
  return true;
}

function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function tailFurnitureOverlaps(page) {
  const frame = page?.querySelector(".text-frame");
  const tail = page?.querySelector(".tail-furniture");
  if (!frame || !tail) return false;
  const tailRect = tail.getBoundingClientRect();
  return [...frame.children].some((node) => {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && intersects(rect, tailRect);
  });
}

function removeTailFurniture(page) {
  page.querySelector(".tail-furniture")?.remove();
  page.classList.remove("has-tail-furniture");
}

function addTailFurniture(chapter, page, frame) {
  if (!chapter.tailText) return false;
  page.classList.add("has-tail-furniture");
  const aside = document.createElement("aside");
  aside.className = "tail-furniture";
  aside.setAttribute("aria-hidden", "true");
  const wrapper = document.createElement("div");
  const label = document.createElement("p");
  label.className = "tail-label no-indent";
  label.textContent = "Chapter close";
  const quote = document.createElement("p");
  quote.className = "tail-quote no-indent";
  quote.textContent = chapter.tailText;
  wrapper.appendChild(label);
  wrapper.appendChild(quote);
  aside.appendChild(wrapper);
  page.querySelector(".page-inner").appendChild(aside);
  if (overflows(frame) || tailFurnitureOverlaps(page)) {
    removeTailFurniture(page);
    return false;
  }
  return true;
}

function paginateChapter(chapter, mount) {
  const units = paginationUnits(chapter.blocks.map(blockNode));
  let page;
  let frame;
  let count = 0;
  const pages = [];
  function newPage() {
    count += 1;
    page = document.createElement("section");
    page.className = "page text-page " + (bookData.bodyColumns || "text-two");
    if (count === 1) {
      page.id = chapter.id;
      page.dataset.firstTextPageFor = chapter.id;
    }
    page.setAttribute("aria-label", chapter.title + (count > 1 ? " continued" : ""));
    const partLabel = chapter.part ? chapter.part.label : "Opening";
    const inner = document.createElement("div");
    inner.className = "page-inner";
    const header = document.createElement("header");
    header.className = "text-page-header";
    const kicker = appendText(header, "p", "chapter-kicker no-indent", chapter.number === "Introduction" ? "Introduction" : "Chapter " + chapter.number);
    kicker.append(" ");
    appendText(kicker, "span", "", partLabel);
    appendText(header, "h1", "text-page-title", chapter.title);
    frame = document.createElement("div");
    frame.className = "text-frame";
    inner.appendChild(header);
    inner.appendChild(frame);
    page.appendChild(inner);
    mount.appendChild(page);
    pages.push(page);
  }

  newPage();
  for (const unit of units) {
    frame.appendChild(unit);
    if (overflows(frame)) {
      frame.removeChild(unit);
      newPage();
      frame.appendChild(unit);
      if (overflows(frame)) throw new Error("A manuscript block is too large for a text page in " + chapter.title);
    }
  }

  const lastPage = pages[pages.length - 1];
  const lastFrame = lastPage?.querySelector(".text-frame");
  if (lastPage && lastFrame) {
    applyShortSingleMeasure(lastPage, lastFrame);
    if (frameWordCount(lastFrame) < 640 && !overflows(lastFrame)) {
      addTailFurniture(chapter, lastPage, lastFrame);
    }
  }
}

function addPageNumbers() {
  document.querySelectorAll(".page-number").forEach((node) => node.remove());
  const pages = [...document.querySelectorAll(".page")];
  pages.forEach((page, index) => {
    if (page.classList.contains("cover")) return;
    const number = document.createElement("div");
    number.className = "page-number";
    number.textContent = String(index + 1);
    page.querySelector(".page-inner")?.appendChild(number);
  });
  document.querySelectorAll("[data-toc-page-for]").forEach((node) => {
    const target = document.getElementById(node.dataset.tocPageFor);
    const pageNumber = pages.indexOf(target) + 1;
    node.textContent = pageNumber > 0 ? String(pageNumber) : "";
  });
}

function checkOverflow() {
  const offenders = [...document.querySelectorAll(".text-frame")].filter(overflows);
  if (offenders.length) {
    document.documentElement.dataset.overflow = String(offenders.length);
    throw new Error(offenders.length + " text frames overflow");
  }
  const tailOffenders = [...document.querySelectorAll(".text-page")].filter(tailFurnitureOverlaps);
  if (tailOffenders.length) {
    document.documentElement.dataset.tailOverlap = String(tailOffenders.length);
    throw new Error(tailOffenders.length + " tail furniture block(s) overlap text");
  }
}

try {
  for (const chapter of bookData.chapters) {
    const mount = document.querySelector('[data-chapter-id="' + chapter.id + '"]');
    if (mount) paginateChapter(chapter, mount);
  }
  addPageNumbers();
  checkOverflow();
  window.__BOOK_READY = true;
} catch (error) {
  window.__BOOK_READY = false;
  window.__BOOK_ERROR = error.message;
  console.error(error);
}`;
}

writeFileSync(outputPath, renderBook());
writeFileSync(resolve(outputDir, "cover-options.html"), renderCoverOptions());
writeFileSync(resolve(outputDir, "book-build-summary.json"), JSON.stringify({
  title: book.title,
  author: book.author,
  chapters: parsed.chapters.length,
  parts: parsed.parts.length,
  sourceWords: wordCount(manuscript),
  outputHtml: relative(process.cwd(), outputPath),
  generatedAt: new Date().toISOString()
}, null, 2));

console.log(JSON.stringify({
  html: outputPath,
  coverOptions: resolve(outputDir, "cover-options.html"),
  summary: resolve(outputDir, "book-build-summary.json"),
  sourceWords: wordCount(manuscript),
  chapters: parsed.chapters.length,
  parts: parsed.parts.length
}, null, 2));
