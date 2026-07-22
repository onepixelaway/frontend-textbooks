import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync
} from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { isWithinPath } from "./book-paths.mjs";

const defaultOperations = Object.freeze({
  stat(path) {
    return lstatSync(path, { throwIfNoEntry: false });
  },
  mkdir(path) {
    mkdirSync(path, { recursive: true });
  },
  mkdtemp(prefix) {
    return mkdtempSync(prefix);
  },
  readDirectory(path) {
    return readdirSync(path);
  },
  rename(source, destination) {
    renameSync(source, destination);
  },
  remove(path) {
    rmSync(path, { recursive: true, force: true });
  },
  removeDirectory(path) {
    rmdirSync(path);
  }
});

function safeTarget(value) {
  const target = String(value ?? "").trim();
  const segments = target.split("/");
  if (
    !target ||
    isAbsolute(target) ||
    target.includes("\\") ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`Generated publication target must be a safe relative path: ${target}`);
  }
  return target;
}

function assertDirectory(path, label, operations) {
  const stat = operations.stat(path);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${label} must be a real directory: ${path}`);
  }
}

function assertSafeTree(path, label, operations) {
  const rootStat = operations.stat(path);
  if (!rootStat || rootStat.isSymbolicLink() || (!rootStat.isFile() && !rootStat.isDirectory())) {
    throw new Error(`${label} must be a regular file or real directory: ${path}`);
  }
  if (rootStat.isFile()) return rootStat;

  const pending = [path];
  while (pending.length) {
    const current = pending.pop();
    for (const name of operations.readDirectory(current)) {
      const candidate = resolve(current, name);
      const stat = operations.stat(candidate);
      if (!stat || stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) {
        throw new Error(`${label} must contain only regular files and real directories: ${candidate}`);
      }
      if (stat.isDirectory()) pending.push(candidate);
    }
  }
  return rootStat;
}

function assertIndependentTargets(targets) {
  for (let index = 0; index < targets.length; index += 1) {
    for (let other = index + 1; other < targets.length; other += 1) {
      if (targets[index] === targets[other]) {
        throw new Error(`Generated publication declares duplicate target: ${targets[index]}`);
      }
      if (targets[index].startsWith(`${targets[other]}/`) || targets[other].startsWith(`${targets[index]}/`)) {
        throw new Error(`Generated publication targets must not overlap: ${targets[index]} and ${targets[other]}`);
      }
    }
  }
}

function destinationParents(outputRoot, destination, operations) {
  const missing = [];
  let current = dirname(destination);
  while (current !== outputRoot) {
    if (!isWithinPath(outputRoot, current)) {
      throw new Error(`Generated publication target escapes outputDir: ${destination}`);
    }
    const stat = operations.stat(current);
    if (stat) {
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new Error(`Generated publication target must not traverse a symbolic link or file: ${current}`);
      }
      break;
    }
    missing.unshift(current);
    current = dirname(current);
  }
  return missing;
}

function rollbackPublication(states, createdParents, operations) {
  const errors = [];
  for (const state of [...states].reverse()) {
    if (state.published) {
      try {
        operations.remove(state.destination);
      } catch (error) {
        errors.push(error);
      }
    }
    if (state.backupMoved) {
      try {
        operations.rename(state.backup, state.destination);
      } catch (error) {
        errors.push(error);
      }
    }
  }
  for (const directory of [...createdParents].reverse()) {
    try {
      operations.removeDirectory(directory);
    } catch {
      // A parent created for publication is cleanup-only and may now contain unrelated concurrent output.
    }
  }
  return errors;
}

export function publishGeneratedTargets({ outputDir, stageRoot, targets, operations: overrides = {} }) {
  const operations = { ...defaultOperations, ...overrides };
  const outputRoot = resolve(outputDir);
  const stagedRoot = resolve(stageRoot);
  assertDirectory(outputRoot, "Generated publication outputDir", operations);
  assertDirectory(stagedRoot, "Generated publication stageRoot", operations);

  const normalizedTargets = targets.map(safeTarget);
  assertIndependentTargets(normalizedTargets);

  const records = normalizedTargets.map((target) => {
    const source = resolve(stagedRoot, target);
    const destination = resolve(outputRoot, target);
    if (!isWithinPath(stagedRoot, source) || !isWithinPath(outputRoot, destination)) {
      throw new Error(`Generated publication target escapes its root: ${target}`);
    }
    const sourceStat = assertSafeTree(source, `Staged generated target ${target}`, operations);
    const destinationStat = operations.stat(destination);
    if (destinationStat) {
      if (destinationStat.isSymbolicLink()) {
        throw new Error(`Generated publication destination must not be a symbolic link: ${destination}`);
      }
      if (sourceStat.isFile() !== destinationStat.isFile() || sourceStat.isDirectory() !== destinationStat.isDirectory()) {
        throw new Error(`Generated publication destination has the wrong type: ${destination}`);
      }
      assertSafeTree(destination, `Existing generated target ${target}`, operations);
    }
    return { target, source, destination, hadDestination: Boolean(destinationStat) };
  });

  const missingParents = [...new Set(records.flatMap(({ destination }) => destinationParents(outputRoot, destination, operations)))];
  const createdParents = [];
  const states = [];
  let backupRoot;
  let preserveBackup = false;

  try {
    backupRoot = operations.mkdtemp(resolve(outputRoot, ".book-build-backup-"));
    for (const directory of missingParents) {
      operations.mkdir(directory);
      createdParents.push(directory);
    }

    for (const record of records) {
      const backup = resolve(backupRoot, record.target);
      const state = { ...record, backup, backupMoved: false, published: false };
      states.push(state);
      if (record.hadDestination) {
        operations.mkdir(dirname(backup));
        operations.rename(record.destination, backup);
        state.backupMoved = true;
      }
      operations.rename(record.source, record.destination);
      state.published = true;
    }
  } catch (primaryError) {
    const rollbackErrors = rollbackPublication(states, createdParents, operations);
    preserveBackup = rollbackErrors.length > 0;
    if (rollbackErrors.length) {
      throw new AggregateError(
        [primaryError, ...rollbackErrors],
        `Generated output publication failed and rollback was incomplete: ${primaryError.message}`,
        { cause: primaryError }
      );
    }
    throw primaryError;
  } finally {
    if (backupRoot && !preserveBackup) {
      try {
        operations.remove(backupRoot);
      } catch {
        // The live target set is already committed or restored; cleanup must not change that result.
      }
    }
  }

  return normalizedTargets;
}
