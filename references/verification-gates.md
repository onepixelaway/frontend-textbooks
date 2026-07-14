# Verification Gates

The full pipeline owns mechanical verification. Do not replace it with a visual guess.

Required gates:

1. Config, plan, config-relative paths, assets, source references, and duplicated structured decisions validate coherently.
2. HTML reaches readiness with no browser/page/request/asset errors.
3. Desktop, print, and mobile have no overflow, clipping, accidental columns, broken contents links, or furniture collision.
4. Source word coverage and exact normalized-block coverage are each at least 90% and remain in source order.
5. The required local bitmap cover has a current request/generation receipt, meaningful alt text, sufficient effective resolution, visible use in the selected route, and no reuse by a part or interior image. Required diagrams and distinct part assets are present.
6. Final-cover desktop, thumbnail/contact-sheet, and mobile evidence is complete and matches the hashed cover asset; contact-sheet aesthetic review passes when required.
7. PDF is atomic Letter output, has the expected page count, contains extractable text, passes ordered source block parity, and renders every page plus a contact sheet and semantic inspection set. Verification tries strict default, raw, and layout-aware extraction and reports reading-order mismatch separately from genuinely missing text; it never accepts an unordered word bag.
8. `artifact-manifest.json` hashes every delivered artifact and the cover generation contract only after all gates pass.

Use `.verification/diagnostics.json` for stable codes, phases, causal links, and measurements. Derived TOC/source symptoms remain inspectable but stay out of actionable repair tasks while readiness or pagination blocks them. Use `.verification/repair-tasks.json` for scoped model work. Inspect the contact sheet first, then only weak or ambiguous full-size pages. The detailed `render-report.json` is a fallback, not default model context.

Migration: legacy configs and version 1 plans without original cover art now fail closed. Typical first errors are `coverImage is required`, `COVER_DECISION_REQUIRED`, `COVER_TARGET_OCCUPIED`, `COVER_REQUEST_MISSING`, `COVER_ASSET_MISSING`, or `COVER_GENERATION_RECEIPT_MISSING`. Add a new local `coverImage` target, migrate the plan to version 2 with `visuals.cover`, run `prepare-cover-image.mjs`, generate the exact requested bitmap, run `record-cover-image.mjs`, then rebuild. An existing target is accepted only when its current request, receipt, and bytes all revalidate; otherwise move/remove it or choose a new path. Existing type-only covers are not grandfathered in.

On success, report only status, page count, coverage, artifact paths, and caveats. Do not paste source inventories or full reports into chat.
