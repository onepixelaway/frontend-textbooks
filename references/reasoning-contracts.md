# Reasoning Contracts

All model responses are strict JSON and must validate before application.

## Book plan

Use version 3 of `schemas/book-plan.schema.json` only after the user-selected color scheme is recorded in `book.json.style` and `book.json.themeOverrides`. Include editorial intent, registered theme and rationale, body layout and rationale, visual policy, the mandatory `visuals.cover` decision, structured `visuals.featurePages`, salient classifications, explicit exceptions, and subjective aesthetic criteria. The theme rationale records why the selected scheme suits the manuscript without duplicating its color tokens. Reference only IDs from `planning-inventory.json`. Do not copy manuscript paragraphs into rationales, feature labels, or diagram labels.

The cover decision names a manuscript-grounded subject and rationale, source IDs, meaningful alt text, focal point, and unique generation ID. It may not request baked-in typography. There is no cover exception. `book.json` and the plan must agree on theme, columns, opener policy, and selected route.

Unclassified blocks default to prose. A diagram references the smallest useful set of source IDs and supplies grammar, 2–6 concise nodes, valid edges, caption, and takeaway. A feature page declares a unique ID, kind, chapter anchor, complete grounding set, bounded display content, and rationale. Frameworks use 3–6 items; scorecards use two sides with matched metrics; numbers pages use 2–4 two-entry panels and one qualified highlight. Labels are authored summaries, not source sentences. Exceptions are model decisions with scope and rationale; scripts never infer the rationale.

## Repairs

Scripts emit `.verification/repair-tasks.json`. Give the model only the task, relevant source IDs/text, referenced plan selections, and evidence images. Return `repair-actions.json` under `schemas/repair-actions.schema.json`. Every action must reference an existing failure ID and use an allowed action.

## Aesthetic review

Scripts emit `.verification/aesthetic-review-request.json` from resolved structured facts. Inspect its exact final-cover desktop/mobile evidence, cover thumbnail, and contact sheets. Return `aesthetic-review.json` under `schemas/aesthetic-review.schema.json`, copying `contactSheetHash` exactly. The model owns strengths, issues, actions, and verdict. Scripts validate the response but never invent aesthetic scores or approval. Do not restate measurable configuration such as column count, route, or theme in free-form criteria.

Use `revise` for weak hierarchy, accidental whitespace, inconsistent page rhythm, illegible diagrams, poor crops, incoherent typography, or broken mobile reading. Use `pass` only when the whole book is credible, including its weakest pages.
