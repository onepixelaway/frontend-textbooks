import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePdfTextCandidates, sourceBlockCoverage, sourceBlockPresence, sourceTokenCoverage } from "../scripts/lib/pdf-structure.mjs";

test("PDF source coverage recovers after a letter-spaced heading extraction mismatch", () => {
  const blocks = [
    { expectedText: "Small Systems" },
    { expectedText: "Part I: Notice" },
    { expectedText: "A useful system begins here" }
  ];
  const extracted = "Small Systems PA R T I Notice A useful system begins here";
  assert.equal(sourceTokenCoverage(blocks, extracted), 1);
});

test("PDF source coverage normalizes punctuation without losing block order", () => {
  const blocks = [{ expectedText: "Notice, frame, choose—and review." }];
  assert.equal(sourceTokenCoverage(blocks, "Notice frame choose and review"), 1);
  assert.equal(sourceTokenCoverage(blocks, "review choose frame notice and"), 0);
});

test("PDF source coverage tolerates words split by extraction line wrapping", () => {
  const blocks = [{ expectedText: "Preservation remains deterministic" }];
  assert.equal(sourceTokenCoverage(blocks, "preser vation remains deter ministic"), 1);
});

test("PDF preservation reports exact block and word coverage", () => {
  const blocks = Array.from({ length: 10 }, (_, index) => ({
    id: `block-${index + 1}`,
    expectedText: `Distinct source block ${index + 1} remains intact`
  }));
  const extracted = blocks.slice(0, 9).map((block) => block.expectedText).join(" ");
  const coverage = sourceBlockCoverage(blocks, extracted);

  assert.equal(coverage.matchedBlocks, 9);
  assert.equal(coverage.totalBlocks, 10);
  assert.equal(coverage.blockRatio, 0.9);
  assert.equal(coverage.wordRatio, 0.9);
  assert.deepEqual(coverage.missingBlockIds, ["block-10"]);
});

test("PDF preservation cannot hide many missing blocks behind plausible total text", () => {
  const blocks = Array.from({ length: 20 }, (_, index) => ({
    id: `block-${index + 1}`,
    expectedText: `Required prose segment ${index + 1}`
  }));
  const extracted = [
    ...blocks.slice(0, 17).map((block) => block.expectedText),
    "A great deal of unrelated duplicated navigation and decorative text ".repeat(40)
  ].join(" ");
  const coverage = sourceBlockCoverage(blocks, extracted);

  assert.equal(coverage.blockRatio, 0.85);
  assert.equal(coverage.missingBlockIds.length, 3);
  assert.ok(coverage.blockRatio < 0.9);
});

test("two-column extraction may pass through content-stream order without weakening manuscript order", () => {
  const blocks = [
    { id: "a", expectedText: "Alpha paragraph stays entirely together" },
    { id: "b", expectedText: "Beta paragraph follows alpha in manuscript order" },
    { id: "c", expectedText: "Gamma paragraph remains the final source block" }
  ];
  const result = evaluatePdfTextCandidates(blocks, [
    { method: "reading-order", text: "Alpha paragraph Beta paragraph stays follows entirely alpha together in manuscript order Gamma paragraph remains the final source block" },
    { method: "content-stream-order", text: blocks.map((block) => block.expectedText).join(" ") },
    { method: "physical-layout", text: "Alpha Beta Gamma paragraph paragraph paragraph" }
  ]);
  assert.equal(result.status, "pass");
  assert.equal(result.method, "content-stream-order");
  assert.equal(result.blockRatio, 1);
  assert.equal(result.wordRatio, 1);
});

test("lexically present but reordered source reports a distinct order violation", () => {
  const blocks = [
    { id: "first", expectedText: "First section has distinct prose" },
    { id: "second", expectedText: "Second section has different prose" },
    { id: "third", expectedText: "Third section closes the sequence" }
  ];
  const text = [blocks[1], blocks[0], blocks[2]].map((block) => block.expectedText).join(" ");
  const result = evaluatePdfTextCandidates(blocks, [{ method: "reordered", text }], 0.9, [
    { id: "first", pages: [2] },
    { id: "second", pages: [3] }
  ]);
  assert.equal(result.status, "fail");
  assert.equal(result.code, "PDF_READING_ORDER_MISMATCH");
  assert.equal(result.lexicalPresence.blockRatio, 1);
  assert.equal(result.missingBlocks[0].id, "second");
});

test("deleted PDF text fails lexical preservation and identifies blocks", () => {
  const blocks = [
    { id: "kept", expectedText: "This paragraph remains in the PDF" },
    { id: "deleted", expectedText: "This paragraph was deliberately deleted" }
  ];
  const result = evaluatePdfTextCandidates(blocks, [{ method: "default", text: blocks[0].expectedText }], 0.9, [
    { id: "deleted", pages: [4, 5] }
  ]);
  assert.equal(result.code, "PDF_SOURCE_PRESERVATION_LOW");
  assert.deepEqual(result.missingBlocks, [{ id: "deleted", expectedPages: [4, 5], snippet: blocks[1].expectedText }]);
  assert.equal(sourceBlockPresence(blocks, blocks[0].expectedText).blockRatio, 0.5);
});
