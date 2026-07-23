import assert from "node:assert/strict";
import { renameSync, rmSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test, { after } from "node:test";
import { publishGeneratedTargets } from "../scripts/lib/generated-publication.mjs";

const temporaryDirectories = [];

after(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

test("generated publication rolls every target back and preserves the primary error", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "frontend-textbooks-publication-output-"));
  const stageRoot = await mkdtemp(join(tmpdir(), "frontend-textbooks-publication-stage-"));
  temporaryDirectories.push(outputDir, stageRoot);
  const firstTarget = join(outputDir, "first.txt");
  const secondTarget = join(outputDir, "second.txt");
  const sentinel = join(outputDir, "unrelated.txt");
  const stagedSecond = join(stageRoot, "second.txt");
  await Promise.all([
    writeFile(firstTarget, "old first"),
    writeFile(secondTarget, "old second"),
    writeFile(sentinel, "unrelated sentinel"),
    writeFile(join(stageRoot, "first.txt"), "new first"),
    writeFile(stagedSecond, "new second")
  ]);

  assert.throws(
    () => publishGeneratedTargets({
      outputDir,
      stageRoot,
      targets: ["first.txt", "second.txt"],
      operations: {
        rename(source, destination) {
          if (source === stagedSecond) throw new Error("injected second-target swap failure");
          renameSync(source, destination);
        },
        remove(path) {
          if (basename(path).startsWith(".book-build-backup-")) {
            throw new Error("injected cleanup failure");
          }
          rmSync(path, { recursive: true, force: true });
        }
      }
    }),
    /injected second-target swap failure/u
  );

  assert.equal(await readFile(firstTarget, "utf8"), "old first");
  assert.equal(await readFile(secondTarget, "utf8"), "old second");
  assert.equal(await readFile(sentinel, "utf8"), "unrelated sentinel");
});

test("generated publication creates only required parent directories", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "frontend-textbooks-publication-parent-output-"));
  const stageRoot = await mkdtemp(join(tmpdir(), "frontend-textbooks-publication-parent-stage-"));
  temporaryDirectories.push(outputDir, stageRoot);
  await mkdir(join(stageRoot, "assets", "fonts"), { recursive: true });
  await writeFile(join(stageRoot, "assets", "fonts", "Example.ttf"), "font bytes");
  await writeFile(join(outputDir, "unrelated.txt"), "unrelated sentinel");

  assert.deepEqual(
    publishGeneratedTargets({ outputDir, stageRoot, targets: ["assets/fonts"] }),
    ["assets/fonts"]
  );

  assert.equal(await readFile(join(outputDir, "assets", "fonts", "Example.ttf"), "utf8"), "font bytes");
  assert.equal(await readFile(join(outputDir, "unrelated.txt"), "utf8"), "unrelated sentinel");
});

test("incomplete rollback identifies and preserves the recoverable backup", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "frontend-textbooks-publication-recovery-output-"));
  const stageRoot = await mkdtemp(join(tmpdir(), "frontend-textbooks-publication-recovery-stage-"));
  temporaryDirectories.push(outputDir, stageRoot);
  const stagedSecond = join(stageRoot, "second.txt");
  await Promise.all([
    writeFile(join(outputDir, "first.txt"), "old first"),
    writeFile(join(outputDir, "second.txt"), "old second"),
    writeFile(join(stageRoot, "first.txt"), "new first"),
    writeFile(stagedSecond, "new second")
  ]);

  let failure;
  try {
    publishGeneratedTargets({
      outputDir,
      stageRoot,
      targets: ["first.txt", "second.txt"],
      operations: {
        rename(source, destination) {
          if (source === stagedSecond) throw new Error("injected publication failure");
          if (source.includes(".book-build-backup-") && source.endsWith("first.txt")) {
            throw new Error("injected rollback failure");
          }
          renameSync(source, destination);
        }
      }
    });
  } catch (error) {
    failure = error;
  }

  assert.ok(failure instanceof AggregateError);
  assert.match(failure.message, /rollback was incomplete.*preserved at/u);
  assert.match(failure.backupRoot, /\.book-build-backup-/u);
  assert.deepEqual(failure.targets, ["first.txt", "second.txt"]);
  assert.equal(await readFile(join(failure.backupRoot, "first.txt"), "utf8"), "old first");
});
