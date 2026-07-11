# Reasoning Contracts

All model responses are strict JSON and must validate before application.

## Book plan

Use `schemas/book-plan.schema.json`. Include editorial intent, registered theme and rationale, body layout and rationale, visual policy, salient classifications, explicit exceptions, and aesthetic criteria. Reference only IDs from `planning-inventory.json`. Do not copy manuscript paragraphs into rationales.

Unclassified blocks default to prose. A diagram references the smallest useful set of source IDs. Exceptions are model decisions with scope and rationale; scripts never infer the rationale.

## Repairs

Scripts emit `.verification/repair-tasks.json`. Give the model only the task, relevant source IDs/text, referenced plan selections, and evidence images. Return `repair-actions.json` under `schemas/repair-actions.schema.json`. Every action must reference an existing failure ID and use an allowed action.

## Aesthetic review

Scripts emit `.verification/aesthetic-review-request.json`. Inspect its exact contact sheet. Return `aesthetic-review.json` under `schemas/aesthetic-review.schema.json`, copying `contactSheetHash` exactly. The model owns strengths, issues, actions, and verdict. Scripts validate the response but never invent aesthetic scores or approval.

Use `revise` for weak hierarchy, accidental whitespace, inconsistent page rhythm, illegible diagrams, poor crops, incoherent typography, or broken mobile reading. Use `pass` only when the whole book is credible, including its weakest pages.
