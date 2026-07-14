export const GUARD_CHECKS = Object.freeze([
  { field: "pageErrors", code: "PAGE_ERROR" },
  { field: "blockedRequests", code: "REQUEST_BLOCKED" },
  { field: "requestFailures", code: "REQUEST_BLOCKED" },
  { field: "httpFailures", code: "ASSET_FAILURE" },
  { field: "assetFailures", code: "ASSET_FAILURE" },
  { field: "readinessFailures", code: "READY_TIMEOUT" }
]);

export const REPORT_CHECKS = Object.freeze([
  { field: "preflightOverflows", code: "ATOMIC_BLOCK_OVERSIZE", message: "planned atomic element(s) exceed a text page", actions: ["rewrite-visual", "change-layout"] },
  { field: "overflowFrames", code: "FRAME_OVERFLOW", message: "text frame(s) overflow", actions: ["repaginate", "change-layout"] },
  { field: "fixedPageOverflows", code: "PAGE_OVERFLOW", message: "fixed page(s) overflow or clip content", actions: ["repaginate", "change-layout", "remove-furniture"] },
  { field: "mobileHorizontalOverflows", code: "MOBILE_HORIZONTAL_OVERFLOW", message: "mobile horizontal overflow(s)", actions: ["change-layout"] },
  { field: "mobileColumnFailures", code: "MOBILE_MULTICOLUMN", message: "mobile text frame(s) remain multi-column", actions: ["change-layout"] },
  { field: "tailOverlaps", code: "TAIL_OVERLAP", message: "tail furniture block(s) overlap text" },
  { field: "missingTocTargets", code: "TOC_TARGET_MISSING", message: "table-of-contents page reference(s) are missing or blank" },
  { field: "continuationMarks", code: "CONTINUATION_MARK_VISIBLE", message: "continuation marker(s) are visible in text-page titles" },
  { field: "coverContractFailures", code: "COVER_ART_INVALID", message: "final selected cover does not display the required generated bitmap contract", actions: ["replace-asset", "change-layout"] },
  { field: "coverLayoutFailures", code: "COVER_LAYOUT_INVALID", message: "final selected cover has clipping, collision, focal-point, or title-wrap failures", actions: ["change-layout"] },
  { field: "controlOcclusions", code: "CONTROL_OCCLUSION", message: "browser controls can obscure manuscript content", actions: ["change-layout"] },
  { field: "coverAssetReuses", code: "COVER_ASSET_REUSED", message: "interior page asset(s) reuse the cover image", actions: ["replace-asset"] },
  { field: "textOnlyPartDividers", code: "PART_IMAGE_MISSING", message: "part divider(s) are missing generated image assets", actions: ["replace-asset"] },
  { field: "duplicatePartDividerAssets", code: "PART_IMAGE_DUPLICATE", message: "duplicated part-divider image asset(s)", actions: ["replace-asset"] },
  { field: "repeatedOpeningExcerpts", code: "OPENING_EXCERPT_REPEATED", message: "opening spread excerpt(s) repeat on the following body page" },
  { field: "unrequestedOpeningPages", code: "OPENING_UNREQUESTED", message: "unrequested opening page(s)" },
  { field: "shortTwoColumnPages", code: "SHORT_TWO_COLUMN", message: "short text page(s) should use text-short-single instead of sparse two-column layout" },
  { field: "sparseItemColumnGrids", code: "SPARSE_GRID_COLUMNS", message: "sparse item grid(s) should use sparse-item-rows instead of skinny columns" },
  { field: "missingMeasuredTextPages", code: "MEASURED_TEXT_MISSING", message: "book(s) have substantial unmeasured chapter-flow prose but no measured text pages" },
  { field: "unmeasuredChapterFlows", code: "UNMEASURED_FLOW", message: "long unmeasured chapter-flow section(s); use .page.text-page pagination or mark intentional plain-reader flow with data-allow-flowing-prose" },
  { field: "narrowChapterFlows", code: "NARROW_FLOW", message: "chapter-flow section(s) have accidentally narrow text measures" }
]);

export const REPAIR_ACTIONS = Object.freeze(Object.fromEntries([
  ...REPORT_CHECKS.filter((check) => check.actions).map((check) => [check.code, check.actions]),
  ["DIAGRAM_REQUIRED", ["rewrite-visual", "approve-exception"]],
  ["SOURCE_COVERAGE_LOW", ["repaginate"]]
]));
