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
import { createCoverGenerationReceipt, createCoverImageRequest } from "../scripts/lib/cover-image-request.mjs";
import { writeBookProject } from "./helpers/book-project.mjs";
import { diagramDecision, writeTestPng } from "./helpers/fixture-assets.mjs";

const execFileAsync = promisify(execFile);
const pipeline = new URL("../scripts/book-pipeline.mjs", import.meta.url).pathname;
const builder = new URL("../scripts/build-html-book.mjs", import.meta.url).pathname;
const prepareCover = new URL("../scripts/prepare-cover-image.mjs", import.meta.url).pathname;
const recordCover = new URL("../scripts/record-cover-image.mjs", import.meta.url).pathname;
const repository = new URL("..", import.meta.url).pathname;
const temporaryDirectories = [];
after(async () => Promise.all(temporaryDirectories.map((path) => rm(path, { recursive: true, force: true }))));

async function fixture({ aestheticRequired = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), "frontend-textbooks-pipeline-"));
  temporaryDirectories.push(root);
  const outputDir = join(root, "output");
  const manuscript = "# Pipeline Book\n\n## Chapter\n\nA deterministic paragraph for the pipeline.";
  return writeBookProject(root, {
    manuscript,
    configOverrides: { title: "Pipeline Book", author: "Test", outputDir, style: "technical" },
    planOverrides: { aestheticRequired }
  });
}

async function refreshCoverRequest(paths) {
  const config = JSON.parse(await readFile(paths.configPath));
  const plan = JSON.parse(await readFile(paths.planPath));
  const request = createCoverImageRequest({ config, plan, outputDir: paths.outputDir });
  await writeFile(join(paths.outputDir, "cover-image-request.json"), JSON.stringify(request));
  const receipt = createCoverGenerationReceipt({ config, plan, outputDir: paths.outputDir });
  await writeFile(join(paths.outputDir, "cover-generation-receipt.json"), JSON.stringify(receipt));
  return request;
}

async function run(paths, mode = "build", extra = [], { env = {}, cwd } = {}) {
  return execFileAsync(process.execPath, [pipeline, mode, "--config", paths.configPath, "--manuscript", paths.manuscriptPath, "--plan", paths.planPath, ...extra], {
    timeout: mode === "finalize" ? 120_000 : 30_000,
    env: { ...process.env, ...env },
    ...(cwd ? { cwd } : {})
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

test("relative outputDir is config-relative across pipeline and direct-builder working directories", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "frontend textbooks relative cwd "));
  const unrelated = await mkdtemp(join(tmpdir(), "frontend-textbooks-unrelated-cwd-"));
  const thirdCwd = await mkdtemp(join(tmpdir(), "frontend-textbooks-third-cwd-"));
  temporaryDirectories.push(projectRoot, unrelated, thirdCwd);
  const paths = await writeBookProject(projectRoot, {
    configOverrides: { title: "Relative Paths", outputDir: "build" },
    manuscript: "# Relative Paths\n\n## Chapter\n\nThe output location must follow the config file, never the shell working directory."
  });
  const accidentalPath = join(repository, "build", "index.html");
  const accidentalBefore = await readFile(accidentalPath).catch(() => null);

  const fromProject = JSON.parse((await run(paths, "build", [], { cwd: projectRoot })).stdout);
  assert.equal(fromProject.status, "pass");
  const manifestBefore = await readFile(join(paths.outputDir, "artifact-manifest.json"));
  const fromUnrelated = JSON.parse((await run(paths, "build", [], { cwd: unrelated })).stdout);
  assert.equal(fromUnrelated.skipped, true);
  assert.deepEqual(await readFile(join(paths.outputDir, "artifact-manifest.json")), manifestBefore);

  await execFileAsync(process.execPath, [builder, paths.configPath, paths.manuscriptPath, paths.planPath], { cwd: thirdCwd, timeout: 30_000 });
  await Promise.all([
    "index.html",
    "cover-options.html",
    "book-build-manifest.json",
    "source-inventory.json",
    "book-build-summary.json",
    "book-plan-receipt.json"
  ].map((name) => readFile(join(paths.outputDir, name))));
  const accidentalAfter = await readFile(accidentalPath).catch(() => null);
  assert.deepEqual(accidentalAfter, accidentalBefore, "building must not write generated artifacts into the skill source tree");
});

test("validation rejects dangling model source references before building", async () => {
  const paths = await fixture();
  const plan = JSON.parse(await readFile(paths.planPath));
  plan.classifications[0].sourceBlockId = "source-p-missing";
  await writeFile(paths.planPath, JSON.stringify(plan));
  await assert.rejects(run(paths, "validate"), /unknown source block/i);
});

test("cover generation failure stops before build or delivery with an actionable error", async (t) => {
  await t.test("missing generated bitmap", async () => {
    const paths = await fixture();
    await rm(join(paths.outputDir, "assets", "cover.png"));
    await assert.rejects(run(paths, "validate"), /COVER_ASSET_MISSING.*Generate it from cover-image-request\.json/i);
    await assert.rejects(readFile(join(paths.outputDir, "artifact-manifest.json")), /ENOENT/);
  });

  await t.test("missing generation receipt", async () => {
    const paths = await fixture();
    await rm(join(paths.outputDir, "cover-generation-receipt.json"));
    await assert.rejects(run(paths, "validate"), /COVER_GENERATION_RECEIPT_MISSING.*record-cover-image\.mjs/i);
    await assert.rejects(readFile(join(paths.outputDir, "artifact-manifest.json")), /ENOENT/);
  });
});

test("cover preparation and recording form an explicit fail-closed generation handoff", async () => {
  const root = await mkdtemp(join(tmpdir(), "frontend-textbooks-cover-handoff-"));
  const unrelated = await mkdtemp(join(tmpdir(), "frontend-textbooks-cover-handoff-cwd-"));
  temporaryDirectories.push(root, unrelated);
  const paths = await writeBookProject(root, {
    writeCover: false,
    writeRequest: false,
    configOverrides: { outputDir: "build" }
  });
  const staleReceipt = join(paths.outputDir, "cover-generation-receipt.json");
  await writeFile(staleReceipt, "stale");

  const prepared = JSON.parse((await execFileAsync(process.execPath, [prepareCover, paths.configPath, paths.manuscriptPath, paths.planPath], {
    cwd: unrelated,
    timeout: 30_000
  })).stdout);
  assert.equal(prepared.status, "cover-generation-required");
  assert.equal(prepared.target, join(paths.outputDir, "assets", "cover.png"));
  assert.match(prepared.requestHash, /^[a-f0-9]{64}$/u);
  await assert.rejects(readFile(staleReceipt), /ENOENT/);

  await assert.rejects(
    execFileAsync(process.execPath, [recordCover, paths.configPath, paths.manuscriptPath, paths.planPath], { cwd: unrelated, timeout: 30_000 }),
    /COVER_ASSET_MISSING.*Generate it from cover-image-request\.json/i
  );
  await writeTestPng(prepared.target, { rgb: [24, 91, 126] });
  const recorded = JSON.parse((await execFileAsync(process.execPath, [recordCover, paths.configPath, paths.manuscriptPath, paths.planPath], {
    cwd: unrelated,
    timeout: 30_000
  })).stdout);
  assert.equal(recorded.status, "cover-recorded");
  assert.equal(recorded.asset, "assets/cover.png");
  assert.match(recorded.assetHash, /^[a-f0-9]{64}$/u);

  const validated = JSON.parse((await run(paths, "validate", [], { cwd: unrelated })).stdout);
  assert.equal(validated.status, "pass");

  const ready = JSON.parse((await execFileAsync(process.execPath, [prepareCover, paths.configPath, paths.manuscriptPath, paths.planPath], {
    cwd: unrelated,
    timeout: 30_000
  })).stdout);
  assert.equal(ready.status, "cover-ready");
  assert.equal(ready.assetHash, recorded.assetHash);
  await readFile(staleReceipt);
});

test("cover preparation rejects an occupied target without current generation provenance", async () => {
  const root = await mkdtemp(join(tmpdir(), "frontend-textbooks-occupied-cover-"));
  temporaryDirectories.push(root);
  const paths = await writeBookProject(root, { writeRequest: false });
  await assert.rejects(
    execFileAsync(process.execPath, [prepareCover, paths.configPath, paths.manuscriptPath, paths.planPath], { timeout: 30_000 }),
    /COVER_TARGET_OCCUPIED.*fresh artwork/i
  );
  await assert.rejects(readFile(join(paths.outputDir, "cover-image-request.json")), /ENOENT/);
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
  plan.visuals.diagrams = [diagramDecision([sourceBlockId], { title: "Deterministic flow" })];
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
  assert.equal(receipt.diagrams[0].title, "Deterministic flow");
  assert.deepEqual(receipt.diagrams[0].sourceBlockIds, [sourceBlockId]);
});

test("cache keys include output targets and URL-decoded local assets", async () => {
  const paths = await fixture();
  const assetDirectory = join(paths.outputDir, "assets");
  await mkdir(assetDirectory, { recursive: true });
  const assetPath = join(assetDirectory, "cover one.png");
  await writeTestPng(assetPath, { rgb: [20, 80, 150] });
  const config = JSON.parse(await readFile(paths.configPath));
  config.coverImage = "assets/cover%20one.png";
  await writeFile(paths.configPath, JSON.stringify(config));
  await refreshCoverRequest(paths);

  await run(paths);
  assert.equal(JSON.parse((await run(paths)).stdout).skipped, true);
  const alternatePdf = join(paths.outputDir, "alternate.pdf");
  assert.equal(JSON.parse((await run(paths, "build", ["--pdf", alternatePdf])).stdout).skipped, false);
  await writeTestPng(assetPath, { rgb: [190, 90, 40] });
  await refreshCoverRequest(paths);
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
    await rm(join(paths.outputDir, "cover.png"), { force: true });
    await rm(join(paths.outputDir, "assets", "cover.png"), { force: true });
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
  assert.equal(request.version, 2);
  assert.deepEqual(request.resolved, {
    theme: "technical",
    bodyColumns: "text-single",
    chapterOpeners: false,
    coverRoute: "photo",
    imagePolicy: "selective",
    featurePagesRequired: false,
    featurePages: [],
    coverRequired: true
  });
  assert.equal(request.coverEvidence.asset, "assets/cover.png");
  assert.equal(request.coverEvidence.assetHash, sha256(await readFile(join(paths.outputDir, "assets", "cover.png"))));
  assert.equal(request.coverEvidence.route, "photo");
  assert.match(request.coverEvidence.fullPage.path, /desktop-cover\.png$/u);
  assert.match(request.coverEvidence.mobile.path, /mobile-cover\.png$/u);
  assert.match(request.coverEvidence.thumbnailContactSheet.path, /contact-sheet\.png$/u);
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

  const changedConfig = JSON.parse(await readFile(paths.configPath));
  changedConfig.selectedCoverRoute = "minimal";
  changedPlan.aestheticReview.criteria.pop();
  changedPlan.layout.coverRoute = "minimal";
  await writeFile(paths.configPath, JSON.stringify(changedConfig));
  await writeFile(paths.planPath, JSON.stringify(changedPlan));
  await refreshCoverRequest(paths);
  await assert.rejects(
    run(paths, "finalize", ["--tier", "full", "--aesthetic-review", reviewPath]),
    /requestHash does not match/i
  );
  const changedRequest = JSON.parse(await readFile(join(paths.outputDir, ".verification", "aesthetic-review-request.json")));
  assert.equal(changedRequest.resolved.coverRoute, "minimal");
  assert.notEqual(changedRequest.requestHash, request.requestHash);
});
