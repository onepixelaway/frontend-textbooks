import { mkdir, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { getTheme } from "../../themes/index.mjs";
import { createCoverGenerationReceipt, createCoverImageRequest } from "../../scripts/lib/cover-image-request.mjs";
import { sha256 } from "../../scripts/lib/content-hash.mjs";
import { parseManuscript } from "../../scripts/lib/manuscript.mjs";
import { bookPlan, writeTestPng } from "./fixture-assets.mjs";

export async function writeBookProject(root, {
  manuscript = "# Fixture Book\n\n## Chapter\n\nA deterministic source paragraph for the fixture.",
  configOverrides = {},
  planOverrides = {},
  coverDecisionOverrides = {},
  cover = {},
  writeCover = true,
  writeRequest = true
} = {}) {
  const configuredOutputDir = configOverrides.outputDir ?? join(root, "output");
  const requestedOutputDir = isAbsolute(configuredOutputDir) ? configuredOutputDir : resolve(root, configuredOutputDir);
  await mkdir(join(requestedOutputDir, "assets"), { recursive: true });
  const outputDir = await realpath(requestedOutputDir);
  const config = {
    title: "Fixture Book",
    author: "Test Author",
    outputDir: configuredOutputDir,
    coverImage: "assets/cover.png",
    style: "technical",
    selectedCoverRoute: "photo",
    bodyColumns: "text-single",
    chapterOpeners: false,
    requireDiagrams: false,
    requirePartImages: false,
    ...configOverrides
  };
  const parsed = parseManuscript(manuscript);
  const sourceBlockId = parsed.sourceManifest.blocks.find((block) => block.kind === "p")?.id ?? parsed.sourceManifest.blocks[0]?.id;
  const plan = bookPlan({
    manuscriptHash: parsed.sourceManifest.sha256,
    sourceBlockId,
    theme: getTheme(config.style).id,
    coverRoute: config.selectedCoverRoute ?? "photo",
    bodyColumns: config.bodyColumns ?? "text-two",
    chapterOpeners: config.chapterOpeners ?? false,
    ...planOverrides
  });
  const fixtureIdentity = sha256(root);
  plan.visuals.cover = {
    ...plan.visuals.cover,
    generationId: `fixture-${fixtureIdentity.slice(0, 24)}`,
    ...coverDecisionOverrides
  };
  if (parsed.parts.length && config.requirePartImages === false && !plan.exceptions.some((entry) => entry.rule === "waive-part-images")) {
    plan.exceptions.push({ rule: "waive-part-images", scope: "book", rationale: "This fixture intentionally omits generated part-divider artwork." });
  }
  const configPath = join(root, "book.json");
  const manuscriptPath = join(root, "manuscript.md");
  const planPath = join(root, "book-plan.json");
  await writeFile(configPath, JSON.stringify(config));
  await writeFile(manuscriptPath, manuscript);
  await writeFile(planPath, JSON.stringify(plan));
  const request = writeRequest ? createCoverImageRequest({ config, plan, outputDir }) : null;
  if (request) await writeFile(join(outputDir, "cover-image-request.json"), JSON.stringify(request));
  const uniqueCover = cover.rgb === undefined
    ? { ...cover, rgb: [
      24 + Number.parseInt(fixtureIdentity.slice(0, 2), 16) % 180,
      24 + Number.parseInt(fixtureIdentity.slice(2, 4), 16) % 180,
      24 + Number.parseInt(fixtureIdentity.slice(4, 6), 16) % 180
    ] }
    : cover;
  if (writeCover) await writeTestPng(join(outputDir, "assets", "cover.png"), uniqueCover);
  const generationReceipt = request && writeCover ? createCoverGenerationReceipt({ config, plan, outputDir }) : null;
  if (generationReceipt) await writeFile(join(outputDir, "cover-generation-receipt.json"), JSON.stringify(generationReceipt));
  return { root, outputDir, configPath, manuscriptPath, planPath, config, plan, parsed, sourceBlockId, request, generationReceipt };
}
