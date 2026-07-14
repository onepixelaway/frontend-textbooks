import { DEFAULT_THEME_NAME, getTheme } from "../../themes/index.mjs";

const COVER_ROUTES = ["type", "symbol", "photo", "minimal", "press"];
const BODY_COLUMNS = ["text-two", "text-single", "text-three"];

export function hasPlanException(plan, rule) {
  return Boolean(plan?.exceptions.some((entry) => entry.rule === rule));
}

function normalizedAsset(value) {
  try {
    return decodeURIComponent(String(value ?? "").trim().replace(/\\/gu, "/").replace(/^(?:\.\/)+/u, ""));
  } catch {
    return String(value ?? "").trim().replace(/\\/gu, "/");
  }
}

function assertMeaningfulCoverDecision(cover) {
  const alt = cover.altText.trim().toLocaleLowerCase("und");
  if (["cover", "cover art", "cover image", "book cover", "book cover image"].includes(alt) || /\.(?:png|jpe?g|webp)$/iu.test(alt)) {
    throw new Error("book-plan visuals.cover.altText must describe the artwork meaningfully; filenames and generic cover labels are invalid");
  }
  if (/\b(?:title|subtitle|author name|logo|typography|text reading)\b/iu.test(cover.subject)) {
    throw new Error("book-plan visuals.cover.subject must describe artwork without baked-in title, author, logo, or typography");
  }
}

function assertDiagramContract(diagram, index) {
  const ids = diagram.nodes.map((node) => node.id);
  if (new Set(ids).size !== ids.length) throw new Error(`book-plan diagram ${index + 1} contains duplicate node ids`);
  const known = new Set(ids);
  for (const edge of diagram.edges) {
    if (!known.has(edge.from) || !known.has(edge.to)) {
      throw new Error(`book-plan diagram ${index + 1} edge ${edge.from} -> ${edge.to} references an unknown node`);
    }
    if (edge.from === edge.to) throw new Error(`book-plan diagram ${index + 1} contains a self-referencing edge for ${edge.from}`);
  }
  if (["sequence", "hierarchy", "system"].includes(diagram.grammar) && !diagram.edges.length) {
    throw new Error(`book-plan ${diagram.grammar} diagram ${index + 1} must declare at least one relationship edge`);
  }
}

function assertSubjectiveAestheticCriteria(criteria) {
  const measurableConfiguration = /\b(?:(?:one|single|two|three|[123])[- ]column|(?:type|symbol|photo|minimal|press)[ -]cover(?: route)?|(?:colbalt|cobalt|default|executive|alumni|field-guide|scholarly|technical|literary)[ -]theme)\b/iu;
  const invalid = criteria.filter((criterion) => measurableConfiguration.test(criterion));
  if (invalid.length) {
    throw new Error(`book-plan aestheticReview.criteria must contain subjective review criteria, not measurable configuration already represented by structured plan fields: ${invalid.join(" | ")}`);
  }
}

export function assertPlanMatchesManuscript(plan, parsed, registeredThemes) {
  if (!registeredThemes.includes(plan.theme.id)) throw new Error(`book-plan theme.id must be registered: ${plan.theme.id}`);
  if (plan.manuscriptHash !== parsed.sourceManifest.sha256) {
    throw new Error("book-plan manuscriptHash does not match the current manuscript");
  }
  const sourceIds = new Set(parsed.sourceManifest.blocks.map((block) => block.id));
  const classificationIds = plan.classifications.map((entry) => entry.sourceBlockId);
  const seenClassifications = new Set();
  const duplicateClassifications = new Set();
  for (const id of classificationIds) {
    if (seenClassifications.has(id)) duplicateClassifications.add(id);
    seenClassifications.add(id);
  }
  if (duplicateClassifications.size) {
    throw new Error(`book-plan classifies source block(s) more than once: ${[...duplicateClassifications].join(", ")}`);
  }
  const referencedIds = [
    ...classificationIds,
    ...plan.visuals.cover.sourceBlockIds,
    ...plan.visuals.diagrams.flatMap((entry) => entry.sourceBlockIds)
  ];
  const unknown = [...new Set(referencedIds.filter((id) => !sourceIds.has(id)))];
  if (unknown.length) throw new Error(`book-plan references unknown source block id(s): ${unknown.join(", ")}`);
  assertMeaningfulCoverDecision(plan.visuals.cover);
  plan.visuals.diagrams.forEach(assertDiagramContract);
  assertSubjectiveAestheticCriteria(plan.aestheticReview.criteria);
  const diagramGrounding = new Set(plan.visuals.diagrams.flatMap((entry) => entry.sourceBlockIds));
  const unmaterialized = plan.classifications
    .filter((entry) => entry.treatment === "diagram" && !diagramGrounding.has(entry.sourceBlockId))
    .map((entry) => entry.sourceBlockId);
  if (unmaterialized.length) throw new Error(`diagram classifications require a structured visuals.diagrams decision: ${unmaterialized.join(", ")}`);
  if (plan.visuals.images.some((image) => image.scope.trim().toLocaleLowerCase("und") === "cover")) {
    throw new Error("book-plan visuals.images must not duplicate the mandatory visuals.cover decision");
  }
}

export function resolvedPlanFacts(config, plan) {
  const configTheme = getTheme(config.style ?? DEFAULT_THEME_NAME).id;
  const planTheme = getTheme(plan.theme.id).id;
  return {
    theme: planTheme,
    configTheme,
    bodyColumns: plan.layout.bodyColumns,
    configBodyColumns: config.bodyColumns ?? "text-two",
    chapterOpeners: plan.layout.chapterOpeners,
    configChapterOpeners: config.chapterOpeners ?? false,
    coverRoute: plan.layout.coverRoute,
    configCoverRoute: config.selectedCoverRoute ?? "photo",
    imagePolicy: plan.visuals.policy,
    coverRequired: true
  };
}

export function assertPlanPolicy(plan, config, parsed) {
  const facts = resolvedPlanFacts(config, plan);
  if (facts.theme !== facts.configTheme) {
    throw new Error(`book-plan theme.id (${plan.theme.id}) conflicts with book.json style (${config.style ?? DEFAULT_THEME_NAME})`);
  }
  if (!BODY_COLUMNS.includes(facts.configBodyColumns) || facts.bodyColumns !== facts.configBodyColumns) {
    throw new Error(`book-plan layout.bodyColumns (${facts.bodyColumns}) conflicts with book.json bodyColumns (${facts.configBodyColumns})`);
  }
  if (facts.chapterOpeners !== facts.configChapterOpeners) {
    throw new Error(`book-plan layout.chapterOpeners (${facts.chapterOpeners}) conflicts with book.json chapterOpeners (${facts.configChapterOpeners})`);
  }
  if (!COVER_ROUTES.includes(facts.configCoverRoute) || facts.coverRoute !== facts.configCoverRoute) {
    throw new Error(`book-plan layout.coverRoute (${facts.coverRoute}) conflicts with book.json selectedCoverRoute (${facts.configCoverRoute})`);
  }
  if (config.requireDiagrams === false && !hasPlanException(plan, "waive-diagrams")) {
    throw new Error("requireDiagrams=false requires a waive-diagrams exception in book-plan");
  }
  if (config.requirePartImages === false && parsed.parts.length && !hasPlanException(plan, "waive-part-images")) {
    throw new Error("requirePartImages=false requires a waive-part-images exception in book-plan when parts exist");
  }
  if (config.fontMode === "remote" && !hasPlanException(plan, "allow-remote-fonts")) {
    throw new Error("fontMode=remote requires an allow-remote-fonts exception in book-plan");
  }
  const cover = normalizedAsset(config.coverImage);
  const reused = [
    ...Object.entries(config.partImages ?? {}).map(([scope, asset]) => ({ scope: `partImages.${scope}`, asset })),
    ...parsed.assetReferences.map((asset, index) => ({ scope: `manuscript image ${index + 1}`, asset }))
  ].filter((entry) => normalizedAsset(entry.asset) === cover);
  if (reused.length) {
    throw new Error(`coverImage must be unique and cannot be reused by ${reused.map((entry) => entry.scope).join(", ")}`);
  }
}
