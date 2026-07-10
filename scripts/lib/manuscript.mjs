import { createHash } from "node:crypto";

import MarkdownIt from "markdown-it";

const SOURCE_PRESERVATION_THRESHOLD = 0.9;

const markdown = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false
});

function normalizeSourceText(value) {
  return String(value ?? "").normalize("NFC").replace(/\s+/gu, " ").trim();
}

export function wordCount(value) {
  const text = normalizeSourceText(value);
  return text ? text.split(/\s+/u).length : 0;
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

export function unicodeSlug(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("und")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function createUniqueIdAllocator() {
  const counts = new Map();
  return (value, fallback = "section") => {
    const base = unicodeSlug(value) || unicodeSlug(fallback) || "section";
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  };
}

function inlineTokenText(token) {
  if (token.type === "softbreak" || token.type === "hardbreak") return " ";
  if (token.type === "text" || token.type === "code_inline") return token.content;
  if (token.type === "image") {
    return token.children?.map(inlineTokenText).join("") || token.content;
  }
  return token.children?.map(inlineTokenText).join("") ?? "";
}

function tokensText(tokens) {
  const text = [];
  for (const token of tokens) {
    if (token.type === "inline") {
      text.push(token.children?.map(inlineTokenText).join("") ?? token.content);
    } else if (token.type === "fence" || token.type === "code_block") {
      text.push(token.content);
    }
  }
  return normalizeSourceText(text.join(" "));
}

function collectImageReferences(tokens, references) {
  for (const token of tokens) {
    if (token.type === "image") {
      const source = token.attrGet("src");
      if (source) references.add(source);
    }
    if (token.children?.length) collectImageReferences(token.children, references);
  }
}

function topLevelGroups(tokens) {
  const groups = [];
  for (let index = 0; index < tokens.length;) {
    const start = index;
    const first = tokens[index];
    if (first.level !== 0) {
      index += 1;
      continue;
    }
    if (first.nesting === 1) {
      index += 1;
      while (index < tokens.length) {
        const token = tokens[index];
        index += 1;
        if (token.level === 0 && token.nesting === -1) break;
      }
    } else {
      index += 1;
    }
    groups.push(tokens.slice(start, index));
  }
  return groups;
}

function blockType(tokens) {
  const token = tokens[0];
  if (token.type === "heading_open") return token.tag;
  if (token.type === "paragraph_open") return "p";
  if (token.type === "bullet_list_open") return "bullet-list";
  if (token.type === "ordered_list_open") return "numbered-list";
  if (token.type === "blockquote_open") return "blockquote";
  if (token.type === "table_open") return "table";
  if (token.type === "fence" || token.type === "code_block") return "code";
  return token.type.replace(/_open$/u, "").replace(/_/gu, "-");
}

function sourceRecordFactory() {
  const allocate = createUniqueIdAllocator();
  const records = [];
  function create(kind, expectedText) {
    const normalized = normalizeSourceText(expectedText);
    const digest = sha256(`${kind}\0${normalized}`);
    const id = allocate(`source-${kind}-${digest.slice(0, 12)}`, `source-${kind}`);
    const record = {
      id,
      kind,
      expectedText: normalized,
      wordCount: wordCount(normalized),
      sha256: sha256(normalized)
    };
    records.push(record);
    return record;
  }
  return { create, records };
}

function partFields(title) {
  const separator = title.indexOf(":");
  if (separator === -1) {
    return {
      label: title.match(/^Part\s+\S+/iu)?.[0] ?? "Part",
      title: title.replace(/^Part\s+/iu, "") || title
    };
  }
  return {
    label: title.slice(0, separator).trim(),
    title: title.slice(separator + 1).trim() || title
  };
}

export function parseManuscript(source) {
  const markdownSource = String(source ?? "").replace(/\r\n?/gu, "\n");
  const env = {};
  const groups = topLevelGroups(markdown.parse(markdownSource, env));
  const allocateStructuralId = createUniqueIdAllocator();
  const sourceRecords = sourceRecordFactory();
  const assetReferences = new Set();
  const metadata = [];
  const parts = [];
  const chapters = [];
  let currentPart = null;
  let currentChapter = null;
  let chapterCounter = 0;

  function addImplicitChapter() {
    currentChapter = {
      id: allocateStructuralId("front-note", `front-note-${chapters.length + 1}`),
      number: "Opening",
      sortNumber: -1,
      title: "Opening",
      part: currentPart,
      blocks: [],
      sourceBlockId: null
    };
    chapters.push(currentChapter);
  }

  for (const tokens of groups) {
    const first = tokens[0];
    const expectedText = tokensText(tokens);
    collectImageReferences(tokens, assetReferences);

    if (first.type === "heading_open" && first.tag === "h1") {
      const sourceRecord = sourceRecords.create("metadata", expectedText);
      metadata.push({ title: expectedText, sourceBlockId: sourceRecord.id });
      continue;
    }

    if (first.type === "heading_open" && first.tag === "h2") {
      if (/^Part(?:\s|$)/iu.test(expectedText)) {
        const sourceRecord = sourceRecords.create("part", expectedText);
        currentPart = {
          id: allocateStructuralId(expectedText, `part-${parts.length + 1}`),
          ...partFields(expectedText),
          sourceBlockId: sourceRecord.id
        };
        parts.push(currentPart);
        currentChapter = null;
        continue;
      }

      const isIntroduction = /^Introduction\b/iu.test(expectedText);
      if (!isIntroduction) chapterCounter += 1;
      const sourceRecord = sourceRecords.create("chapter", expectedText);
      currentChapter = {
        id: allocateStructuralId(expectedText, `chapter-${String(chapters.length + 1).padStart(2, "0")}`),
        number: isIntroduction ? "Introduction" : String(chapterCounter),
        sortNumber: chapterCounter,
        title: expectedText,
        part: currentPart,
        blocks: [],
        sourceBlockId: sourceRecord.id
      };
      chapters.push(currentChapter);
      continue;
    }

    if (!currentChapter) addImplicitChapter();
    const type = blockType(tokens);
    const sourceRecord = expectedText ? sourceRecords.create(type, expectedText) : null;
    currentChapter.blocks.push({
      type,
      html: markdown.renderer.render(tokens, markdown.options, env).trim(),
      expectedText: sourceRecord?.expectedText ?? "",
      sourceBlockId: sourceRecord?.id ?? null
    });
  }

  const normalizedSource = markdownSource.normalize("NFC");
  const blocks = sourceRecords.records;
  return {
    metadata,
    parts,
    chapters,
    assetReferences: [...assetReferences],
    sourceManifest: {
      sha256: sha256(normalizedSource),
      threshold: SOURCE_PRESERVATION_THRESHOLD,
      totalWords: blocks.reduce((total, block) => total + block.wordCount, 0),
      blocks
    }
  };
}
