import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export function isWithinPath(root, candidate) {
  const value = relative(root, candidate);
  return value === "" || (value !== ".." && !value.startsWith(`..${sep}`) && !isAbsolute(value));
}

export function portableRelativePath(root, candidate) {
  return relative(root, candidate).split(sep).join("/");
}

function assertNoSymlinkComponents(root, candidate, label) {
  const path = relative(root, candidate);
  if (!path) return;
  let current = root;
  for (const segment of path.split(sep)) {
    current = resolve(current, segment);
    if (!existsSync(current)) return;
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`${label} must not traverse a symbolic link: ${current}`);
    }
  }
}

function canonicalProspectivePath(path) {
  let existing = path;
  const tail = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) break;
    tail.unshift(relative(parent, existing));
    existing = parent;
  }
  const canonical = existsSync(existing) ? realpathSync(existing) : resolve(existing);
  return resolve(canonical, ...tail);
}

function insideProject(projectRoot, candidate, label) {
  const canonicalCandidate = canonicalProspectivePath(candidate);
  if (!isWithinPath(projectRoot, canonicalCandidate)) {
    throw new Error(`${label} resolves outside the book project through path traversal or a symbolic link: ${candidate}`);
  }
  assertNoSymlinkComponents(projectRoot, canonicalCandidate, label);
  return canonicalCandidate;
}

function outputChild(outputDir, value, fallback, label) {
  const text = String(value ?? fallback).trim();
  if (!text) throw new Error(`${label} must not be empty`);
  const requested = isAbsolute(text) ? resolve(text) : resolve(outputDir, text);
  const candidate = canonicalProspectivePath(requested);
  if (!isWithinPath(outputDir, candidate)) throw new Error(`${label} must remain inside outputDir`);
  return candidate;
}

export function resolveBookPaths({
  configPath,
  config,
  pdf,
  verificationDir,
  forbiddenRoots = []
}) {
  const requestedConfig = resolve(configPath);
  const canonicalConfig = realpathSync(requestedConfig);
  const projectRoot = realpathSync(dirname(canonicalConfig));
  const configuredOutput = config.outputDir === undefined
    ? projectRoot
    : (isAbsolute(config.outputDir) ? resolve(config.outputDir) : resolve(projectRoot, config.outputDir));
  const outputDir = insideProject(projectRoot, configuredOutput, "outputDir");

  for (const rootValue of forbiddenRoots) {
    const root = canonicalProspectivePath(resolve(rootValue));
    if (isWithinPath(root, outputDir)) {
      throw new Error(`outputDir must not target the frontend-textbooks skill source or installation tree: ${outputDir}`);
    }
  }

  const outputHtmlName = String(config.outputHtml ?? "index.html");
  const outputHtml = outputChild(outputDir, outputHtmlName, "index.html", "outputHtml");
  const pdfPath = outputChild(outputDir, pdf, `${outputHtmlName.replace(/\.html?$/iu, "")}.pdf`, "pdf output");
  const verification = outputChild(outputDir, verificationDir, ".verification", "verification output");
  return {
    configPath: canonicalConfig,
    projectRoot,
    outputDir,
    outputHtml,
    pdfPath,
    verificationDir: verification
  };
}
