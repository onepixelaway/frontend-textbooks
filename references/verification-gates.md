# Verification Gates

The full pipeline owns mechanical verification. Do not replace it with a visual guess.

Required gates:

1. Config, plan, paths, assets, and source references validate.
2. HTML reaches readiness with no browser/page/request/asset errors.
3. Desktop, print, and mobile have no overflow, clipping, accidental columns, broken contents links, or furniture collision.
4. Source word coverage and exact normalized-block coverage are each at least 90% and remain in source order.
5. Required diagrams and distinct part assets are present; cover art is not reused.
6. Contact-sheet aesthetic review passes when required.
7. PDF is atomic Letter output, has the expected page count, contains text when required, passes source block parity, and renders every page plus a contact sheet and semantic inspection set.
8. `artifact-manifest.json` hashes every delivered artifact only after all gates pass.

Use `.verification/diagnostics.json` for stable codes and measurements. Use `.verification/repair-tasks.json` for scoped model work. Inspect the contact sheet first, then only weak or ambiguous full-size pages. The detailed `render-report.json` is a fallback, not default model context.

On success, report only status, page count, coverage, artifact paths, and caveats. Do not paste source inventories or full reports into chat.
