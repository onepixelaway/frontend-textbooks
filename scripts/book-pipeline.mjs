#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { assertContract } from "./lib/json-contracts.mjs";
import { sha256 } from "./lib/content-hash.mjs";
import { parseManuscript } from "./lib/manuscript.mjs";
import { STYLE_NAMES } from "../themes/index.mjs";
import { assertPlanMatchesManuscript, assertPlanPolicy } from "./lib/plan-contract.mjs";
import { createSourceInventory } from "./lib/source-inventory.mjs";
import { getTheme } from "../themes/index.mjs";
import { resolveLocalAsset } from "./lib/local-assets.mjs";
import { contactSheetEvidence } from "./lib/aesthetic-review.mjs";
import { PIPELINE_MODES, TIER_RANK } from "./lib/verification-profiles.mjs";
import { acquirePipelineLock } from "./lib/pipeline-lock.mjs";
import { runNodeScript } from "./lib/process-runner.mjs";

const PIPELINE_VERSION = "1.0.0";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const builder = join(scriptDir, "build-html-book.mjs");
const browser = join(scriptDir, "book-browser.mjs");
const fileHashCache = new Map();
let workspaceLockToken = null;

function usage(message = "") {
  if (message) console.error(message);
  console.error("Usage: node scripts/book-pipeline.mjs <inventory|validate|build|verify|finalize> --config book.json --manuscript manuscript.md [--plan book-plan.json] [--tier fast|affected|full] [--pdf book.pdf] [--aesthetic-review aesthetic-review.json] [--force true]");
  process.exit(1);
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const modeProfile = PIPELINE_MODES[mode];
  if (!modeProfile) usage();
  const args = { mode, tier: modeProfile.tier, force: false };
  for (let index = 0; index < rest.length; index += 2) {
    const token = rest[index];
    const value = rest[index + 1];
    if (!token?.startsWith("--") || value === undefined) usage();
    args[token.slice(2)] = value;
  }
  if (!args.config || !args.manuscript) usage("config and manuscript are required");
  if (mode !== "inventory" && !args.plan) usage("plan is required after inventory");
  if (!["fast", "affected", "full"].includes(args.tier)) usage("tier must be fast, affected, or full");
  if (args.tier !== modeProfile.tier) usage(`${mode} requires tier ${modeProfile.tier}`);
  args.force = args.force === true || args.force === "true";
  return args;
}

function atomicJson(path, value) {
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
    renameSync(temporary, path);
    fileHashCache.delete(resolve(path));
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function hashFile(path) {
  const absolutePath = resolve(path);
  if (!fileHashCache.has(absolutePath)) fileHashCache.set(absolutePath, sha256(readFileSync(absolutePath)));
  return fileHashCache.get(absolutePath);
}

function relativePath(root, path) {
  return relative(root, path).split("\\").join("/");
}

function isWithin(root, path) {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function localAssetPaths(config, parsed, outputDir) {
  const values = [config.coverImage, ...Object.values(config.partImages ?? {}), ...parsed.assetReferences];
  return values.map((value, index) => resolveLocalAsset(value, outputDir, `asset ${index + 1}`, outputDir))
    .filter(Boolean)
    .filter(existsSync);
}

function parsedContract(name, bytes, path) {
  try {
    return assertContract(name, JSON.parse(bytes.toString("utf8")));
  } catch (error) {
    throw new Error(`Cannot read ${name} JSON from ${path}: ${error.message}`);
  }
}

function validateInputs(args) {
  const configPath = resolve(args.config);
  const manuscriptPath = resolve(args.manuscript);
  const planPath = args.plan ? resolve(args.plan) : null;
  const configBytes = readFileSync(configPath);
  const manuscriptBytes = readFileSync(manuscriptPath);
  const planBytes = planPath ? readFileSync(planPath) : null;
  const config = parsedContract("book-config", configBytes, configPath);
  const plan = planBytes ? parsedContract("book-plan", planBytes, planPath) : null;
  const manuscript = manuscriptBytes.toString("utf8");
  const parsed = parseManuscript(manuscript);
  if (plan) {
    assertPlanMatchesManuscript(plan, parsed, STYLE_NAMES);
    assertPlanPolicy(plan, config, parsed);
  }
  const outputDir = resolve(config.outputDir ?? dirname(configPath));
  const outputHtml = resolve(outputDir, config.outputHtml ?? "index.html");
  const pdfPath = resolve(args.pdf ?? join(outputDir, `${basename(outputHtml, ".html")}.pdf`));
  const verificationDir = resolve(args["output-dir"] ?? join(outputDir, ".verification"));
  if (!isWithin(outputDir, pdfPath)) throw new Error("pdf output must remain inside outputDir");
  if (!isWithin(outputDir, verificationDir)) throw new Error("verification output must remain inside outputDir");
  const inputPaths = { config: configPath, manuscript: manuscriptPath, ...(planPath ? { plan: planPath } : {}) };
  const contentConfig = { ...config };
  delete contentConfig.outputDir;
  const inputs = {
    config: sha256(contentConfig),
    manuscript: sha256(manuscriptBytes),
    ...(plan ? { plan: sha256(plan) } : {})
  };
  const assetHashes = localAssetPaths(config, parsed, outputDir).map((path) => [relativePath(outputDir, path), hashFile(path)]).sort(([a], [b]) => a.localeCompare(b));
  const toolPaths = [
    ...readdirSync(scriptDir).filter((name) => name.endsWith(".mjs")).map((name) => join(scriptDir, name)),
    ...readdirSync(join(scriptDir, "lib")).filter((name) => name.endsWith(".mjs")).map((name) => join(scriptDir, "lib", name)),
    join(scriptDir, "../page-base.css"),
    join(scriptDir, "../package.json"),
    join(scriptDir, "../package-lock.json"),
    join(scriptDir, "../node_modules/playwright/package.json"),
    join(scriptDir, "../node_modules/playwright-core/browsers.json")
  ].sort();
  const toolHashes = toolPaths.map((path) => [relativePath(resolve(scriptDir, ".."), path), hashFile(path)]);
  const toolchain = { node: process.version };
  const themeHash = sha256(getTheme(plan?.theme.id ?? config.style));
  const targets = {
    html: relativePath(outputDir, outputHtml),
    pdf: relativePath(outputDir, pdfPath),
    verification: relativePath(outputDir, verificationDir)
  };
  const inputHash = sha256({ pipelineVersion: PIPELINE_VERSION, inputs, assets: assetHashes, tools: toolHashes, toolchain, themeHash, targets });
  const components = {
    config: inputs.config,
    manuscript: inputs.manuscript,
    plan: inputs.plan ?? null,
    assets: sha256(assetHashes),
    tools: sha256({ toolHashes, toolchain }),
    theme: themeHash,
    targets: sha256(targets)
  };
  return { config, plan, manuscript, parsed, outputDir, outputHtml, pdfPath, verificationDir, inputPaths, inputs, components, inputHash };
}

function previousState(outputDir) {
  const path = join(outputDir, "book-state.json");
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

function changedSourceBlockIds(previous, parsed) {
  const current = new Map(parsed.sourceManifest.blocks.map((block) => [block.id, block.sha256]));
  const prior = new Map((previous?.sourceBlocks ?? []).map((block) => [block.id, block.sha256]));
  return [...new Set([
    ...[...current].filter(([id, hash]) => prior.get(id) !== hash).map(([id]) => id),
    ...[...prior].filter(([id, hash]) => current.get(id) !== hash).map(([id]) => id)
  ])].sort();
}

function artifactPaths(context, tier, verification = null, aesthetic = { status: "not-required", review: null }, { requireAll = true } = {}) {
  const buildManifestPath = join(context.outputDir, "book-build-manifest.json");
  const buildFiles = existsSync(buildManifestPath)
    ? JSON.parse(readFileSync(buildManifestPath, "utf8")).files.map((path) => resolve(context.outputDir, path))
    : [];
  const reportPath = join(context.verificationDir, "render-report.json");
  const report = verification ?? (existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : null);
  const verificationImages = existsSync(context.verificationDir)
    ? readdirSync(context.verificationDir).filter((name) => name.endsWith(".png")).sort().map((name) => join(context.verificationDir, name))
    : [];
  const candidates = [...new Set([
    context.outputHtml,
    join(context.outputDir, "cover-options.html"),
    buildManifestPath,
    join(context.outputDir, "source-inventory.json"),
    join(context.outputDir, "book-build-summary.json"),
    join(context.outputDir, "book-plan-receipt.json"),
    ...buildFiles,
    ...(tier === "full" ? [context.pdfPath] : []),
    ...(tier !== "fast" ? [
      reportPath,
      join(context.verificationDir, "diagnostics.json"),
      join(context.verificationDir, "source-accounting.json"),
      join(context.verificationDir, "contact-sheet.png"),
      ...verificationImages,
      ...(report?.contactSheets ?? []).map((path) => resolve(path)),
      ...(tier === "full" && context.plan.aestheticReview.required ? [join(context.verificationDir, "aesthetic-review-request.json")] : []),
      ...(aesthetic.review ? [join(context.verificationDir, "aesthetic-review.json")] : [])
    ] : [])
  ])];
  if (requireAll) {
    const missing = candidates.filter((path) => !existsSync(path));
    if (missing.length) throw new Error(`Required ${tier}-tier artifact(s) are missing: ${missing.map((path) => relativePath(context.outputDir, path)).join(", ")}`);
  }
  return candidates;
}

function stateFor(context, tier, verification, aesthetic) {
  return {
    schemaVersion: 1,
    pipelineVersion: PIPELINE_VERSION,
    inputHash: context.inputHash,
    tier,
    renderPassed: true,
    components: context.components,
    outputs: artifactPaths(context, tier, verification, aesthetic).map((path) => ({ path: relativePath(context.outputDir, path), sha256: hashFile(path) })),
    sourceBlocks: context.parsed.sourceManifest.blocks.map(({ id, sha256 }) => ({ id, sha256 }))
  };
}

function cachedOutputsMatch(previous, context, tier) {
  if (!Array.isArray(previous?.outputs) || !previous.outputs.length) return false;
  const recorded = new Set(previous.outputs.map((output) => output.path));
  const expected = artifactPaths(context, tier, null, undefined, { requireAll: false }).map((path) => relativePath(context.outputDir, path));
  if (expected.some((path) => !recorded.has(path))) return false;
  return previous.outputs.every((output) => {
    if (typeof output.path !== "string") return false;
    const path = resolve(context.outputDir, output.path);
    return isWithin(context.outputDir, path) && existsSync(path) && hashFile(path) === output.sha256;
  });
}

function runNode(args, stage, timeoutMs) {
  return runNodeScript(args, {
    cwd: resolve(scriptDir, ".."),
    stage,
    timeoutMs,
    env: { ...process.env, ...(workspaceLockToken ? { BOOK_PIPELINE_LOCK_TOKEN: workspaceLockToken } : {}) }
  });
}

function outputRecord(outputDir, path) {
  return { path: relativePath(outputDir, path), sha256: hashFile(path), bytes: statSync(path).size };
}

function writeIterationContext(context, previous, tier, status, skipped) {
  const value = {
    schemaVersion: 1,
    inputHash: context.inputHash,
    tier,
    status,
    skipped,
    changed: {
      config: previous?.components?.config !== context.components.config,
      plan: previous?.components?.plan !== context.components.plan,
      manuscript: previous?.components?.manuscript !== context.components.manuscript,
      assets: previous?.components?.assets !== context.components.assets,
      tools: previous?.components?.tools !== context.components.tools,
      theme: previous?.components?.theme !== context.components.theme,
      targets: previous?.components?.targets !== context.components.targets,
      sourceBlockIds: changedSourceBlockIds(previous, context.parsed)
    },
    artifacts: {
      html: relativePath(context.outputDir, context.outputHtml),
      verification: relativePath(context.outputDir, context.verificationDir)
    }
  };
  atomicJson(join(context.outputDir, "iteration-context.json"), value);
  return value;
}

function validateAestheticReview(context) {
  const contactSheet = join(context.verificationDir, "contact-sheet.png");
  if (!context.plan.aestheticReview.required) return { status: "not-required", review: null };
  const renderReportPath = join(context.verificationDir, "render-report.json");
  const renderReport = JSON.parse(readFileSync(renderReportPath, "utf8"));
  const contactSheets = (renderReport.contactSheets?.length ? renderReport.contactSheets : [contactSheet])
    .map((path) => resolve(path));
  const { sheets: sheetEvidence, aggregateHash } = contactSheetEvidence(contactSheets, context.outputDir);
  const renderReportHash = hashFile(renderReportPath);
  const visualEvidence = readdirSync(context.verificationDir)
    .filter((name) => /^mobile-.*\.png$/u.test(name))
    .sort()
    .map((name) => ({ path: relativePath(context.outputDir, join(context.verificationDir, name)), sha256: hashFile(join(context.verificationDir, name)) }));
  const requestHash = sha256({ contactSheetHash: aggregateHash, criteria: context.plan.aestheticReview.criteria, renderReportHash, visualEvidence });
  const request = {
    version: 1,
    requestHash,
    contactSheetHash: aggregateHash,
    renderReportHash,
    criteria: context.plan.aestheticReview.criteria,
    responseContract: "aesthetic-review",
    contactSheet: relativePath(context.outputDir, contactSheet),
    contactSheets: sheetEvidence,
    visualEvidence,
    report: relativePath(context.outputDir, renderReportPath)
  };
  atomicJson(join(context.verificationDir, "aesthetic-review-request.json"), request);
  if (!context.args["aesthetic-review"]) return { status: "requested", review: null };
  const reviewPath = resolve(context.args["aesthetic-review"]);
  const review = parsedContract("aesthetic-review", readFileSync(reviewPath), reviewPath);
  if (review.requestHash !== request.requestHash) throw new Error("aesthetic-review requestHash does not match the current review request");
  if (review.contactSheetHash !== request.contactSheetHash) throw new Error("aesthetic-review contactSheetHash does not match the current contact sheet");
  if (review.verdict !== "pass") throw new Error("aesthetic-review verdict is revise");
  atomicJson(join(context.verificationDir, "aesthetic-review.json"), review);
  return { status: "pass", review };
}

function writeArtifactManifest(context, tier, verification, aesthetic) {
  const manifest = {
    schemaVersion: 1,
    pipelineVersion: PIPELINE_VERSION,
    inputHash: context.inputHash,
    inputs: context.inputs,
    outputs: artifactPaths(context, tier, verification, aesthetic).map((path) => outputRecord(context.outputDir, path)).sort((a, b) => a.path.localeCompare(b.path)),
    verification: {
      tier,
      passed: true,
      pages: verification?.print?.pages ?? verification?.desktop?.pages ?? 0,
      sourceCoverage: verification?.print?.sourcePreservation?.ratio ?? verification?.desktop?.sourcePreservation?.ratio ?? 1,
      contactSheet: tier === "fast" ? "" : relativePath(context.outputDir, join(context.verificationDir, "contact-sheet.png"))
    },
    reasoning: {
      plan: relativePath(context.outputDir, context.inputPaths.plan),
      exceptions: context.plan.exceptions.length,
      aestheticReview: aesthetic.status
    }
  };
  assertContract("artifact-manifest", manifest);
  atomicJson(join(context.outputDir, "artifact-manifest.json"), manifest);
  return manifest;
}

function summary(context, status, tier, extra = {}) {
  return { status, tier, inputHash: context.inputHash, html: context.outputHtml, ...extra };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = { ...validateInputs(args), args };
  if (args.mode !== "validate") mkdirSync(context.outputDir, { recursive: true });
  const releaseLock = args.mode === "validate" ? () => {} : acquirePipelineLock(context.outputDir);
  workspaceLockToken = releaseLock.token ?? null;
  try {
  const previous = previousState(context.outputDir);
  if (args.mode === "inventory") {
    mkdirSync(context.outputDir, { recursive: true });
    const inventory = createSourceInventory(context.parsed);
    atomicJson(join(context.outputDir, "planning-inventory.json"), inventory);
    console.log(JSON.stringify(summary(context, "pass", "fast", { inventory: join(context.outputDir, "planning-inventory.json"), blocks: inventory.blocks.length })));
    return;
  }
  if (args.mode === "validate") {
    console.log(JSON.stringify(summary(context, "pass", "fast", { blocks: context.parsed.sourceManifest.blocks.length })));
    return;
  }

  const desiredTier = args.tier;
  const unchanged = !args.force && previous?.inputHash === context.inputHash && previous.renderPassed === true &&
    TIER_RANK[previous.tier] >= TIER_RANK[desiredTier] && cachedOutputsMatch(previous, context, desiredTier);
  if (unchanged) {
    const verification = desiredTier === "fast" ? null : JSON.parse(readFileSync(join(context.verificationDir, "render-report.json"), "utf8"));
    const aesthetic = desiredTier === "full" ? validateAestheticReview(context) : { status: "not-required", review: null };
    if (aesthetic.status === "requested") {
      writeIterationContext(context, previous, desiredTier, "review-required", true);
      console.log(JSON.stringify(summary(context, "review-required", desiredTier, { contactSheet: join(context.verificationDir, "contact-sheet.png") })));
      process.exitCode = 3;
      return;
    }
    writeArtifactManifest(context, desiredTier, verification, aesthetic);
    writeIterationContext(context, previous, desiredTier, "pass", true);
    console.log(JSON.stringify(summary(context, "pass", desiredTier, { skipped: true, manifest: join(context.outputDir, "artifact-manifest.json") })));
    return;
  }

  runNode([builder, context.inputPaths.config, context.inputPaths.manuscript, context.inputPaths.plan], "HTML build", 180_000);
  fileHashCache.clear();
  let verification = null;
  if (desiredTier === "affected") {
    const sourceIds = changedSourceBlockIds(previous, context.parsed);
    const browserArgs = [browser, "verify", "--html", context.outputHtml, "--output-dir", context.verificationDir, "--profile", "affected", "--format", "summary"];
    if (sourceIds.length) browserArgs.push("--source-ids", sourceIds.join(","));
    runNode(browserArgs, "affected browser verification", 300_000);
    fileHashCache.clear();
    verification = JSON.parse(readFileSync(join(context.verificationDir, "render-report.json"), "utf8"));
  } else if (desiredTier === "full") {
    runNode([browser, "finalize", "--html", context.outputHtml, "--pdf", context.pdfPath, "--output-dir", context.verificationDir, "--format", "summary"], "full browser finalization", 600_000);
    fileHashCache.clear();
    verification = JSON.parse(readFileSync(join(context.verificationDir, "render-report.json"), "utf8"));
  }
  const aesthetic = desiredTier === "full" ? validateAestheticReview(context) : { status: "not-required", review: null };
  if (aesthetic.status === "requested") {
    atomicJson(join(context.outputDir, "book-state.json"), stateFor(context, desiredTier, verification, aesthetic));
    writeIterationContext(context, previous, desiredTier, "review-required", false);
    console.log(JSON.stringify(summary(context, "review-required", desiredTier, { contactSheet: join(context.verificationDir, "contact-sheet.png") })));
    process.exitCode = 3;
    return;
  }
  writeArtifactManifest(context, desiredTier, verification, aesthetic);
  atomicJson(join(context.outputDir, "book-state.json"), stateFor(context, desiredTier, verification, aesthetic));
  writeIterationContext(context, previous, desiredTier, "pass", false);
  console.log(JSON.stringify(summary(context, "pass", desiredTier, {
    skipped: false,
    ...(desiredTier === "full" ? { pdf: context.pdfPath } : {}),
    manifest: join(context.outputDir, "artifact-manifest.json")
  })));
  } finally {
    workspaceLockToken = null;
    releaseLock();
  }
}

try {
  await main();
} catch (error) {
  console.error(`Book pipeline failed: ${error.message}`);
  console.log(JSON.stringify({ status: "fail", mode: process.argv[2] ?? null, error: { message: error.message } }));
  process.exitCode = 2;
}
