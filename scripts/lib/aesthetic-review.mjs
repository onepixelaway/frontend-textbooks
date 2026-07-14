import { readFileSync } from "node:fs";
import { portableRelativePath } from "./book-paths.mjs";
import { sha256 } from "./content-hash.mjs";

export function contactSheetEvidence(paths, outputDir) {
  const sheets = paths.map((path) => ({
    path: portableRelativePath(outputDir, path),
    sha256: sha256(readFileSync(path))
  }));
  return { sheets, aggregateHash: sha256(sheets) };
}
