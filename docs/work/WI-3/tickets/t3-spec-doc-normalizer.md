# T3 — Spec-doc normalizer

## What to build

A markdown document is a valid issue source: every level-2 (`##`) heading starts one
issue; heading text is the title; content until the next `##` is the description (tables,
lists, code fences inside a section are just description text); a `log: <path-or-url>`
line inside a section binds that issue's attachment. Every normalized entry has the
internal shape `{ id, description, attachedLog?, sourceType }` — shape-identical to a
GitHub issue's normalization. Entry id = `spec-<heading-slug>`, counter-suffixed
(`-2`, `-3`, …) on collision within the document. A document with zero `##` headings is
a loud rejection with a named error — never a silently empty queue, never partial
ingestion. `#` and `###` headings are not issue boundaries.

## Blocked by

None — can start immediately.

## Requirement coverage

FR-005 (and FR-007's shape-parity half); slice 2; grilling decisions 2–3; PRD US1
(L15), L33, L35, L90.

## Acceptance criteria

- [ ] Vitest: a spec-doc excerpt with three `##` sections (one carrying a `log:` line)
      normalizes to three entries, each shape-identical to a GitHub issue entry
      normalized by the existing normalizer (field-by-field comparison, `sourceType`
      excepted) — the PRD L90 shape-equality test.
- [ ] Vitest: slug derivation from heading text (whitespace/brace-stripping behavior
      pinned by test), and collision yields `spec-<slug>-2`.
- [ ] Vitest: zero `##` headings → named loud rejection, distinct from an empty-file
      read error; `#`/`###`-only documents also reject loudly.
- [ ] Vitest: `log:` line binding sets `attachedLog` only on its own section's entry;
      a `log:` line outside any `##` section is ignored or rejected (pinned by test).
- [ ] Existing suite stays green (`npm test`, `npm run typecheck`).

## Evidence boundary

Proves normalization at the normalizer seam. Does not wire the source into the loop or
CLI (T5), does not fetch bound log URLs (T1/T2 consume them like any other attachment),
and asserts nothing about live document authoring.

## Status

Ready for planning
