import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";

import { assertSupportedSchema, contractNames, readContractFile, validateContract } from "../scripts/lib/json-contracts.mjs";

const temporaryDirectories = [];
after(async () => Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true }))));

test("all public JSON contracts load and reject unknown fields", () => {
  assert.deepEqual(contractNames(), ["book-config", "book-plan", "repair-actions", "aesthetic-review", "artifact-manifest", "diagnostics", "repair-tasks"]);
  const result = validateContract("book-config", { title: "Book", author: "Author", surprise: true });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /surprise is not allowed/);
});

test("contract schemas reject keywords the lightweight validator cannot enforce", () => {
  assert.throws(
    () => assertSupportedSchema({ type: "string", oneOf: [{ type: "string" }] }),
    /unsupported JSON Schema keyword: oneOf/
  );
});

test("book config validates required fields, enums, ranges, and filenames", () => {
  assert.equal(validateContract("book-config", { title: "Book", author: "Author", fontMode: "system" }).valid, true);
  const invalid = validateContract("book-config", {
    title: "",
    author: "Author",
    outputHtml: "nested/index.html",
    coverBandHeight: 8,
    fontMode: "sometimes"
  });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join("\n"), /must not be empty/);
  assert.match(invalid.errors.join("\n"), /outputHtml/);
  assert.match(invalid.errors.join("\n"), /at most 4.4/);
  assert.match(invalid.errors.join("\n"), /system, remote/);
});

test("model-authored contracts accept structured reasoning and reject prose-shaped extras", () => {
  const plan = {
    version: 1,
    manuscriptHash: "0".repeat(64),
    editorial: { audience: "Operators", genre: "manual", purpose: "teach", tone: "direct" },
    theme: { id: "technical", rationale: "Matches operational content" },
    layout: { bodyColumns: "text-single", chapterOpeners: false, rationale: "Long code samples need width" },
    visuals: { policy: "selective", diagrams: [], images: [] },
    classifications: [{ sourceBlockId: "source-1", role: "process", treatment: "diagram", rationale: "Sequence benefits from a visual" }],
    exceptions: [{ rule: "waive-part-images", scope: "all", rationale: "No parts exist" }],
    aestheticReview: { required: true, criteria: ["clear hierarchy", "balanced page rhythm"] }
  };
  assert.equal(validateContract("book-plan", plan).valid, true);
  assert.equal(validateContract("book-plan", { ...plan, commentary: "free-form" }).valid, false);
});

test("contract files fail with actionable paths", async () => {
  const directory = await mkdtemp(join(tmpdir(), "frontend-textbooks-contract-"));
  temporaryDirectories.push(directory);
  const filename = join(directory, "actions.json");
  await writeFile(filename, JSON.stringify({ version: 1, reportHash: "bad", actions: [] }));
  assert.throws(() => readContractFile("repair-actions", filename), /reportHash/);
});
