import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";

import {
  canonicalPdfPagePath,
  cleanPdfPageImages,
  normalizePdfPageImages
} from "../scripts/lib/pdf-page-images.mjs";

const temporaryDirectories = [];
after(async () => Promise.all(temporaryDirectories.map((path) => rm(path, { recursive: true, force: true }))));

async function directory() {
  const path = await mkdtemp(join(tmpdir(), "frontend-textbooks-pages-"));
  temporaryDirectories.push(path);
  return path;
}

for (const pageCount of [1, 9, 10, 22, 99, 100, 127]) {
  test(`Poppler page names normalize canonically for ${pageCount} pages`, async () => {
    const root = await directory();
    const prefix = join(root, "pdf-page");
    const width = String(pageCount).length;
    for (let page = 1; page <= pageCount; page += 1) {
      await writeFile(`${prefix}-${String(page).padStart(width, "0")}.png`, `page-${page}`);
    }
    await writeFile(join(root, "unrelated-01.png"), "keep");
    const pages = normalizePdfPageImages(prefix, pageCount);
    assert.equal(pages.length, pageCount);
    assert.equal(pages[0], canonicalPdfPagePath(prefix, 1));
    assert.equal(pages.at(-1), canonicalPdfPagePath(prefix, pageCount));
    assert.ok((await readdir(root)).includes("unrelated-01.png"));
  });
}

test("cleanup removes stale canonical and padded pages but leaves unrelated PNGs", async () => {
  const root = await directory();
  const prefix = join(root, "pdf-page");
  await writeFile(`${prefix}-001.png`, "old");
  await writeFile(`${prefix}-22.png`, "old");
  await writeFile(join(root, "pdf-page-cover.png"), "keep");
  await writeFile(join(root, "other-001.png"), "keep");
  cleanPdfPageImages(prefix);
  assert.deepEqual((await readdir(root)).sort(), ["other-001.png", "pdf-page-cover.png"]);
});
