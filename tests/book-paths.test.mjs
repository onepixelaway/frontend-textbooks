import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test, { after } from "node:test";

import { resolveBookPaths } from "../scripts/lib/book-paths.mjs";

const temporaryDirectories = [];
after(async () => Promise.all(temporaryDirectories.map((path) => rm(path, { recursive: true, force: true }))));

async function fixture(name = "book project") {
  const root = await mkdtemp(join(tmpdir(), "frontend-textbooks-paths-"));
  temporaryDirectories.push(root);
  const project = join(root, name);
  await mkdir(project, { recursive: true });
  const configPath = join(project, "book.json");
  await writeFile(configPath, "{}");
  return { root, project, configPath };
}

test("relative and omitted output directories resolve from the real config directory", async () => {
  const paths = await fixture();
  const project = await realpath(paths.project);
  assert.equal(resolveBookPaths({ configPath: paths.configPath, config: { outputDir: "build" } }).outputDir, join(project, "build"));
  assert.equal(resolveBookPaths({ configPath: paths.configPath, config: {} }).outputDir, project);
});

test("absolute output directories inside the project remain stable across working directories", async () => {
  const paths = await fixture("project with spaces");
  const outputDir = join(paths.project, "absolute output");
  const first = resolveBookPaths({ configPath: paths.configPath, config: { outputDir } });
  const unrelated = await mkdtemp(join(tmpdir(), "frontend-textbooks-unrelated-"));
  temporaryDirectories.push(unrelated);
  const prior = process.cwd();
  process.chdir(unrelated);
  try {
    const second = resolveBookPaths({ configPath: paths.configPath, config: { outputDir } });
    assert.equal(second.outputDir, first.outputDir);
  } finally {
    process.chdir(prior);
  }
});

test("config symlinks use the canonical source file directory as their path base", async (context) => {
  const paths = await fixture("canonical");
  const links = join(paths.root, "links");
  await mkdir(links);
  const linkedConfig = join(links, "book.json");
  try {
    await symlink(paths.configPath, linkedConfig);
  } catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) return context.skip("symlinks unavailable");
    throw error;
  }
  const resolved = resolveBookPaths({ configPath: linkedConfig, config: { outputDir: "build" } });
  assert.equal(resolved.configPath, await realpath(paths.configPath));
  assert.equal(resolved.outputDir, join(await realpath(paths.project), "build"));
});

test("output traversal and existing symlink escapes are rejected", async (context) => {
  const paths = await fixture();
  assert.throws(
    () => resolveBookPaths({ configPath: paths.configPath, config: { outputDir: "../outside" } }),
    /outside the book project|traversal/i
  );
  const outside = join(paths.root, "outside");
  const link = join(paths.project, "linked-build");
  await mkdir(outside);
  try {
    await symlink(outside, link);
  } catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) return context.skip("symlinks unavailable");
    throw error;
  }
  assert.throws(
    () => resolveBookPaths({ configPath: paths.configPath, config: { outputDir: "linked-build" } }),
    /symbolic link|outside the book project/i
  );
});

test("generated output is rejected when it targets the skill source or installation tree", async () => {
  const paths = await fixture();
  const skillRoot = resolve(paths.project, "skill");
  await mkdir(skillRoot);
  assert.throws(
    () => resolveBookPaths({ configPath: paths.configPath, config: { outputDir: "skill/build" }, forbiddenRoots: [skillRoot] }),
    /skill source|installation/i
  );
});
