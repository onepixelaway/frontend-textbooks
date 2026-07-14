#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { STYLE_NAMES } from "../themes/index.mjs";
import { resolveBookPaths } from "./lib/book-paths.mjs";
import { assertCoverImageRequestFile, createCoverGenerationReceipt } from "./lib/cover-image-request.mjs";
import { assertContract } from "./lib/json-contracts.mjs";
import { parseManuscript } from "./lib/manuscript.mjs";
import { assertPlanMatchesManuscript, assertPlanPolicy } from "./lib/plan-contract.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(scriptDir, "..");
const [configArg, manuscriptArg, planArg] = process.argv.slice(2);
if (!configArg || !manuscriptArg || !planArg) {
  console.error("Usage: node scripts/record-cover-image.mjs <book.json> <manuscript.md> <book-plan.json>");
  process.exit(1);
}

try {
  const requestedConfigPath = resolve(configArg);
  const config = assertContract("book-config", JSON.parse(readFileSync(requestedConfigPath, "utf8")));
  const manuscript = readFileSync(resolve(manuscriptArg), "utf8");
  const plan = assertContract("book-plan", JSON.parse(readFileSync(resolve(planArg), "utf8")));
  const parsed = parseManuscript(manuscript);
  assertPlanMatchesManuscript(plan, parsed, STYLE_NAMES);
  assertPlanPolicy(plan, config, parsed);
  const paths = resolveBookPaths({ configPath: requestedConfigPath, config, forbiddenRoots: [skillDir] });
  assertCoverImageRequestFile(join(paths.outputDir, "cover-image-request.json"), { config, plan, outputDir: paths.outputDir });
  const receipt = createCoverGenerationReceipt({ config, plan, outputDir: paths.outputDir });
  const receiptPath = join(paths.outputDir, "cover-generation-receipt.json");
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: "cover-recorded", receipt: receiptPath, asset: receipt.targetAsset, assetHash: receipt.assetHash })}\n`);
} catch (error) {
  console.error(`Cover recording failed: ${error.message}`);
  process.exitCode = 2;
}
