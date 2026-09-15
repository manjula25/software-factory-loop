# T1 — Queue acquisition from GitHub Issues

## What to build

Given a target repo, the harness lists its open issues via `gh issue list` — filtered by an
optional `--label` flag when given, all open issues otherwise, one page at the default limit —
and normalizes every entry through the existing issue normalizer into
`{ id, description, attachedLog?, sourceType }`. A non-zero `gh` exit is a named run error;
an empty result is a named no-op outcome; the two are never conflated.

## Blocked by

None — can start immediately.

## Requirement coverage

Slice 1; FR-001; grilling decisions 5 (label filter) and 12 (one-page bound capping triage
spend).

## Acceptance criteria

- [ ] Vitest case with a stubbed `gh issue list` payload (multiple issues, one with an
      attached log, one without): every normalized entry has the required shape, and
      `attachedLog` is present iff the source issue carried one.
- [ ] `--label` is passed through to `gh` when given and omitted when not (asserted on the
      stubbed invocation).
- [ ] Non-zero `gh` exit surfaces as a named run error; empty output surfaces as a named
      no-op — asserted as distinct outcomes.
- [ ] Existing suite stays green (`npm test`, `npm run typecheck`).

## Evidence boundary

Proves queue acquisition and normalization against a stubbed `gh`. Does not prove live
GitHub behavior (that is T5's boundary), and does not process anything — admission, dedup,
and execution are later tickets.

## Status

Ready for planning
