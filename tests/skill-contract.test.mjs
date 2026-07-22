import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("skill core stays compact and routes optional detail progressively", async () => {
  const skill = await readFile(new URL("SKILL.md", root), "utf8");
  assert.ok(skill.split("\n").length <= 180, `SKILL.md has ${skill.split("\n").length} lines`);
  assert.ok(skill.split(/\s+/u).filter(Boolean).length <= 3000);
  assert.match(skill, /book-pipeline\.mjs/);
  assert.match(skill, /Scripts own deterministic work/);
  assert.match(skill, /model owns judgment/i);
  assert.doesNotMatch(skill, /Use expressive blue ink brushwork|Before generating the final HTML, read/);

  const references = [
    "intake-and-planning.md",
    "visual-system.md",
    "layout-and-html.md",
    "verification-gates.md",
    "reasoning-contracts.md",
    "iteration.md"
  ];
  await Promise.all(references.map(async (name) => {
    assert.match(skill, new RegExp(`references/${name.replace(".", "\\.")}`));
    const body = await readFile(new URL(`references/${name}`, root), "utf8");
    assert.ok(body.length > 100);
  }));
});

test("theme prompt prose has one executable source of truth", async () => {
  const files = [
    await readFile(new URL("SKILL.md", root), "utf8"),
    await readFile(new URL("STYLE_PRESETS.md", root), "utf8"),
    await readFile(new URL("themes/colbalt/index.mjs", root), "utf8")
  ];
  const signature = "Use expressive ink brushwork";
  assert.equal(files.filter((file) => file.includes(signature)).length, 1);
});

test("workflow pauses for a topic-aware user color and typography choice", async () => {
  const [skill, intake, reasoning, metadata, readme] = await Promise.all([
    readFile(new URL("SKILL.md", root), "utf8"),
    readFile(new URL("references/intake-and-planning.md", root), "utf8"),
    readFile(new URL("references/reasoning-contracts.md", root), "utf8"),
    readFile(new URL("agents/openai.yaml", root), "utf8"),
    readFile(new URL("README.md", root), "utf8")
  ]);

  assert.match(skill, /three numbered visual-system choices/i);
  assert.match(skill, /mark one as recommended/i);
  assert.match(skill, /wait for the user's answer/i);
  assert.match(skill, /style.*themeOverrides/is);
  assert.match(skill, /fontTheme/i);
  assert.match(skill, /scripts\/font-catalog\.mjs/u);
  assert.match(skill, /scripts\/acquire-google-fonts\.mjs/u);
  assert.match(skill, /never invent face filenames, weights, or license records/i);
  assert.match(skill, /requested (?:font|typeface)/i);
  assert.match(skill, /resolved colors govern page CSS and artwork prompts/i);
  assert.doesNotMatch(skill, /Use the default `colbalt` theme unless/i);
  assert.match(intake, /subject, tone, audience, and cultural context/i);
  assert.match(intake, /do not silently choose a default/i);
  assert.match(intake, /runtime prompt compilation uses only resolved colors/i);
  assert.match(intake, /fontTheme/i);
  assert.match(intake, /bundled typography/i);
  assert.match(intake, /scripts\/font-catalog\.mjs/u);
  assert.match(intake, /scripts\/acquire-google-fonts\.mjs/u);
  assert.match(reasoning, /user-selected color scheme/i);
  assert.match(metadata, /color and typography system/i);
  assert.match(readme, /recommend three manuscript-grounded visual systems/i);
  assert.match(readme, /typography/i);
});

test("instructions, metadata, and schemas agree that original cover artwork is mandatory", async () => {
  const [skill, metadata, configSchema, planSchema, artifactSchema] = await Promise.all([
    readFile(new URL("SKILL.md", root), "utf8"),
    readFile(new URL("agents/openai.yaml", root), "utf8"),
    readFile(new URL("schemas/book-config.schema.json", root), "utf8").then(JSON.parse),
    readFile(new URL("schemas/book-plan.schema.json", root), "utf8").then(JSON.parse),
    readFile(new URL("schemas/artifact-manifest.schema.json", root), "utf8").then(JSON.parse)
  ]);
  assert.match(skill, /original, manuscript-grounded local bitmap for every cover/i);
  assert.match(skill, /no waiver/i);
  assert.match(skill, /If image generation is unavailable or fails, stop/i);
  assert.doesNotMatch(skill, /generated images? (?:when|if) (?:useful|available)/i);
  assert.match(metadata, /unique manuscript-grounded cover artwork/i);
  assert.ok(configSchema.required.includes("coverImage"));
  assert.deepEqual(planSchema.properties.version.enum, [3]);
  assert.ok(planSchema.properties.visuals.required.includes("cover"));
  assert.ok(planSchema.properties.visuals.required.includes("featurePages"));
  assert.deepEqual(planSchema.properties.visuals.properties.featurePages.items.properties.kind.enum, ["framework", "scorecard", "numbers"]);
  assert.ok(planSchema.properties.visuals.properties.cover.required.includes("generationId"));
  assert.ok(!planSchema.properties.exceptions.items.properties.rule.enum.includes("waive-cover-image"));
  assert.ok(planSchema.properties.exceptions.items.properties.rule.enum.includes("waive-feature-pages"));
  assert.deepEqual(configSchema.properties.selectedCoverRoute.enum, ["photo", "minimal"]);
  assert.deepEqual(planSchema.properties.layout.properties.coverRoute.enum, ["photo", "minimal"]);
  assert.deepEqual(artifactSchema.properties.cover.properties.route.enum, ["photo", "minimal"]);
  assert.match(skill, /Photo and Minimal cover routes/);
});

test("every registered theme exposes one runtime cover prompt contract", async () => {
  const { THEMES } = await import("../themes/index.mjs");
  for (const [name, theme] of Object.entries(THEMES)) {
    assert.ok(theme.imagePrompt?.template, `${name} is missing imagePrompt.template`);
    assert.ok(theme.imagePrompt.template.includes(theme.imagePrompt.subjectPlaceholder), `${name} prompt is missing its subject placeholder`);
    assert.ok(theme.imagePrompt.template.includes(theme.imagePrompt.palettePlaceholder), `${name} prompt is missing its palette placeholder`);
    assert.ok(theme.imagePrompt.template.includes(theme.imagePrompt.constraintPlaceholder), `${name} prompt is missing its cover-constraint placeholder`);
    assert.doesNotMatch(theme.imagePrompt.template, /monochrome cobalt blue|warm white palette|peach and coral|powder blue|terracotta accents|tomato red|soft sage/i);
    assert.ok(theme.imagePrompt.coverArt?.safeArea, `${name} is missing cover safe-area guidance`);
  }
});
