import { canonicalJson, sha256 } from "./content-hash.mjs";
import { GUARD_CHECKS, REPAIR_ACTIONS, REPORT_CHECKS } from "./verification-checks.mjs";
import { assertContract } from "./json-contracts.mjs";

const PHASES = Object.freeze({
  SOURCE_CONTRACT_INVALID: "contract",
  PAGE_ERROR: "contract",
  REQUEST_BLOCKED: "contract",
  ASSET_FAILURE: "contract",
  COVER_ART_INVALID: "contract",
  COVER_ASSET_REUSED: "contract",
  PART_IMAGE_MISSING: "contract",
  PART_IMAGE_DUPLICATE: "contract",
  READY_TIMEOUT: "readiness",
  ATOMIC_BLOCK_OVERSIZE: "pagination",
  FRAME_OVERFLOW: "pagination",
  PAGE_OVERFLOW: "pagination",
  MOBILE_HORIZONTAL_OVERFLOW: "pagination",
  MOBILE_MULTICOLUMN: "pagination",
  TAIL_OVERLAP: "pagination",
  SHORT_TWO_COLUMN: "pagination",
  SPARSE_GRID_COLUMNS: "pagination",
  MEASURED_TEXT_MISSING: "pagination",
  UNMEASURED_FLOW: "pagination",
  NARROW_FLOW: "pagination",
  TOC_TARGET_MISSING: "structure",
  DIAGRAM_REQUIRED: "structure",
  SOURCE_COVERAGE_LOW: "source"
});

const PHASE_ORDER = Object.freeze(["contract", "readiness", "pagination", "structure", "source", "aesthetic", "pdf"]);

function phaseFor(code) {
  return PHASES[code] ?? "aesthetic";
}

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
    phase: phaseFor(code),
    actionable: true,
    derived: false,
    viewport,
    ...(target.pageId ? { pageId: target.pageId } : {}),
    ...(target.sourceBlockIds ? { sourceBlockIds: target.sourceBlockIds } : {}),
    ...(target.sourceContext ? { sourceContext: target.sourceContext } : {}),
    ...(target.evidencePaths ? { evidencePaths: target.evidencePaths } : {}),
    ...(target.actual && Object.keys(target.actual).length ? { actual: target.actual } : {}),
    message: message || `${code.replaceAll("_", " ").toLowerCase()} detected`
  };
}

function applyCausalStatus(items, reports) {
  for (const viewport of ["desktop", "print", "mobile"]) {
    const viewportItems = items.filter((item) => item.viewport === viewport);
    if (!viewportItems.length) continue;

    const contractRoots = viewportItems.filter((item) => item.phase === "contract");
    const preflightRoots = viewportItems.filter((item) => item.code === "ATOMIC_BLOCK_OVERSIZE");
    const paginationRoots = preflightRoots.length
      ? preflightRoots
      : viewportItems.filter((item) => item.code === "FRAME_OVERFLOW" || item.code === "PAGE_OVERFLOW");
    const readinessRoots = viewportItems.filter((item) => item.code === "READY_TIMEOUT");
    const incomplete = reports[viewport]?.ready !== true;

    let rootItems = contractRoots;
    if (!rootItems.length && incomplete) rootItems = paginationRoots.length ? paginationRoots : readinessRoots;
    if (!rootItems.length || !incomplete) continue;

    const rootIds = rootItems.map((item) => item.id).sort();
    for (const item of viewportItems) {
      if (rootIds.includes(item.id)) continue;
      const downstream = ["readiness", "structure", "source", "aesthetic"].includes(item.phase);
      const redundantPagination = paginationRoots.length && item.phase === "pagination" && !paginationRoots.some((root) => root.id === item.id);
      if (!downstream && !redundantPagination) continue;
      item.actionable = false;
      item.derived = true;
      item.blockedBy = rootIds;
    }
  }
  return items;
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
  const normalizedItems = applyCausalStatus([...uniqueItems.values()], reports).sort((a, b) => {
    const phaseDifference = PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase);
    return phaseDifference || a.id.localeCompare(b.id);
  });
  const actionableCount = normalizedItems.filter((item) => item.actionable).length;
  const derivedCount = normalizedItems.filter((item) => item.derived).length;
  return {
    schemaVersion: 2,
    status: normalizedItems.length ? "fail" : "pass",
    counts: { error: normalizedItems.length, warning: 0, actionable: actionableCount, derived: derivedCount },
    items: normalizedItems
  };
}

export function createRepairTasks(diagnostics) {
  const grouped = new Map();
  for (const item of diagnostics.items.filter((candidate) => candidate.actionable)) {
    const key = item.code === "ATOMIC_BLOCK_OVERSIZE"
      ? canonicalJson({ code: item.code, pageId: item.pageId ?? "", sourceBlockIds: [...(item.sourceBlockIds ?? [])].sort() })
      : item.id;
    const existing = grouped.get(key);
    if (existing) {
      existing.observedViewports.add(item.viewport);
      existing.items.push(item);
    } else {
      grouped.set(key, { primary: item, observedViewports: new Set([item.viewport]), items: [item] });
    }
  }
  return {
    schemaVersion: 2,
    reportHash: sha256(diagnostics),
    tasks: [...grouped.values()].map(({ primary: item, observedViewports, items }) => ({
      failureId: item.id,
      code: item.code,
      viewport: item.viewport,
      observedViewports: [...observedViewports].sort(),
      target: item.pageId || "book",
      sourceBlockIds: item.sourceBlockIds ?? [],
      sourceContext: item.sourceContext ?? [],
      planSelectionIds: item.sourceBlockIds ?? [],
      evidencePaths: [...new Set(["contact-sheet.png", ...items.flatMap((entry) => [
        ...(entry.evidencePaths ?? []),
        ...(entry.viewport === "desktop" || entry.viewport === "mobile" ? [`${entry.viewport}-viewport.png`] : [])
      ])])],
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
