# Incremental Iteration

Choose the smallest safe tier:

- `fast`: config/schema/source/asset/build checks, no browser.
- `affected`: desktop/print/mobile render verification and contact sheet, no PDF.
- `full`: all rendered checks plus atomic PDF export and inspection.

The pipeline hashes config, manuscript, plan, assets, and pipeline version. Matching inputs reuse valid prior output. Use `--force true` for toolchain changes or suspected cache defects.

Read `iteration-context.json` after a run. It contains component-level change flags, changed source IDs, tier/status, and artifact locations; it intentionally excludes the manuscript and full HTML. On failure, use repair tasks, bounded source context, plan-selection IDs, and evidence paths rather than reloading global context. Validate the model's response with `book-contract.mjs validate-repairs` before editing.

Default command output is a compact one-line JSON summary. Full reports remain under `.verification/`. Keep success output under 512 bytes and failure summaries under 2 KB; link to disk artifacts instead of printing them.
