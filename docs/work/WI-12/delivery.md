# Delivery

## Work item

WI-12 — adjacent-findings batch (carved from WI-11's review + implementation
notes; approved spec `940533f`, decisions d1–d2).

## Summary

Four small slices closing WI-11's recorded gaps, all on `src/loop.ts` +
`src/loop.test.ts`:

1. **FR-001 (behavior):** the uncanaried-merge outcome now records the early
   (preflight/verification) teardown reason via the same conditional-spread
   idiom as the reverted lift — the last path that silently dropped it.
2. **FR-002 (string-level):** the reverted failure line's present-handle arm
   renders `notify: @<handle>`, unified with the uncanaried detail and the
   queue REVERTED line; one sanctioned pin supersession (test (f2), bare→@).
3. **FR-003 (test-only):** characterization pin (r) for the reverted-path
   two-origin teardown lift.
4. **FR-004 (test-only):** characterization pin (e3) for preflight-wins
   precedence when both early closes throw.

Plus the CLAUDE.md `src/loop.ts` module-row honesty update (T5). Suite grew
219 → 223 tests.

## Plan artifacts

`docs/work/WI-12/`: prd.md, slices.md, specification.md (approved),
implementation-plan.md (post-ponytail), implementation-notes.md,
verification.md, review.md, delivery.md (this file).

## Verification

Fresh at candidate `4b09d97` (record-only docs commits since; `src/`
byte-identical): `npm run typecheck` exit 0; `npm test` 10 files / 223 tests;
focused `-t "WI-12"` run — all four new pins green. Per-FR evidence map and
sanctioned-pin audit in verification.md.

## Evidence boundary

Harness source only (`src/`, vitest at the public seam).

## Non-claims

No pipeline/Docker run; no canary-only report-line pin (WI-11 A1 follow-up,
deliberately out of scope); no merged-path triple-failure coverage; no change
to verdict logic, failure kinds, halt behavior, or exit codes beyond FR-001's
additive field; merge policy untouched (hard constraint 1).

## Remaining risks

None behavioral identified. The reverted line's present-handle rendering
changed shape (bare→@); all in-repo consumers pinned green, no external
consumer known. Adjacent findings A1/A2 + taste notes deferred to the
follow-up ledger (implementation-notes.md / review.md).

## Review status

Four-axis batch review at `be0e016`: **all four axes PASS**, zero blocking
findings. 8 per-checkpoint review passes during implementation, zero blocking.
Record-only fixes applied after review (`20ca736`).

## Branch and base

Branch `worktree-wi-12`; base `main` @ `003fbd1`; PR base branch `main`.

## Commit range

`003fbd1..20ca736` — 12 commits (2 fixes, 2 test pins, 8 docs/checkpoint).

## Requested external actions

(awaiting owner authorization — push / PR)

## Executed external actions and observed results

(none yet)

## Pending actions

Push branch + open PR against `main` (human merge, per hard constraint 1);
post-merge worktree/branch cleanup.
