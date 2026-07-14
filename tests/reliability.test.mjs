import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { promisify } from "node:util";

import { acquirePipelineLock } from "../scripts/lib/pipeline-lock.mjs";
import { runNodeScript } from "../scripts/lib/process-runner.mjs";
import { writeBookProject } from "./helpers/book-project.mjs";

const directories = [];
const execFileAsync = promisify(execFile);
const repository = new URL("..", import.meta.url).pathname;
after(async () => Promise.all(directories.map((path) => rm(path, { recursive: true, force: true }))));

test("pipeline lock excludes concurrent writers and recovers after release", async () => {
  const directory = await mkdtemp(join(tmpdir(), "book-lock-"));
  directories.push(directory);
  const release = acquirePipelineLock(directory);
  assert.throws(() => acquirePipelineLock(directory), /already using/);
  const releaseChild = acquirePipelineLock(directory, ".book-workspace.lock", release.token);
  releaseChild();
  assert.throws(() => acquirePipelineLock(directory), /already using/);
  release();
  const releaseAgain = acquirePipelineLock(directory);
  releaseAgain();
});

test("pipeline lock replaces a stale owner", async () => {
  const directory = await mkdtemp(join(tmpdir(), "book-stale-lock-"));
  directories.push(directory);
  await writeFile(join(directory, ".book-pipeline.lock"), JSON.stringify({ pid: 999_999_999 }));
  const release = acquirePipelineLock(directory);
  release();
});

test("pipeline lock does not steal a freshly-created unreadable lock", async () => {
  const directory = await mkdtemp(join(tmpdir(), "book-fresh-lock-"));
  directories.push(directory);
  await writeFile(join(directory, ".book-workspace.lock"), "");
  assert.throws(() => acquirePipelineLock(directory), /already using/);
});

test("pipeline subprocess timeout is bounded and actionable", async () => {
  const directory = await mkdtemp(join(tmpdir(), "book-timeout-"));
  directories.push(directory);
  const script = join(directory, "hang.mjs");
  await writeFile(script, "setInterval(() => {}, 1000);\n");
  assert.throws(
    () => runNodeScript([script], { cwd: directory, stage: "test render", timeoutMs: 1_000 }),
    /test render timed out after 1000ms/
  );
});

test("the workspace lock excludes direct builder and browser entry points", async () => {
  const directory = await mkdtemp(join(tmpdir(), "book-entry-lock-"));
  directories.push(directory);
  const project = await writeBookProject(directory, {
    manuscript: "# Locked\n\n## Chapter\n\nText.",
    configOverrides: { title: "Locked", outputDir: directory }
  });
  const release = acquirePipelineLock(project.outputDir);
  try {
    await assert.rejects(
      execFileAsync(process.execPath, [join(repository, "scripts/build-html-book.mjs"), project.configPath, project.manuscriptPath, project.planPath]),
      /already using/
    );
    await assert.rejects(
      execFileAsync(process.execPath, [join(repository, "scripts/book-browser.mjs"), "verify", "--html", join(project.outputDir, "index.html"), "--output-dir", join(project.outputDir, ".verification")]),
      /already using/
    );
  } finally {
    release();
  }
});
