export function createSourceInventory(parsed) {
  return {
    schemaVersion: 1,
    source: {
      sha256: parsed.sourceManifest.sha256,
      normalization: "NFC+collapsed-whitespace",
      wordRule: "unicode-whitespace-v1",
      threshold: parsed.sourceManifest.threshold,
      totalWords: parsed.sourceManifest.totalWords,
      blockCount: parsed.sourceManifest.blocks.length
    },
    blocks: parsed.sourceManifest.blocks.map(({ id, ordinal, kind, chapterId, partId, sha256, wordCount }) => ({
      id, ordinal, kind, chapterId, partId, sha256, wordCount
    }))
  };
}
