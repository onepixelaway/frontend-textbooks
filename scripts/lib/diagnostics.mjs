import { canonicalJson, sha256 } from "./content-hash.mjs";
import { GUARD_CHECKS, REPAIR_ACTIONS, REPORT_CHECKS } from "./verification-checks.mjs";
import { assertContract } from "./json-contracts.mjs";

function values(value) {
  if (Array.isArray(value)) return value;
  const count = Number(value) || 0;
  return Array.from({ length: count }, () => ({}));
}

function compactTarget(value) {
  if (typeof value === "string") return { pageId: value };
  if (!value || typeof value !== "object") return {};
  const pageId = String(value.page ?? value.frame ?? value.section ?? value.target ?? "");
  return {
    ...(pageId ? { pageId } : {}),
    ...(Array.isArray(value.sourceBlockIds) ? { sourceBlockIds: [...new Set(value.sourceBlockIds)] } : {}),
    ...(Array.isArray(value.sourceContext) ? { sourceContext: value.sourceContext.slice(0, 12) } : {}),
    ...(Array.isArray(value.evidencePaths) ? { evidencePaths: value.evidencePaths.slice(0, 12) } : {}),
    actual: value
  };
}

function diagnostic(code, viewport, value, index, message = "") {
  const target = compactTarget(value);
  const suffix = String(index + 1).padStart(3, "0");
  return {
    id: `diag-${viewport}-${code.toLowerCase().replaceAll("_", "-")}-${suffix}`,
    code,
    severity: "error",
    viewport,
    ...(target.pageId ? { pageId: target.pageId } : {}),
    ...(target.sourceBlockIds ? { sourceBlockIds: target.sourceBlockIds } : {}),
    ...(target.sourceContext ? { sourceContext: target.sourceContext } : {}),
    ...(target.evidencePaths ? { evidencePaths: target.evidencePaths } : {}),
    ...(target.actual && Object.keys(target.actual).length ? { actual: target.actual } : {}),
    message: message || `${code.replaceAll("_", " ").toLowerCase()} detected`
  };
}

function sourceCoverageFailure(sourcePreservation) {
  if (!sourcePreservation?.required) return null;
  const threshold = Number(sourcePreservation.threshold);
  const wordRatio = Number(sourcePreservation.ratio);
  const blockRatio = Number(sourcePreservation.blockRatio);
  const validThreshold = Number.isFinite(threshold);
  const wordCoverageLow = !Number.isFinite(wordRatio) || !validThreshold || wordRatio < threshold;
  const blockCoverageLow = !Number.isFinite(blockRatio) || !validThreshold || blockRatio < threshold;
  if (!wordCoverageLow && !blockCoverageLow) return null;
  const percentage = (ratio) => Number.isFinite(ratio) ? `${(ratio * 100).toFixed(1)}%` : "missing";
  return {
    threshold,
    wordRatio: Number.isFinite(wordRatio) ? wordRatio : null,
    blockRatio: Number.isFinite(blockRatio) ? blockRatio : null,
    message: `Source preservation is below the ${percentage(threshold)} threshold (words ${percentage(wordRatio)}, blocks ${percentage(blockRatio)})`
  };
}

export function normalizeDiagnostics(reports) {
  const items = [];
  for (const viewport of ["desktop", "print", "mobile"]) {
    const report = reports[viewport];
    if (!report) continue;
    if (!report.ready) items.push(diagnostic("READY_TIMEOUT", viewport, {}, 0, report.error || "Book did not become ready"));
    if (report.bookDataError) items.push(diagnostic("SOURCE_CONTRACT_INVALID", viewport, {}, 0, report.bookDataError));
    for (const [index, message] of (report.customBookFailures ?? []).entries()) {
      items.push(diagnostic("SOURCE_CONTRACT_INVALID", viewport, {}, index, message));
    }
    for (const { field, code } of GUARD_CHECKS) {
      values(report.diagnostics?.[field]).forEach((value, index) => items.push(diagnostic(code, viewport, value, index, String(value))));
    }
    const coverageFailure = sourceCoverageFailure(report.sourcePreservation);
    if (report.sourcePreservation?.errors?.length) {
      report.sourcePreservation.errors.forEach((value, index) => items.push(diagnostic("SOURCE_CONTRACT_INVALID", viewport, {}, index, value)));
    } else if (coverageFailure) {
      items.push(diagnostic("SOURCE_COVERAGE_LOW", viewport, {
        sourceBlockIds: report.sourcePreservation.failedBlockIds ?? [],
        wordRatio: coverageFailure.wordRatio,
        blockRatio: coverageFailure.blockRatio,
        threshold: coverageFailure.threshold,
        sourceContext: report.sourcePreservation.failedBlocks ?? []
      }, 0, coverageFailure.message));
    }
    for (const { field, code } of REPORT_CHECKS) {
      values(report[field]).forEach((value, index) => items.push(diagnostic(code, viewport, value, index)));
    }
    if (report.requireDiagrams && !report.diagramCount) items.push(diagnostic("DIAGRAM_REQUIRED", viewport, {}, 0, "Required diagram policy found no diagram"));
  }
  const uniqueItems = new Map();
  for (const item of items) {
    const key = canonicalJson({
      code: item.code,
      viewport: item.viewport,
      pageId: item.pageId ?? "",
      sourceBlockIds: item.sourceBlockIds ?? [],
      actual: item.actual ?? null,
      message: item.message
    });
    if (!uniqueItems.has(key)) uniqueItems.set(key, { ...item, id: `diag-${item.viewport}-${item.code.toLowerCase().replaceAll("_", "-")}-${sha256(key).slice(0, 10)}` });
  }
  const normalizedItems = [...uniqueItems.values()].sort((a, b) => a.id.localeCompare(b.id));
  return {
    schemaVersion: 1,
    status: normalizedItems.length ? "fail" : "pass",
    counts: { error: normalizedItems.length, warning: 0 },
    items: normalizedItems
  };
}

export function createRepairTasks(diagnostics) {
  return {
    schemaVersion: 1,
    reportHash: sha256(diagnostics),
    tasks: diagnostics.items.map((item) => ({
      failureId: item.id,
      code: item.code,
      viewport: item.viewport,
      target: item.pageId || "book",
      sourceBlockIds: item.sourceBlockIds ?? [],
      sourceContext: item.sourceContext ?? [],
      planSelectionIds: item.sourceBlockIds ?? [],
      evidencePaths: [...new Set(["contact-sheet.png", ...(item.evidencePaths ?? []), ...(item.viewport === "desktop" || item.viewport === "mobile" ? [`${item.viewport}-viewport.png`] : [])])],
      allowedActions: REPAIR_ACTIONS[item.code] ?? ["change-layout"],
      instruction: item.message
    }))
  };
}

export function validateRepairActions(tasks, actions) {
  assertContract("repair-tasks", tasks);
  assertContract("repair-actions", actions);
  if (actions.reportHash !== tasks.reportHash) throw new Error("repair-actions reportHash does not match repair-tasks");
  const tasksById = new Map(tasks.tasks.map((task) => [task.failureId, task]));
  const seen = new Set();
  const scopedActions = actions.actions.map((action) => {
    const task = tasksById.get(action.failureId);
    if (!task) throw new Error(`repair action references unknown failureId: ${action.failureId}`);
    if (seen.has(action.failureId)) throw new Error(`repair action repeats failureId: ${action.failureId}`);
    seen.add(action.failureId);
    if (!task.allowedActions.includes(action.action)) throw new Error(`repair action ${action.action} is not allowed for ${action.failureId}`);
    if (action.target !== task.target) throw new Error(`repair action target does not match ${action.failureId}`);
    return { task, action };
  });
  return { schemaVersion: 1, reportHash: tasks.reportHash, scopedActions };
}
