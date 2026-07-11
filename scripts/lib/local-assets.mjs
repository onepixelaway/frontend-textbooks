import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

function isOutside(root, candidate) {
  const path = relative(root, candidate);
  return path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path);
}

export function resolveLocalAsset(value, baseDirectory, label = "asset", allowedRoot = baseDirectory) {
  const asset = String(value ?? "").trim();
  if (!asset) return null;
  if (asset.startsWith("//")) throw new Error(`${label} uses a protocol-relative URL; use an explicit https:// URL.`);
  if (/^https?:\/\//iu.test(asset) || /^data:image\//iu.test(asset)) return null;
  if (/^[a-z][a-z\d+.-]*:/iu.test(asset)) throw new Error(`${label} uses an unsupported asset URL scheme.`);
  const encodedPath = asset.replace(/\\/gu, "/").split(/[?#]/u, 1)[0];
  let pathOnly;
  try {
    pathOnly = decodeURIComponent(encodedPath);
  } catch {
    throw new Error(`${label} contains invalid URL encoding.`);
  }
  if (pathOnly.includes("\0")) throw new Error(`${label} contains an invalid null byte.`);
  const candidate = resolve(baseDirectory, pathOnly);
  const root = resolve(allowedRoot);
  if (isOutside(root, candidate)) throw new Error(`${label} resolves outside outputDir: ${candidate}`);
  if (existsSync(root) && existsSync(candidate) && isOutside(realpathSync(root), realpathSync(candidate))) {
    throw new Error(`${label} resolves outside outputDir through a symbolic link: ${candidate}`);
  }
  return candidate;
}
