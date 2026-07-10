import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const MANIFEST_NAME = "book-build-manifest.json";
function within(root, candidate) {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

function normalizeManifestPath(value, field = "manifest path") {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
  let decoded;
  try {
    decoded = decodeURIComponent(value.trim());
  } catch {
    throw new Error(`${field} contains invalid URL encoding`);
  }
  const normalized = decoded.replace(/\\/g, "/").replace(/^\.\//, "");
  if (normalized.includes("\0") || normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) {
    throw new Error(`${field} must be relative to the book directory`);
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`${field} contains an unsafe path segment`);
  }
  return segments.join("/");
}

function assertNoSymlink(rootPath, relativePath) {
  let current = rootPath;
  for (const segment of relativePath.split("/")) {
    current = resolve(current, segment);
    if (!existsSync(current)) return;
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed in book assets: ${relativePath}`);
    }
  }
}

function canonicalAllowedFile(rootReal, relativePath) {
  assertNoSymlink(rootReal, relativePath);
  const candidate = resolve(rootReal, relativePath);
  if (!within(rootReal, candidate)) {
    throw new Error(`Book asset escapes the serve directory: ${relativePath}`);
  }
  if (!existsSync(candidate)) throw new Error(`Book asset does not exist: ${relativePath}`);
  if (!lstatSync(candidate).isFile()) throw new Error(`Book asset must be a regular file: ${relativePath}`);
  const canonical = realpathSync(candidate);
  if (!within(rootReal, canonical)) {
    throw new Error(`Book asset resolves outside the serve directory: ${relativePath}`);
  }
  return canonical;
}

function normalizedRemoteUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

function extractExplicitRemoteUrls(html) {
  const urls = new Set();
  const source = String(html || "");
  const candidates = [];
  const assetAttribute = /<(?:img|script|link|source|video|audio|object|embed)\b[^>]*\b(?:src|href|poster|data)\s*=\s*(["'])(.*?)\1/gi;
  const srcsetAttribute = /\bsrcset\s*=\s*(["'])(.*?)\1/gi;
  const cssUrl = /url\(\s*(["']?)(.*?)\1\s*\)/gi;
  for (const match of source.matchAll(assetAttribute)) candidates.push(match[2]);
  for (const match of source.matchAll(srcsetAttribute)) {
    candidates.push(...match[2].split(",").map((entry) => entry.trim().split(/\s+/, 1)[0]));
  }
  for (const match of source.matchAll(cssUrl)) candidates.push(match[2]);
  for (const candidate of candidates) {
    const url = normalizedRemoteUrl(candidate.replace(/&amp;/g, "&"));
    if (url) urls.add(url);
  }
  return urls;
}

function readManifest(manifestPath) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid ${MANIFEST_NAME}: ${error.message}`);
  }
  if (!manifest || manifest.schemaVersion !== 1) {
    throw new Error(`${MANIFEST_NAME} must declare schemaVersion 1`);
  }
  if (!Array.isArray(manifest.files)) {
    throw new Error(`${MANIFEST_NAME} files must be an array`);
  }
  return manifest;
}

export function createStaticAssetContext(htmlPath) {
  const requestedEntry = resolve(htmlPath);
  if (!existsSync(requestedEntry)) {
    throw new Error(`File not found: ${htmlPath}`);
  }
  const entryStat = lstatSync(requestedEntry);
  if (entryStat.isSymbolicLink()) {
    throw new Error(`Book entry must not be a symbolic link: ${htmlPath}`);
  }
  if (!entryStat.isFile()) throw new Error(`Book entry is not a regular file: ${htmlPath}`);

  const rootPath = dirname(requestedEntry);
  if (lstatSync(rootPath).isSymbolicLink()) {
    throw new Error(`Book directory must not be a symbolic link: ${rootPath}`);
  }
  const rootReal = realpathSync(rootPath);
  const entryReal = realpathSync(requestedEntry);
  if (!within(rootReal, entryReal)) {
    throw new Error("Book entry resolves outside its serve directory");
  }

  const manifestPath = resolve(rootReal, MANIFEST_NAME);
  const hasManifest = existsSync(manifestPath);
  let manifest = null;
  const entryRelative = relative(rootReal, entryReal).split(sep).join("/");
  const allowedFiles = new Set([entryRelative]);
  const allowedRemoteUrls = extractExplicitRemoteUrls(readFileSync(entryReal, "utf8"));

  if (hasManifest) {
    if (lstatSync(manifestPath).isSymbolicLink()) {
      throw new Error(`${MANIFEST_NAME} must not be a symbolic link`);
    }
    manifest = readManifest(manifestPath);
    const declaredEntry = normalizeManifestPath(manifest.entry, "manifest entry");
    if (declaredEntry !== entryRelative) {
      throw new Error(`Manifest entry ${declaredEntry} does not match requested HTML ${entryRelative}`);
    }
    allowedFiles.add(MANIFEST_NAME);
    allowedFiles.add(declaredEntry);
    if (manifest.coverOptions) {
      allowedFiles.add(normalizeManifestPath(manifest.coverOptions, "manifest coverOptions"));
    }
    for (const [index, value] of manifest.files.entries()) {
      const remote = normalizedRemoteUrl(value);
      if (remote) {
        allowedRemoteUrls.add(remote);
      } else {
        allowedFiles.add(normalizeManifestPath(value, `manifest files[${index}]`));
      }
    }
  }

  for (const path of allowedFiles) {
    const canonical = canonicalAllowedFile(rootReal, path);
    if (path.toLowerCase().endsWith(".css") && existsSync(canonical)) {
      for (const url of extractExplicitRemoteUrls(readFileSync(canonical, "utf8"))) {
        allowedRemoteUrls.add(url);
      }
    }
  }
  return {
    rootReal,
    entryReal,
    entryRelative,
    manifest,
    manifestPath: hasManifest ? manifestPath : null,
    allowedFiles,
    allowedRemoteUrls
  };
}

function requestRelativePath(context, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(String(requestPath || "/").split("?")[0]);
  } catch {
    throw new Error("Request path contains invalid URL encoding");
  }
  if (decoded === "/") return context.entryRelative;
  return normalizeManifestPath(decoded.replace(/^\/+/, ""), "request path");
}

export function resolveAllowedRequest(context, requestPath) {
  const relativePath = requestRelativePath(context, requestPath);
  if (!context.allowedFiles.has(relativePath)) {
    throw new Error(`Blocked non-allowlisted book asset: ${relativePath}`);
  }
  return canonicalAllowedFile(context.rootReal, relativePath);
}

export function allowRemoteStylesheetDependencies(context, stylesheetUrl, cssText) {
  const pattern = /url\(\s*(["']?)(.*?)\1\s*\)/gi;
  for (const match of String(cssText || "").matchAll(pattern)) {
    try {
      const dependency = new URL(match[2], stylesheetUrl);
      if (["http:", "https:"].includes(dependency.protocol)) {
        dependency.hash = "";
        context.allowedRemoteUrls.add(dependency.href);
      }
    } catch {
      // Invalid CSS URLs remain blocked by the request policy.
    }
  }
}

export function browserRequestPolicy(context, requestUrl, localOrigin, method = "GET") {
  if (method !== "GET") {
    return { allowed: false, reason: `Blocked non-GET request: ${method} ${requestUrl}` };
  }
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return { allowed: false, reason: `Blocked invalid request URL: ${requestUrl}` };
  }
  if (["data:", "blob:", "about:"].includes(url.protocol)) return { allowed: true };
  if (url.origin === localOrigin) {
    try {
      const path = requestRelativePath(context, url.pathname);
      if (!context.allowedFiles.has(path)) {
        return { allowed: false, reason: `Blocked non-allowlisted local request: ${path}` };
      }
      return { allowed: true };
    } catch (error) {
      return { allowed: false, reason: error.message };
    }
  }
  const normalized = normalizedRemoteUrl(url.href);
  if (context.allowedRemoteUrls.has(normalized)) return { allowed: true };
  return { allowed: false, reason: `Blocked browser egress to unapproved URL: ${url.href}` };
}
