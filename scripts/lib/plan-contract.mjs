export function hasPlanException(plan, rule) {
  return Boolean(plan?.exceptions.some((entry) => entry.rule === rule));
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
    ...plan.visuals.diagrams.flatMap((entry) => entry.sourceBlockIds)
  ];
  const unknown = [...new Set(referencedIds.filter((id) => !sourceIds.has(id)))];
  if (unknown.length) throw new Error(`book-plan references unknown source block id(s): ${unknown.join(", ")}`);
}

export function assertPlanPolicy(plan, config, parsed) {
  if (config.requireDiagrams === false && !hasPlanException(plan, "waive-diagrams")) {
    throw new Error("requireDiagrams=false requires a waive-diagrams exception in book-plan");
  }
  if (config.requirePartImages === false && parsed.parts.length && !hasPlanException(plan, "waive-part-images")) {
    throw new Error("requirePartImages=false requires a waive-part-images exception in book-plan when parts exist");
  }
  if (config.fontMode === "remote" && !hasPlanException(plan, "allow-remote-fonts")) {
    throw new Error("fontMode=remote requires an allow-remote-fonts exception in book-plan");
  }
}
