import assert from "node:assert/strict";
import test from "node:test";
import { sourceTokenCoverage } from "../scripts/lib/pdf-structure.mjs";

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
