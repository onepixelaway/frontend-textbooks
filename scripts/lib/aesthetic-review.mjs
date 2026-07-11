import { readFileSync } from "node:fs";
import { relative, sep } from "node:path";
import { sha256 } from "./content-hash.mjs";

export function contactSheetEvidence(paths, outputDir) {
  const sheets = paths.map((path) => ({
    path: relative(outputDir, path).split(sep).join("/"),
    sha256: sha256(readFileSync(path))
  }));
  return { sheets, aggregateHash: sha256(sheets) };
}
