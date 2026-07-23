import assert from "node:assert/strict";
import test from "node:test";

import { parseManuscript } from "../scripts/lib/manuscript.mjs";
import { assertPlanMatchesManuscript, assertPlanPolicy } from "../scripts/lib/plan-contract.mjs";
import { STYLE_NAMES } from "../themes/index.mjs";
import { bookPlan, diagramDecision, frameworkFeature, numbersFeature, scorecardFeature } from "./helpers/fixture-assets.mjs";

function fixture() {
  const parsed = parseManuscript("# Contract Book\n\n## Chapter\n\nA source paragraph about a clear writing path.");
  const sourceBlockId = parsed.sourceManifest.blocks.find((block) => block.kind === "p").id;
  const config = {
    title: "Contract Book",
    author: "Author",
    coverImage: "assets/cover.png",
    style: "technical",
    bodyColumns: "text-single",
    chapterOpeners: false,
    selectedCoverRoute: "photo",
    requireDiagrams: false,
    requireFeaturePages: false,
    requirePartImages: false
  };
  const plan = bookPlan({ manuscriptHash: parsed.sourceManifest.sha256, sourceBlockId, theme: "technical" });
  return { parsed, sourceBlockId, config, plan };
}

test("plan/config coherence rejects contradictory theme, columns, route, and opener decisions", () => {
  const { parsed, config, plan } = fixture();
  for (const [field, value, pattern] of [
    ["style", "alumni", /theme\.id.*conflicts/i],
    ["bodyColumns", "text-two", /bodyColumns.*conflicts/i],
    ["selectedCoverRoute", "minimal", /coverRoute.*conflicts/i],
    ["chapterOpeners", true, /chapterOpeners.*conflicts/i]
  ]) {
    assert.throws(() => assertPlanPolicy(plan, { ...config, [field]: value }, parsed), pattern);
  }
});

test("generic alt text, unknown cover grounding, and cover reuse fail semantically", () => {
  const { parsed, config, plan } = fixture();
  const generic = structuredClone(plan);
  generic.visuals.cover.altText = "Cover image";
  assert.throws(() => assertPlanMatchesManuscript(generic, parsed, STYLE_NAMES), /altText.*meaningfully/i);

  const unknown = structuredClone(plan);
  unknown.visuals.cover.sourceBlockIds = ["source-missing"];
  assert.throws(() => assertPlanMatchesManuscript(unknown, parsed, STYLE_NAMES), /unknown source block/i);

  assert.throws(
    () => assertPlanPolicy(plan, { ...config, partImages: { Chapter: "assets/cover.png" } }, parsed),
    /coverImage must be unique/i
  );
});

test("structured diagrams reject unknown edges and remain grounded in source ids", () => {
  const { parsed, sourceBlockId, plan } = fixture();
  const invalid = structuredClone(plan);
  invalid.visuals.diagrams = [diagramDecision([sourceBlockId], { edges: [{ from: "notice", to: "missing" }] })];
  assert.throws(() => assertPlanMatchesManuscript(invalid, parsed, STYLE_NAMES), /unknown node/i);
});

test("structured feature pages require valid grounding, unique ids, and kind-specific bounded content", () => {
  const { parsed, sourceBlockId, plan } = fixture();
  const valid = structuredClone(plan);
  valid.visuals.featurePages = [
    frameworkFeature([sourceBlockId]),
    scorecardFeature([sourceBlockId]),
    numbersFeature([sourceBlockId])
  ];
  assert.doesNotThrow(() => assertPlanMatchesManuscript(valid, parsed, STYLE_NAMES));

  const unknownAnchor = structuredClone(valid);
  unknownAnchor.visuals.featurePages[0].anchorSourceBlockId = "source-p-missing";
  assert.throws(() => assertPlanMatchesManuscript(unknownAnchor, parsed, STYLE_NAMES), /feature page.*unknown.*anchor/i);

  const duplicate = structuredClone(valid);
  duplicate.visuals.featurePages[1].id = duplicate.visuals.featurePages[0].id;
  assert.throws(() => assertPlanMatchesManuscript(duplicate, parsed, STYLE_NAMES), /duplicate feature page id/i);

  const unbounded = structuredClone(valid);
  unbounded.visuals.featurePages[2].panels[0].entries.push({ label: "Path C", value: "0.42", barPercent: 42 });
  assert.throws(() => assertPlanMatchesManuscript(unbounded, parsed, STYLE_NAMES), /numbers feature page.*two entries/i);

  const mixedGrammar = structuredClone(valid);
  mixedGrammar.visuals.featurePages[0].verdict = "A framework cannot carry scorecard-only fields.";
  assert.throws(() => assertPlanMatchesManuscript(mixedGrammar, parsed, STYLE_NAMES), /fields for a different feature grammar/i);
});

test("designed nonfiction requires a planned skim page or an explicit waiver", () => {
  const { parsed, sourceBlockId, config, plan } = fixture();
  const requiredConfig = { ...config, requireFeaturePages: true };
  const missing = structuredClone(plan);
  missing.exceptions = missing.exceptions.filter((entry) => entry.rule !== "waive-feature-pages");
  assert.throws(() => assertPlanPolicy(missing, requiredConfig, parsed), /requires at least one structured.*featurePages/i);

  const planned = structuredClone(missing);
  planned.visuals.featurePages = [frameworkFeature([sourceBlockId])];
  assert.doesNotThrow(() => assertPlanPolicy(planned, requiredConfig, parsed));

  const waived = structuredClone(plan);
  assert.doesNotThrow(() => assertPlanPolicy(waived, { ...config, requireFeaturePages: false }, parsed));
});

test("aesthetic criteria cannot restate measurable layout configuration", () => {
  const { parsed, plan } = fixture();
  for (const criterion of ["comfortable two-column typography", "make the photo cover route feel premium", "honor the technical theme"]) {
    const invalid = structuredClone(plan);
    invalid.aestheticReview.criteria = [criterion];
    assert.throws(
      () => assertPlanMatchesManuscript(invalid, parsed, STYLE_NAMES),
      /subjective review criteria.*structured plan fields/i
    );
  }
  for (const theme of STYLE_NAMES) {
    const invalid = structuredClone(plan);
    invalid.aestheticReview.criteria = [`honor the ${theme} theme`];
    assert.throws(
      () => assertPlanMatchesManuscript(invalid, parsed, STYLE_NAMES),
      /subjective review criteria.*structured plan fields/i,
      `${theme} must remain a structured theme choice`
    );
  }
});
