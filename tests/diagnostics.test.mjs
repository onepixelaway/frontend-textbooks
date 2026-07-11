import assert from "node:assert/strict";
import test from "node:test";
import { assertContract } from "../scripts/lib/json-contracts.mjs";
import { createRepairTasks, normalizeDiagnostics, validateRepairActions } from "../scripts/lib/diagnostics.mjs";

test("normalizes verifier findings into stable coded diagnostics", () => {
  const reports = {
    desktop: { ready: true, diagnostics: {}, sourcePreservation: { required: true, ratio: 1, threshold: 0.9 }, fixedPageOverflows: [{ page: "page-2", reasons: ["vertical 12px"] }], diagramCount: 1 },
    print: { ready: true, diagnostics: {}, sourcePreservation: { required: true, ratio: 1, threshold: 0.9 }, diagramCount: 1 },
    mobile: { ready: true, diagnostics: {}, sourcePreservation: { required: true, ratio: 0.5, threshold: 0.9, failedBlockIds: ["source-p-1"], failedBlocks: [{ id: "source-p-1", text: "Missing source text" }] }, mobileColumnFailures: [{ frame: "page-2", columns: "2" }], diagramCount: 1 }
  };
  const result = normalizeDiagnostics(reports);
  assertContract("diagnostics", result);
  assert.deepEqual(result.items.map((item) => item.code), ["PAGE_OVERFLOW", "MOBILE_MULTICOLUMN", "SOURCE_COVERAGE_LOW"]);
  assert.deepEqual(result.items[2].sourceBlockIds, ["source-p-1"]);
});

test("creates compact, validated model repair tasks only for failures", () => {
  const diagnostics = normalizeDiagnostics({ desktop: { ready: true, diagnostics: {}, sourcePreservation: { required: false }, overflowFrames: [{ page: "page-2", sourceBlockIds: ["source-p-1"], sourceContext: [{ id: "source-p-1", text: "Bounded failing text" }], evidencePaths: ["desktop-page-0002.png"] }], diagramCount: 0 } });
  const tasks = createRepairTasks(diagnostics);
  assertContract("repair-tasks", tasks);
  assert.equal(tasks.tasks.length, 1);
  assert.deepEqual(tasks.tasks[0].allowedActions, ["repaginate", "change-layout"]);
  assert.deepEqual(tasks.tasks[0].sourceContext, [{ id: "source-p-1", text: "Bounded failing text" }]);
  assert.deepEqual(tasks.tasks[0].evidencePaths, ["contact-sheet.png", "desktop-page-0002.png", "desktop-viewport.png"]);
});

test("repair actions are scoped to the current failure packet", () => {
  const diagnostics = normalizeDiagnostics({ desktop: { ready: true, diagnostics: {}, sourcePreservation: { required: false }, overflowFrames: [{ page: "page-2" }], diagramCount: 0 } });
  const tasks = createRepairTasks(diagnostics);
  const action = {
    version: 1,
    reportHash: tasks.reportHash,
    actions: [{ failureId: tasks.tasks[0].failureId, action: "repaginate", target: "page-2", instruction: "Move the final block", rationale: "Remove overflow" }]
  };
  assert.equal(validateRepairActions(tasks, action).scopedActions.length, 1);
  assert.throws(() => validateRepairActions(tasks, { ...action, reportHash: "0".repeat(64) }), /does not match/);
  assert.throws(() => validateRepairActions(tasks, { ...action, actions: [{ ...action.actions[0], action: "replace-asset" }] }), /not allowed/);
});

test("diagnostic and repair IDs remain unique when guard categories share a code", () => {
  const diagnostics = normalizeDiagnostics({
    desktop: {
      ready: true,
      diagnostics: { blockedRequests: ["blocked local"], requestFailures: ["blocked remote"] },
      sourcePreservation: { required: false },
      diagramCount: 0
    }
  });
  assert.equal(diagnostics.items.length, 2);
  assert.equal(new Set(diagnostics.items.map((item) => item.id)).size, 2);
  const repairs = createRepairTasks(diagnostics);
  assert.equal(new Set(repairs.tasks.map((task) => task.failureId)).size, 2);
});
