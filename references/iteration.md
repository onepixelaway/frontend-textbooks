# Incremental Iteration

Choose the smallest safe tier:

- `fast`: config/schema/source/asset/build checks, no browser.
- `affected`: desktop/print/mobile render verification and contact sheet, no PDF.
- `full`: all rendered checks plus atomic PDF export and inspection.

The pipeline hashes normalized config, manuscript, plan, resolved output targets, exact local assets, canonical cover request, cover generation receipt, theme, toolchain, and pipeline implementation. A relevant route/layout/asset change invalidates rendering and aesthetic evidence; matching inputs reuse only hash-verified prior output. Use `--force true` for toolchain changes or suspected cache defects.

Read `iteration-context.json` after a run. It contains component-level change flags, changed source IDs, tier/status, and artifact locations; it intentionally excludes the manuscript and full HTML. On failure, use repair tasks, bounded source context, plan-selection IDs, and evidence paths rather than reloading global context. Validate the model's response with `book-contract.mjs validate-repairs` before editing.

Treat one repair packet as one batch. Address every independent actionable task that can be safely resolved together, validate the complete action set, apply it once, and run `affected` verification once. Repeat this batch-and-verify loop until affected verification passes. Do not run `full` between individual actions or while affected verification is failing; reserve full PDF export and inspection for the clean candidate. If full verification finds a new repairable issue, batch the new packet and return to affected verification before the next full run.

Default command output is a compact one-line JSON summary. Full reports remain under `.verification/`. Keep success output under 512 bytes and failure summaries under 2 KB; link to disk artifacts instead of printing them.
