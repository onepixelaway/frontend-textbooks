import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { contactSheetEvidence } from "../scripts/lib/aesthetic-review.mjs";

test("aesthetic aggregate authenticates every contact-sheet chunk", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "frontend-textbooks-aesthetic-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = join(root, "contact-sheet.png");
  const second = join(root, "contact-sheet-002.png");
  await writeFile(first, "first");
  await writeFile(second, "second");
  const original = contactSheetEvidence([first, second], root);
  assert.deepEqual(original.sheets.map((sheet) => sheet.path), ["contact-sheet.png", "contact-sheet-002.png"]);
  await writeFile(second, "changed");
  const changed = contactSheetEvidence([first, second], root);
  assert.notEqual(changed.aggregateHash, original.aggregateHash);
});
