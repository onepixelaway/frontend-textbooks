#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { STYLE_NAMES } from "../themes/index.mjs";
import { resolveBookPaths } from "./lib/book-paths.mjs";
import { assertCoverGenerationReceiptFile, assertCoverImageRequestFile, createCoverImageRequest } from "./lib/cover-image-request.mjs";
import { inspectCoverBitmap, resolveCoverAssetTarget, resolveRequiredCoverAsset } from "./lib/cover-assets.mjs";
import { assertContract } from "./lib/json-contracts.mjs";
import { parseManuscript } from "./lib/manuscript.mjs";
import { assertPlanMatchesManuscript, assertPlanPolicy } from "./lib/plan-contract.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(scriptDir, "..");
const [configArg, manuscriptArg, planArg] = process.argv.slice(2);
if (!configArg || !manuscriptArg || !planArg) {
  console.error("Usage: node scripts/prepare-cover-image.mjs <book.json> <manuscript.md> <book-plan.json>");
  process.exit(1);
}

try {
  const requestedConfigPath = resolve(configArg);
  const config = assertContract("book-config", JSON.parse(readFileSync(requestedConfigPath, "utf8")));
  const manuscriptPath = resolve(manuscriptArg);
  const planPath = resolve(planArg);
  const manuscript = readFileSync(manuscriptPath, "utf8");
  const plan = assertContract("book-plan", JSON.parse(readFileSync(planPath, "utf8")));
  const parsed = parseManuscript(manuscript);
  assertPlanMatchesManuscript(plan, parsed, STYLE_NAMES);
  assertPlanPolicy(plan, config, parsed);
  const paths = resolveBookPaths({ configPath: requestedConfigPath, config, forbiddenRoots: [skillDir] });
  const request = createCoverImageRequest({ config, plan, outputDir: paths.outputDir });
  const target = resolveCoverAssetTarget(config.coverImage, paths.outputDir);
  mkdirSync(dirname(target), { recursive: true });
  mkdirSync(paths.outputDir, { recursive: true });
  const requestPath = join(paths.outputDir, "cover-image-request.json");
  const receiptPath = join(paths.outputDir, "cover-generation-receipt.json");
  if (existsSync(target)) {
    try {
      assertCoverImageRequestFile(requestPath, { config, plan, outputDir: paths.outputDir });
      const assetPath = resolveRequiredCoverAsset(config.coverImage, paths.outputDir);
      const report = inspectCoverBitmap(assetPath, {
        frame: request.constraints.frame,
        minimumDpi: request.constraints.minimumDpi
      });
      assertCoverGenerationReceiptFile(receiptPath, { config, plan, outputDir: paths.outputDir }, { assetPath, report });
      process.stdout.write(`${JSON.stringify({ status: "cover-ready", request: requestPath, target, requestHash: request.requestHash, assetHash: report.sha256 })}\n`);
    } catch (cause) {
      throw new Error(`COVER_TARGET_OCCUPIED: ${target} already exists without a valid receipt for the current manuscript request. Move or remove it, or choose a new coverImage target, before generating fresh artwork. (${cause.message})`);
    }
  } else {
    rmSync(receiptPath, { force: true });
    writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ status: "cover-generation-required", request: requestPath, target, requestHash: request.requestHash })}\n`);
  }
} catch (error) {
  console.error(`Cover preparation failed: ${error.message}`);
  process.exitCode = 2;
}
