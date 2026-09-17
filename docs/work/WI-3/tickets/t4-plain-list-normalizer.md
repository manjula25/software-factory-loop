# T4 — Plain-list normalizer

## What to build

A plain-text list is a valid issue source: one issue per non-empty line; `#`-prefixed
lines are comments; the line is title and description; an optional
`| <log path-or-url>` suffix binds an attachment. Entries have the internal shape
`{ id, description, attachedLog?, sourceType }`, shape-identical to a GitHub issue's
normalization. Entry id = `list-<line-slug>`, counter-suffixed on collision. A list
containing only comments and blank lines is a loud rejection with a named error —
never silent partial ingestion.

## Blocked by

None — can start immediately.

## Requirement coverage

FR-006 (and FR-007's shape-parity half); slice 3; grilling decisions 2–3; PRD US1
(L15), L35, L90.

## Acceptance criteria

- [ ] Vitest: a list with three issue lines (one with a `| <path>` suffix, one with a
      `| <url>` suffix) and interleaved comments normalizes to three shape-identical
      entries (PRD L90 field-by-field comparison, `sourceType` excepted).
- [ ] Vitest: slug derivation from line text and collision suffixing (`list-<slug>-2`)
      behave identically to T3's rules.
- [ ] Vitest: comments-only and empty files both reject loudly with a named error,
      distinct from an unreadable-file error.
- [ ] Vitest: a line containing `|` with no log value after it (trailing pipe) —
      behavior pinned by test (reject loudly or treat as literal text; no silent
      drop).
- [ ] Existing suite stays green (`npm test`, `npm run typecheck`).

## Evidence boundary

Proves normalization at the normalizer seam only. No loop/CLI wiring (T5), no log
fetching (T1/T2), no multi-line entry or quoting syntax (non-claimed in FR-006).

## Status

Ready for planning
