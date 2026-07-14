function partScopeKeys(part, index) {
  return new Set([part.id, part.title, part.label, String(index + 1), `part-${String(index + 1).padStart(2, "0")}`].filter(Boolean));
}

function baseAnnotation(decision = {}) {
  return {
    role: decision.role ?? "narrative",
    treatment: decision.treatment ?? "prose",
    diagramGrounding: []
  };
}

export function compilePlan(plan, parsed, book, coverAsset = null) {
  const annotations = new Map();
  for (const decision of plan.classifications) {
    annotations.set(decision.sourceBlockId, baseAnnotation(decision));
  }

  for (const [index, diagram] of plan.visuals.diagrams.entries()) {
    const diagramId = `diagram-${String(index + 1).padStart(2, "0")}`;
    for (const sourceBlockId of diagram.sourceBlockIds) {
      const annotation = annotations.get(sourceBlockId) ?? baseAnnotation({ role: "process" });
      annotation.diagramGrounding.push(diagramId);
      annotations.set(sourceBlockId, annotation);
    }
    const anchorId = diagram.sourceBlockIds[0];
    annotations.get(anchorId).diagram = { id: diagramId, ...diagram };
  }

  const images = plan.visuals.images.map((image) => {
    const part = parsed.parts.find((candidate, index) => partScopeKeys(candidate, index).has(image.scope));
    if (!part) throw new Error(`book-plan image scope is not executable; use a parsed part key: ${image.scope}`);
    if (!part.image) throw new Error(`book-plan image scope ${image.scope} requires a matching config.partImages asset`);
    part.imageAlt = image.altText;
    return { scope: image.scope, subject: image.subject, altText: image.altText, asset: part.image };
  });

  return {
    annotations,
    receipt: {
      schemaVersion: 2,
      status: "applied",
      resolved: {
        theme: book.style,
        bodyColumns: book.bodyColumns,
        chapterOpeners: book.chapterOpeners,
        coverRoute: book.selectedCoverRoute,
        imagePolicy: plan.visuals.policy
      },
      cover: {
        sourceBlockIds: plan.visuals.cover.sourceBlockIds,
        subject: plan.visuals.cover.subject,
        rationale: plan.visuals.cover.rationale,
        altText: plan.visuals.cover.altText,
        focalPoint: plan.visuals.cover.focalPoint,
        generationId: plan.visuals.cover.generationId,
        requestHash: book.coverRequestHash,
        asset: book.coverImage,
        ...(coverAsset ? {
          sha256: coverAsset.sha256,
          width: coverAsset.width,
          height: coverAsset.height,
          frame: coverAsset.frame,
          effectiveDpi: coverAsset.effectiveDpi
        } : {})
      },
      classifications: plan.classifications.map(({ sourceBlockId, role, treatment }) => ({ sourceBlockId, role, treatment })),
      diagrams: plan.visuals.diagrams.map(({ sourceBlockIds, grammar, title, nodes, edges, caption, takeaway }) => ({ sourceBlockIds, grammar, title, nodes, edges, caption, takeaway })),
      images
    }
  };
}
