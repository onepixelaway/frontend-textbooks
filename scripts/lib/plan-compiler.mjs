function partScopeKeys(part, index) {
  return new Set([part.id, part.title, part.label, String(index + 1), `part-${String(index + 1).padStart(2, "0")}`].filter(Boolean));
}

export function compilePlan(plan, parsed, book) {
  const annotations = new Map();
  if (!plan) return { annotations, receipt: { schemaVersion: 1, status: "not-provided", classifications: [], diagrams: [], images: [] } };

  for (const decision of plan.classifications) {
    annotations.set(decision.sourceBlockId, {
      role: decision.role,
      treatment: decision.treatment,
      diagramConcepts: [],
      imageSubjects: []
    });
  }
  for (const diagram of plan.visuals.diagrams) {
    for (const sourceBlockId of diagram.sourceBlockIds) {
      const annotation = annotations.get(sourceBlockId) ?? { role: "process", treatment: "diagram", diagramConcepts: [], imageSubjects: [] };
      annotation.treatment = "diagram";
      annotation.diagramConcepts.push(diagram.concept);
      annotations.set(sourceBlockId, annotation);
    }
  }

  const images = plan.visuals.images.map((image) => {
    if (image.scope === "cover") {
      if (!book.coverImage) throw new Error("book-plan image scope cover requires config.coverImage to materialize the decision");
      return { scope: image.scope, subject: image.subject, asset: book.coverImage };
    }
    const part = parsed.parts.find((candidate, index) => partScopeKeys(candidate, index).has(image.scope));
    if (!part) throw new Error(`book-plan image scope is not executable; use cover or a parsed part key: ${image.scope}`);
    if (!part.image) throw new Error(`book-plan image scope ${image.scope} requires a matching config.partImages asset`);
    return { scope: image.scope, subject: image.subject, asset: part.image };
  });

  return {
    annotations,
    receipt: {
      schemaVersion: 1,
      status: "applied",
      classifications: plan.classifications.map(({ sourceBlockId, role, treatment }) => ({ sourceBlockId, role, treatment })),
      diagrams: plan.visuals.diagrams.map(({ sourceBlockIds, concept }) => ({ sourceBlockIds, concept })),
      images
    }
  };
}
