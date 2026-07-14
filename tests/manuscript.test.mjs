import assert from "node:assert/strict";
import test from "node:test";

import { parseManuscript, unicodeSlug } from "../scripts/lib/manuscript.mjs";

test("H3 and H4 headings remain content inside their H2 chapter", () => {
  const parsed = parseManuscript(`# Metadata

## A real chapter

### A section

Section copy.

#### A smaller section

More copy.`);

  assert.equal(parsed.chapters.length, 1);
  assert.equal(parsed.chapters[0].title, "A real chapter");
  assert.deepEqual(parsed.chapters[0].blocks.map((block) => block.type), ["h3", "p", "h4", "p"]);
});

test("an explicit H3 chapter directive creates a chapter without exposing the directive", () => {
  const parsed = parseManuscript(`# Metadata

## Part I: Foundations

### First lesson {chapter}

Lesson prose.

#### Interior section

More prose.`);

  assert.deepEqual(parsed.chapters.map((chapter) => chapter.title), ["First lesson"]);
  assert.equal(parsed.chapters[0].part.id, "part-i-foundations");
  assert.deepEqual(parsed.chapters[0].blocks.map((block) => block.type), ["p", "h4", "p"]);
  assert.doesNotMatch(JSON.stringify(parsed.sourceManifest), /\{chapter\}/u);
});

test("empty H2 chapter containers fail with an actionable error", () => {
  assert.throws(
    () => parseManuscript(`# Metadata

## Empty chapter

## Real chapter

Real prose.`),
    /empty chapter.*Empty chapter/i
  );
});

test("rich Markdown renders through markdown-it while source HTML stays escaped", () => {
  const parsed = parseManuscript(`# Metadata

## Chapter

[A link](https://example.com) and ![useful alt](image.png).

> A quoted idea.

| Name | Value |
| --- | --- |
| One | Two |

\`\`\`js
const answer = 42;
\`\`\`

- first
- second

<script>alert("no")</script>`);
  const html = parsed.chapters[0].blocks.map((block) => block.html).join("\n");

  assert.match(html, /<a href="https:\/\/example\.com">A link<\/a>/);
  assert.match(html, /<img src="image\.png" alt="useful alt">/);
  assert.deepEqual(parsed.assetReferences, ["image.png"]);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<table>/);
  assert.match(html, /<pre><code class="language-js">/);
  assert.match(html, /<ul>/);
  assert.match(html, /&lt;script&gt;alert\(&quot;no&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("Unicode ids are readable, deterministic, and duplicate-safe", () => {
  const manuscript = `# Metadata

## Part I: 世界

## 重複

First.

## 重複

Second.`;
  const first = parseManuscript(manuscript);
  const second = parseManuscript(manuscript);

  assert.equal(unicodeSlug("Crème 世界"), "crème-世界");
  assert.equal(first.parts[0].id, "part-i-世界");
  assert.deepEqual(first.chapters.map((chapter) => chapter.id), ["重複", "重複-2"]);
  assert.deepEqual(first.chapters.map((chapter) => chapter.id), second.chapters.map((chapter) => chapter.id));
  assert.equal(new Set([...first.parts, ...first.chapters].map((item) => item.id)).size, 3);
});

test("source manifest covers every source-bearing node with stable hashes and words", () => {
  const manuscript = `# Metadata

## Part I: Groundwork

## First chapter

### Section

Keep **all** these words.

- one item
- another item`;
  const parsed = parseManuscript(manuscript);
  const allNodes = [...parsed.metadata, ...parsed.parts, ...parsed.chapters, ...parsed.chapters.flatMap((chapter) => chapter.blocks)]
    .filter((node) => node.expectedText !== "");

  assert.ok(allNodes.every((node) => node.sourceBlockId));
  assert.equal(parsed.sourceManifest.blocks.length, allNodes.length);
  assert.equal(parsed.sourceManifest.threshold, 0.9);
  assert.equal(
    parsed.sourceManifest.totalWords,
    parsed.sourceManifest.blocks.reduce((sum, block) => sum + block.wordCount, 0)
  );
  assert.match(parsed.sourceManifest.sha256, /^[a-f0-9]{64}$/);
  assert.equal(parsed.sourceManifest.blocks[0].kind, "metadata");
  assert.ok(parsed.sourceManifest.blocks.every((block) => block.expectedText === block.expectedText.trim()));
  assert.ok(parsed.sourceManifest.blocks.every((block) => /^[a-f0-9]{64}$/.test(block.sha256)));
  assert.deepEqual(parseManuscript(manuscript).sourceManifest, parsed.sourceManifest);
});

test("zero-word structural Markdown stays rendered but outside the word denominator", () => {
  const parsed = parseManuscript("# Metadata\n\n## Chapter\n\nBefore.\n\n---\n\nAfter.");
  const rule = parsed.chapters[0].blocks.find((block) => block.type === "hr");

  assert.ok(rule);
  assert.equal(rule.sourceBlockId, null);
  assert.equal(rule.expectedText, "");
  assert.match(rule.html, /<hr>/);
  assert.ok(parsed.sourceManifest.blocks.every((block) => block.wordCount > 0));
});
