import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { promisify } from "node:util";
import { parseManuscript } from "../scripts/lib/manuscript.mjs";
import { assertContract } from "../scripts/lib/json-contracts.mjs";
import { sha256 } from "../scripts/lib/content-hash.mjs";

const execFileAsync = promisify(execFile);
const pipeline = new URL("../scripts/book-pipeline.mjs", import.meta.url).pathname;
const temporaryDirectories = [];
after(async () => Promise.all(temporaryDirectories.map((path) => rm(path, { recursive: true, force: true }))));

async function fixture({ aestheticRequired = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), "frontend-textbooks-pipeline-"));
  temporaryDirectories.push(root);
  const outputDir = join(root, "output");
  await mkdir(outputDir);
  const manuscript = "# Pipeline Book\n\n## Chapter\n\nA deterministic paragraph for the pipeline.";
  const parsed = parseManuscript(manuscript);
  const sourceId = parsed.sourceManifest.blocks.find((block) => block.kind === "p").id;
  const manuscriptHash = parsed.sourceManifest.sha256;
  const configPath = join(root, "book.json");
  const manuscriptPath = join(root, "manuscript.md");
  const planPath = join(root, "book-plan.json");
  await writeFile(configPath, JSON.stringify({ title: "Pipeline Book", author: "Test", outputDir, style: "technical", requireDiagrams: false, requirePartImages: false }));
  await writeFile(manuscriptPath, manuscript);
  await writeFile(planPath, JSON.stringify({
    version: 1,
    manuscriptHash,
    editorial: { audience: "reader", genre: "manual", purpose: "teach", tone: "clear" },
    theme: { id: "technical", rationale: "Clear system typography" },
    layout: { bodyColumns: "text-single", chapterOpeners: false, rationale: "Short source" },
    visuals: { policy: "none", diagrams: [], images: [] },
    classifications: [{ sourceBlockId: sourceId, role: "narrative", treatment: "prose", rationale: "Body text" }],
    exceptions: [{ rule: "waive-diagrams", scope: "book", rationale: "Short fixture has no relationship to diagram" }],
    aestheticReview: { required: aestheticRequired, criteria: ["hierarchy", "page rhythm"] }
  }));
  return { root, outputDir, configPath, manuscriptPath, planPath };
}

async function run(paths, mode = "build", extra = [], { env = {} } = {}) {
  return execFileAsync(process.execPath, [pipeline, mode, "--config", paths.configPath, "--manuscript", paths.manuscriptPath, "--plan", paths.planPath, ...extra], {
    timeout: 30_000,
    env: { ...process.env, ...env }
  });
}

test("one orchestration command emits deterministic fast-tier artifacts", async () => {
  const paths = await fixture();
  const first = await run(paths);
  assert.ok(first.stdout.length < 512, first.stdout);
  const firstSummary = JSON.parse(first.stdout);
  assert.equal(firstSummary.status, "pass");
  assert.equal(firstSummary.tier, "fast");
  const manifestBytes = await readFile(join(paths.outputDir, "artifact-manifest.json"));
  const manifest = JSON.parse(manifestBytes);
  assertContract("artifact-manifest", manifest);
  assert.ok(manifest.outputs.some((item) => item.path === "source-inventory.json"));
  assert.doesNotMatch(await readFile(join(paths.outputDir, "index.html"), "utf8"), /fonts\.googleapis\.com/);

  const config = JSON.parse(await readFile(paths.configPath));
  await writeFile(paths.configPath, JSON.stringify(Object.fromEntries(Object.entries(config).reverse())));
  const second = await run(paths);
  const secondSummary = JSON.parse(second.stdout);
  assert.equal(secondSummary.skipped, true);
  assert.deepEqual(await readFile(join(paths.outputDir, "artifact-manifest.json")), manifestBytes);
  const iteration = JSON.parse(await readFile(join(paths.outputDir, "iteration-context.json")));
  assert.equal(iteration.skipped, true);
  assert.deepEqual(iteration.changed.sourceBlockIds, []);
  assert.ok(JSON.stringify(iteration).length < 1024);

  await writeFile(join(paths.outputDir, "index.html"), "tampered");
  const rebuilt = JSON.parse((await run(paths)).stdout);
  assert.equal(rebuilt.skipped, false);
  assert.match(await readFile(join(paths.outputDir, "index.html"), "utf8"), /<!doctype html>/i);
});

test("validation rejects dangling model source references before building", async () => {
  const paths = await fixture();
  const plan = JSON.parse(await readFile(paths.planPath));
  plan.classifications[0].sourceBlockId = "source-p-missing";
  await writeFile(paths.planPath, JSON.stringify(plan));
  await assert.rejects(run(paths, "validate"), /unknown source block/i);
});

test("pipeline failures preserve a compact machine-readable response", async () => {
  const paths = await fixture();
  const plan = JSON.parse(await readFile(paths.planPath));
  plan.manuscriptHash = "0".repeat(64);
  await writeFile(paths.planPath, JSON.stringify(plan));
  try {
    await run(paths, "validate");
    assert.fail("expected validation failure");
  } catch (error) {
    const response = JSON.parse(error.stdout);
    assert.equal(response.status, "fail");
    assert.equal(response.mode, "validate");
    assert.match(response.error.message, /manuscriptHash does not match/i);
    assert.ok(error.stdout.length < 1_000);
  }
});

test("pipeline keeps PDF and verification artifacts inside outputDir", async () => {
  const paths = await fixture();
  await assert.rejects(run(paths, "validate", ["--pdf", join(paths.root, "outside.pdf")]), /inside outputDir/i);
  await assert.rejects(run(paths, "validate", ["--output-dir", join(paths.root, "outside-verification")]), /inside outputDir/i);
});

test("pipeline enforces the mode-to-tier contract", async () => {
  const paths = await fixture();
  await assert.rejects(run(paths, "finalize", ["--tier", "affected"]), /finalize requires tier full/i);
  await assert.rejects(run(paths, "verify", ["--tier", "full"]), /verify requires tier affected/i);
});

test("affected pipeline verifies rendered screen views without exporting a PDF", async () => {
  const paths = await fixture();
  const fakeBin = join(paths.root, "bin");
  const resolverLog = join(paths.root, "browser-resolver.log");
  const bashWrapper = join(fakeBin, "bash");
  await mkdir(fakeBin);
  await writeFile(bashWrapper, "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$BOOK_BROWSER_RESOLVER_LOG\"\nexec /bin/bash \"$@\"\n");
  await chmod(bashWrapper, 0o755);
  const resolverEnv = {
    BOOK_BROWSER_RESOLVER_LOG: resolverLog,
    PATH: `${fakeBin}:${process.env.PATH}`
  };
  const first = JSON.parse((await run(paths, "verify", ["--tier", "affected"], { env: resolverEnv })).stdout);
  assert.equal(first.status, "pass");
  assert.match(await readFile(resolverLog, "utf8"), /run-book-browser\.sh verify --html/u);
  const manifest = JSON.parse(await readFile(join(paths.outputDir, "artifact-manifest.json")));
  assert.equal(manifest.verification.tier, "affected");
  const report = JSON.parse(await readFile(join(paths.outputDir, ".verification", "render-report.json")));
  assert.equal(report.print, null);
  await assert.rejects(readFile(join(paths.outputDir, "index.pdf")), /ENOENT/);
  const second = JSON.parse((await run(paths, "verify", ["--tier", "affected"])).stdout);
  assert.equal(second.skipped, true);
  await writeFile(join(paths.outputDir, ".verification", "diagnostics.json"), "tampered");
  const rebuilt = JSON.parse((await run(paths, "verify", ["--tier", "affected"])).stdout);
  assert.equal(rebuilt.skipped, false);
  assert.equal(JSON.parse(await readFile(join(paths.outputDir, ".verification", "diagnostics.json"))).status, "pass");
});

test("affected verification defers aesthetic approval", async () => {
  const paths = await fixture({ aestheticRequired: true });
  const result = JSON.parse((await run(paths, "verify", ["--tier", "affected"])).stdout);
  assert.equal(result.status, "pass");
  await assert.rejects(readFile(join(paths.outputDir, ".verification", "aesthetic-review-request.json")), /ENOENT/);
});

test("model plan classifications compile into structured rendered treatments", async () => {
  const paths = await fixture();
  const plan = JSON.parse(await readFile(paths.planPath));
  const sourceBlockId = plan.classifications[0].sourceBlockId;
  plan.classifications[0] = { ...plan.classifications[0], role: "process", treatment: "diagram", rationale: "A sequence benefits from structure" };
  plan.visuals.diagrams = [{ sourceBlockIds: [sourceBlockId], concept: "Deterministic flow", rationale: "Makes the sequence visible" }];
  await writeFile(paths.planPath, JSON.stringify(plan));
  try {
    await run(paths, "verify", ["--tier", "affected"]);
  } catch (error) {
    try { error.message += `\n${await readFile(join(paths.outputDir, ".verification", "diagnostics.json"), "utf8")}`; } catch {}
    throw error;
  }
  const report = JSON.parse(await readFile(join(paths.outputDir, ".verification", "render-report.json")));
  assert.equal(report.desktop.diagramCount, 1);
  const receipt = JSON.parse(await readFile(join(paths.outputDir, "book-plan-receipt.json")));
  assert.deepEqual(receipt.diagrams[0], { sourceBlockIds: [sourceBlockId], concept: "Deterministic flow" });
});

test("cache keys include output targets and URL-decoded local assets", async () => {
  const paths = await fixture();
  const assetDirectory = join(paths.outputDir, "assets");
  await mkdir(assetDirectory, { recursive: true });
  const assetPath = join(assetDirectory, "cover one.png");
  await writeFile(assetPath, "first-cover-bytes");
  const config = JSON.parse(await readFile(paths.configPath));
  config.coverImage = "assets/cover%20one.png";
  await writeFile(paths.configPath, JSON.stringify(config));

  await run(paths);
  assert.equal(JSON.parse((await run(paths)).stdout).skipped, true);
  const alternatePdf = join(paths.outputDir, "alternate.pdf");
  assert.equal(JSON.parse((await run(paths, "build", ["--pdf", alternatePdf])).stdout).skipped, false);
  await writeFile(assetPath, "changed-cover-bytes");
  assert.equal(JSON.parse((await run(paths, "build", ["--pdf", alternatePdf])).stdout).skipped, false);
});

test("pipeline rejects encoded traversal and escaping asset symlinks before hashing", async (t) => {
  await t.test("encoded traversal", async () => {
    const paths = await fixture();
    await writeFile(join(paths.root, "secret.png"), "secret");
    const config = JSON.parse(await readFile(paths.configPath));
    config.coverImage = "%2e%2e/secret.png";
    await writeFile(paths.configPath, JSON.stringify(config));
    await assert.rejects(run(paths, "validate"), /outside outputDir/i);
  });

  await t.test("escaping symlink", async () => {
    const paths = await fixture();
    const secret = join(paths.root, "secret.png");
    await writeFile(secret, "secret");
    await symlink(secret, join(paths.outputDir, "cover.png"));
    const config = JSON.parse(await readFile(paths.configPath));
    config.coverImage = "cover.png";
    await writeFile(paths.configPath, JSON.stringify(config));
    await assert.rejects(run(paths, "validate"), /symbolic link/i);
  });
});

test("cache state cannot read outputs outside outputDir", async () => {
  const paths = await fixture();
  await run(paths);
  const sentinel = join(paths.root, "sentinel");
  await writeFile(sentinel, "outside-state");
  const statePath = join(paths.outputDir, "book-state.json");
  const state = JSON.parse(await readFile(statePath));
  state.outputs[0] = { path: "../sentinel", sha256: sha256(await readFile(sentinel)) };
  await writeFile(statePath, JSON.stringify(state));
  const result = JSON.parse((await run(paths)).stdout);
  assert.equal(result.skipped, false);
  assert.equal(await readFile(sentinel, "utf8"), "outside-state");
});

test("validation rejects stale plans and unreasoned policy bypasses", async (t) => {
  await t.test("stale manuscript hash", async () => {
    const paths = await fixture();
    const plan = JSON.parse(await readFile(paths.planPath));
    plan.manuscriptHash = "0".repeat(64);
    await writeFile(paths.planPath, JSON.stringify(plan));
    await assert.rejects(run(paths, "validate"), /manuscriptHash does not match/i);
  });

  await t.test("remote fonts without exception", async () => {
    const paths = await fixture();
    const config = JSON.parse(await readFile(paths.configPath));
    config.fontMode = "remote";
    await writeFile(paths.configPath, JSON.stringify(config));
    await assert.rejects(run(paths, "validate"), /allow-remote-fonts/i);
  });

  await t.test("duplicate semantic classification", async () => {
    const paths = await fixture();
    const plan = JSON.parse(await readFile(paths.planPath));
    plan.classifications.push({ ...plan.classifications[0], rationale: "Duplicate decision" });
    await writeFile(paths.planPath, JSON.stringify(plan));
    await assert.rejects(run(paths, "validate"), /more than once/i);
  });
});

test("full tier pauses for model-owned aesthetic judgment, then finalizes without rerendering", async () => {
  const paths = await fixture({ aestheticRequired: true });
  let first;
  try {
    await run(paths, "finalize", ["--tier", "full"]);
    assert.fail("expected review-required exit");
  } catch (error) {
    first = error;
  }
  assert.equal(first.code, 3, `${first.stdout}\n${first.stderr}`);
  const firstSummary = JSON.parse(first.stdout);
  assert.equal(firstSummary.status, "review-required");
  assert.equal(firstSummary.pdfInspection, ".verification/pdf-pages/pdf-inspection.json");
  assert.ok(first.stdout.length < 512);
  const pdfPagesDir = join(paths.outputDir, ".verification", "pdf-pages");
  const structure = JSON.parse(await readFile(join(pdfPagesDir, "pdf-structure.json")));
  const inspection = JSON.parse(await readFile(join(pdfPagesDir, "pdf-inspection.json")));
  assert.ok(structure.pageCount > 0);
  assert.equal(inspection.pages, structure.pageCount);
  assert.equal(inspection.textPreservation.blockRatio, 1);
  assert.ok(inspection.contactSheets.length > 0);
  assert.ok(inspection.selections.length > 0);
  for (let page = 1; page <= structure.pageCount; page += 1) {
    await readFile(join(pdfPagesDir, `pdf-page-${page}.png`));
  }
  await Promise.all([
    ...inspection.contactSheets,
    ...inspection.selections.map((selection) => selection.path)
  ].map((path) => readFile(path)));
  const reviewPath = join(paths.root, "aesthetic-review.json");
  const request = JSON.parse(await readFile(join(paths.outputDir, ".verification", "aesthetic-review-request.json")));
  await writeFile(reviewPath, JSON.stringify({
    version: 1,
    requestHash: request.requestHash,
    contactSheetHash: "0".repeat(64),
    verdict: "pass",
    strengths: ["Reviewed hierarchy"],
    issues: [],
    actions: []
  }));
  await assert.rejects(run(paths, "finalize", ["--tier", "full", "--aesthetic-review", reviewPath]), /contactSheetHash does not match/i);
  await writeFile(reviewPath, JSON.stringify({
    version: 1,
    requestHash: request.requestHash,
    contactSheetHash: request.contactSheetHash,
    verdict: "revise",
    strengths: ["Typography is legible"],
    issues: ["Needs revision"],
    actions: ["Revise hierarchy"]
  }));
  await assert.rejects(run(paths, "finalize", ["--tier", "full", "--aesthetic-review", reviewPath]), /verdict is revise/i);
  await writeFile(reviewPath, JSON.stringify({
    version: 1,
    requestHash: request.requestHash,
    contactSheetHash: request.contactSheetHash,
    verdict: "pass",
    strengths: ["Clear hierarchy"],
    issues: [],
    actions: []
  }));
  const second = await run(paths, "finalize", ["--tier", "full", "--aesthetic-review", reviewPath]);
  const summary = JSON.parse(second.stdout);
  assert.equal(summary.status, "pass");
  assert.equal(summary.skipped, true);
  const manifest = JSON.parse(await readFile(join(paths.outputDir, "artifact-manifest.json")));
  assert.equal(manifest.reasoning.aestheticReview, "pass");
  assert.ok(manifest.outputs.some((item) => item.path.endsWith(".pdf")));
  assert.ok(manifest.outputs.some((item) => item.path === ".verification/contact-sheet.png"));
  const manifested = new Set(manifest.outputs.map((item) => item.path));
  assert.ok(manifested.has(".verification/pdf-pages/pdf-structure.json"));
  assert.ok(manifested.has(".verification/pdf-pages/pdf-inspection.json"));
  for (let page = 1; page <= structure.pageCount; page += 1) {
    assert.ok(manifested.has(`.verification/pdf-pages/pdf-page-${page}.png`));
  }
  for (const path of [...inspection.contactSheets, ...inspection.selections.map((selection) => selection.path)]) {
    assert.ok(manifested.has(path.slice(paths.outputDir.length + 1)));
  }

  const changedPlan = JSON.parse(await readFile(paths.planPath));
  changedPlan.aestheticReview.criteria.push("stronger contrast");
  await writeFile(paths.planPath, JSON.stringify(changedPlan));
  await assert.rejects(
    run(paths, "finalize", ["--tier", "full", "--aesthetic-review", reviewPath]),
    /requestHash does not match/i
  );
});
