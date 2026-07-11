import { execFileSync } from "node:child_process";

function configuredTimeout(defaultTimeoutMs) {
  const raw = process.env.BOOK_PIPELINE_TIMEOUT_MS;
  if (raw === undefined) return defaultTimeoutMs;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1_000) throw new Error("BOOK_PIPELINE_TIMEOUT_MS must be an integer of at least 1000");
  return value;
}

export function runNodeScript(args, { cwd, stage = "pipeline subprocess", timeoutMs = 180_000, env = process.env } = {}) {
  const timeout = configuredTimeout(timeoutMs);
  try {
    return execFileSync(process.execPath, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
      timeout,
      killSignal: "SIGTERM",
      env
    });
  } catch (error) {
    if (error.code === "ETIMEDOUT" || error.signal === "SIGTERM") {
      throw new Error(`${stage} timed out after ${timeout}ms`);
    }
    const detail = String(error.stderr || error.stdout || "").trim();
    if (detail) throw new Error(`${stage} failed: ${detail.slice(0, 2_000)}`);
    throw error;
  }
}
