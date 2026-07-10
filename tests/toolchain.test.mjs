import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), "utf8");
}

test("browser runner uses the pinned local installation", async () => {
  const runner = await text("scripts/run-book-browser.sh");
  assert.doesNotMatch(runner, /npm install|mktemp/);
  assert.match(runner, /node_modules\/playwright/);
});

test("runtime dependencies are exact and lockfile-backed", async () => {
  const pkg = JSON.parse(await text("package.json"));
  const lock = JSON.parse(await text("package-lock.json"));

  for (const name of ["markdown-it", "playwright"]) {
    assert.match(pkg.dependencies[name], /^\d+\.\d+\.\d+$/);
    assert.equal(lock.packages[`node_modules/${name}`].version, pkg.dependencies[name]);
  }
});

test("skill shell commands resolve through SKILL_DIR", async () => {
  const skill = await text("SKILL.md");
  assert.match(skill, /SKILL_DIR="<absolute path to the directory containing this SKILL\.md>"/);
  assert.doesNotMatch(skill, /(?:node|bash) scripts\//);
});
