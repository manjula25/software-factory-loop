# T5 — Source selection + queue parity

## What to build

The loop entry point accepts the issue source via explicit CLI flags naming a local
file: a spec-document source and a plain-list source, with GitHub Issues the default
and behavior unchanged when no flag is passed. Selecting a file source replaces GitHub
acquisition for that run (never merges sources). An unreadable file or unparseable
content (T3/T4 loud rejections) fails the run loudly before any sandbox work. Whatever
the source, normalized entries feed the existing dedup (`fix/<id>` branch + open-PR
token match), cap, and admission stages with no source-specific branching downstream;
the run summary names the source.

## Blocked by

T3, T4 — both normalizers must produce entries before selection/wiring can be tested
against them.

## Requirement coverage

FR-007, FR-008; slice 4; grilling decision 2; PRD L35, L43.

## Acceptance criteria

- [ ] Vitest at the acquisition seam: spec-doc flag with a fixture file → queue comes
      from the file, zero GitHub acquisition calls; same for the plain-list flag; no
      flag → GitHub acquisition exactly as today.
- [ ] Vitest: mixed queue (stubbed GitHub ids, `spec-*`, `list-*`) dedups correctly —
      an open PR whose body token-matches an id skips that id regardless of source; a
      stale `fix/spec-<slug>` branch without a PR is deleted and the issue retried.
- [ ] Vitest: unreadable file and zero-heading spec-doc both fail the run before any
      sandbox/worktree work, with named errors.
- [ ] Run summary names the source (GitHub / spec-doc path / plain-list path).
- [ ] Existing suite stays green (`npm test`, `npm run typecheck`).

## Evidence boundary

Proves selection and parity with stubbed sources. Does not prove an end-to-end
non-GitHub run in Docker (T6), and changes nothing in dedup/cap/admission themselves —
they are consumed as-is.

## Status

Ready for planning
