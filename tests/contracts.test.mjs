import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";

import { assertSupportedSchema, contractNames, readContractFile, validateContract } from "../scripts/lib/json-contracts.mjs";
import { bookPlan } from "./helpers/fixture-assets.mjs";

const temporaryDirectories = [];
after(async () => Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true }))));

test("all public JSON contracts load and reject unknown fields", () => {
  assert.deepEqual(contractNames(), ["book-config", "book-plan", "repair-actions", "aesthetic-review", "artifact-manifest", "diagnostics", "repair-tasks"]);
  const result = validateContract("book-config", { title: "Book", author: "Author", coverImage: "assets/cover.png", surprise: true });
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
  assert.equal(validateContract("book-config", { title: "Book", author: "Author", coverImage: "assets/cover.png", fontMode: "system" }).valid, true);
  const invalid = validateContract("book-config", {
    title: "",
    author: "Author",
    coverImage: "assets/cover.png",
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
  const plan = bookPlan({ manuscriptHash: "0".repeat(64), sourceBlockId: "source-1", theme: "technical" });
  assert.equal(validateContract("book-plan", plan).valid, true);
  assert.equal(validateContract("book-plan", { ...plan, commentary: "free-form" }).valid, false);
});

test("artifact manifests use the strict v3 cover provenance and source-block coverage contract", () => {
  const manifest = {
    schemaVersion: 3,
    pipelineVersion: "2.0.0",
    inputHash: "0".repeat(64),
    inputs: { manuscript: "1".repeat(64) },
    outputs: [{ path: "index.pdf", sha256: "2".repeat(64), bytes: 1 }],
    cover: {
      path: "assets/cover.png",
      sha256: "3".repeat(64),
      bytes: 100,
      requestHash: "4".repeat(64),
      generationReceiptHash: "5".repeat(64),
      generationId: "fixture-cover-00000001",
      route: "photo",
      subject: "A manuscript-grounded editorial subject",
      altText: "A manuscript-grounded editorial scene with one clear focal subject.",
      width: 1800,
      height: 1800,
      frame: { widthIn: 8.5, heightIn: 7.45 },
      effectiveDpi: 211.8,
      minimumDpi: 150
    },
    verification: {
      tier: "full",
      passed: true,
      pages: 1,
      sourceCoverage: 1,
      sourceBlockCoverage: 1,
      contactSheet: ".verification/contact-sheet.png"
    },
    reasoning: { plan: "book-plan.json", exceptions: 0, aestheticReview: "pass" }
  };

  assert.equal(validateContract("artifact-manifest", manifest).valid, true);

  const legacyManifest = structuredClone(manifest);
  legacyManifest.schemaVersion = 2;
  delete legacyManifest.cover;
  delete legacyManifest.verification.sourceBlockCoverage;
  const legacyResult = validateContract("artifact-manifest", legacyManifest);
  assert.equal(legacyResult.valid, false);
  assert.match(legacyResult.errors.join("\n"), /schemaVersion must be one of: 3/);
  assert.match(legacyResult.errors.join("\n"), /cover is required/);
});

test("book contracts fail closed without a cover target or cover decision", () => {
  const config = validateContract("book-config", { title: "Book", author: "Author" });
  assert.equal(config.valid, false);
  assert.match(config.errors.join("\n"), /coverImage is required/);

  const plan = bookPlan({ manuscriptHash: "0".repeat(64), sourceBlockId: "source-1" });
  delete plan.visuals.cover;
  const result = validateContract("book-plan", plan);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /visuals\.cover is required/);
});

test("contract files fail with actionable paths", async () => {
  const directory = await mkdtemp(join(tmpdir(), "frontend-textbooks-contract-"));
  temporaryDirectories.push(directory);
  const filename = join(directory, "actions.json");
  await writeFile(filename, JSON.stringify({ version: 1, reportHash: "bad", actions: [] }));
  assert.throws(() => readContractFile("repair-actions", filename), /reportHash/);
});
