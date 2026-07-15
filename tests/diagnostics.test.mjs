import assert from "node:assert/strict";
import test from "node:test";
import { assertContract } from "../scripts/lib/json-contracts.mjs";
import { createRepairTasks, normalizeDiagnostics, validateRepairActions } from "../scripts/lib/diagnostics.mjs";

test("normalizes verifier findings into stable coded diagnostics", () => {
  const reports = {
    desktop: { ready: true, diagnostics: {}, sourcePreservation: { required: true, ratio: 1, blockRatio: 1, threshold: 0.9 }, fixedPageOverflows: [{ page: "page-2", reasons: ["vertical 12px"] }], diagramCount: 1 },
    print: { ready: true, diagnostics: {}, sourcePreservation: { required: true, ratio: 1, blockRatio: 1, threshold: 0.9 }, diagramCount: 1 },
    mobile: { ready: true, diagnostics: {}, sourcePreservation: { required: true, ratio: 0.5, blockRatio: 0.5, threshold: 0.9, failedBlockIds: ["source-p-1"], failedBlocks: [{ id: "source-p-1", text: "Missing source text" }] }, mobileColumnFailures: [{ frame: "page-2", columns: "2" }], diagramCount: 1 }
  };
  const result = normalizeDiagnostics(reports);
  assertContract("diagnostics", result);
  assert.deepEqual(result.items.map((item) => item.code), ["PAGE_OVERFLOW", "MOBILE_MULTICOLUMN", "SOURCE_COVERAGE_LOW"]);
  assert.deepEqual(result.items[2].sourceBlockIds, ["source-p-1"]);
});

test("fails diagnostics when block coverage is low but word coverage passes", () => {
  const result = normalizeDiagnostics({
    desktop: {
      ready: true,
      diagnostics: {},
      sourcePreservation: {
        required: true,
        ratio: 0.95,
        blockRatio: 0.5,
        threshold: 0.9,
        failedBlockIds: ["source-short"]
      },
      diagramCount: 0
    }
  });
  assert.equal(result.status, "fail");
  assert.equal(result.counts.error, 1);
  assert.equal(result.items[0].code, "SOURCE_COVERAGE_LOW");
  assert.match(result.items[0].message, /words 95\.0%, blocks 50\.0%/);
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

test("an early pagination abort keeps downstream evidence but emits only root repair tasks", () => {
  const diagnostics = normalizeDiagnostics({
    desktop: {
      ready: false,
      error: "Pagination stopped at an oversized atomic block",
      diagnostics: {},
      preflightOverflows: [{ page: "page-2", sourceBlockIds: ["source-p-long"] }],
      missingTocTargets: [{ target: "chapter-4" }, { target: "chapter-5" }],
      sourcePreservation: {
        required: true,
        threshold: 0.9,
        ratio: 0.25,
        blockRatio: 0.2,
        failedBlockIds: ["source-p-later"]
      },
      requireDiagrams: true,
      diagramCount: 0
    }
  });
  assertContract("diagnostics", diagnostics);
  const root = diagnostics.items.find((item) => item.code === "ATOMIC_BLOCK_OVERSIZE");
  assert.ok(root?.actionable);
  const derived = diagnostics.items.filter((item) => item.derived);
  assert.deepEqual(new Set(derived.map((item) => item.code)), new Set(["READY_TIMEOUT", "TOC_TARGET_MISSING", "SOURCE_COVERAGE_LOW", "DIAGRAM_REQUIRED"]));
  assert.ok(derived.every((item) => item.blockedBy.includes(root.id)));
  assert.deepEqual(createRepairTasks(diagnostics).tasks.map((task) => task.code), ["ATOMIC_BLOCK_OVERSIZE"]);
});

test("reports all independent preflight overflows in one repair packet", () => {
  const diagnostics = normalizeDiagnostics({
    desktop: {
      ready: false,
      diagnostics: {},
      preflightOverflows: [
        { page: "chapter-1", sourceBlockIds: ["source-a"] },
        { page: "chapter-3", sourceBlockIds: ["source-b"] },
        { page: "chapter-5", sourceBlockIds: ["source-c"] }
      ],
      sourcePreservation: { required: false },
      diagramCount: 1
    }
  });
  const tasks = createRepairTasks(diagnostics).tasks;
  assert.equal(tasks.length, 3);
  assert.ok(tasks.every((task) => task.code === "ATOMIC_BLOCK_OVERSIZE"));
  assert.deepEqual(tasks.flatMap((task) => task.sourceBlockIds).sort(), ["source-a", "source-b", "source-c"]);
});

test("the same preflight overflow across viewports produces one repair task", () => {
  const overflow = { page: "chapter-2", sourceBlockIds: ["source-shared"] };
  const report = { ready: false, diagnostics: {}, preflightOverflows: [overflow], sourcePreservation: { required: false }, diagramCount: 1 };
  const tasks = createRepairTasks(normalizeDiagnostics({ desktop: report, print: report, mobile: report })).tasks;
  assert.equal(tasks.length, 1);
  assert.deepEqual(tasks[0].observedViewports, ["desktop", "mobile", "print"]);
});

test("genuine source and TOC failures stay actionable after readiness succeeds", () => {
  const diagnostics = normalizeDiagnostics({
    desktop: {
      ready: true,
      diagnostics: {},
      missingTocTargets: [{ target: "chapter-2" }],
      sourcePreservation: { required: true, threshold: 0.9, ratio: 0.7, blockRatio: 0.8 },
      diagramCount: 1
    }
  });
  assert.ok(diagnostics.items.every((item) => item.actionable && !item.derived));
  assert.deepEqual(new Set(createRepairTasks(diagnostics).tasks.map((task) => task.code)), new Set(["TOC_TARGET_MISSING", "SOURCE_COVERAGE_LOW"]));
});

test("a required missing feature page produces one actionable structure repair", () => {
  const diagnostics = normalizeDiagnostics({
    desktop: {
      ready: true,
      diagnostics: {},
      sourcePreservation: { required: false },
      requireFeaturePages: true,
      featurePageCount: 0,
      diagramCount: 1
    }
  });
  assert.deepEqual(diagnostics.items.map((item) => item.code), ["FEATURE_PAGE_REQUIRED"]);
  assert.deepEqual(createRepairTasks(diagnostics).tasks.map((task) => task.allowedActions), [["rewrite-visual", "approve-exception"]]);
});
