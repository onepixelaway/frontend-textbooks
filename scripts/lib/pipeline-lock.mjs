import { randomUUID } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

function removeStaleLock(path) {
  try {
    const owner = JSON.parse(readFileSync(path, "utf8"));
    if (processIsAlive(owner.pid)) return false;
  } catch {
    // A fresh unreadable lock may be between exclusive creation and its owner write.
    if (Date.now() - statSync(path).mtimeMs < 60_000) return false;
  }
  try { unlinkSync(path); } catch (error) { if (error.code !== "ENOENT") throw error; }
  return true;
}

export function acquirePipelineLock(outputDir, lockName = ".book-workspace.lock", requestedToken = process.env.BOOK_PIPELINE_LOCK_TOKEN) {
  if (!/^\.[a-z0-9-]+\.lock$/u.test(lockName)) throw new Error(`Invalid pipeline lock name: ${lockName}`);
  const path = join(outputDir, lockName);
  const token = requestedToken || randomUUID();
  let descriptor;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      descriptor = openSync(path, "wx");
      writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, token })}\n`);
      closeSync(descriptor);
      descriptor = undefined;
      break;
    } catch (error) {
      if (descriptor !== undefined) {
        closeSync(descriptor);
        descriptor = undefined;
        try { unlinkSync(path); } catch {}
      }
      if (error.code === "EEXIST" && requestedToken) {
        try {
          if (JSON.parse(readFileSync(path, "utf8")).token === requestedToken) {
            const release = () => {};
            release.token = requestedToken;
            return release;
          }
        } catch {}
      }
      if (error.code !== "EEXIST" || attempt > 0 || !removeStaleLock(path)) {
        throw new Error(`Another book pipeline is already using ${outputDir}`);
      }
    }
  }
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    if (descriptor !== undefined) closeSync(descriptor);
    if (!existsSync(path)) return;
    try {
      if (JSON.parse(readFileSync(path, "utf8")).token === token) unlinkSync(path);
    } catch {
      // Never delete a lock we cannot prove belongs to this process invocation.
    }
  };
  release.token = token;
  return release;
}
