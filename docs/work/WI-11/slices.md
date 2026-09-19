# WI-11 — Slices

Dependency-ordered slices for the cleanup & docs batch. Slices 1–3
change harness `src/` behavior and run the full TDD leaf machinery
(observed RED → focused GREEN at the public seam); slices 4–5 are
docs/comments only; slice 6 is external git ops gated on delivery-time
authority.

## Slice 1 — Record both teardown reasons on a merged run (prd item 1)

**Behavior change.** `src/loop.ts` + `src/loop.test.ts`.
RED: a test at the runOutcome public seam where an early teardown
failure and a canary teardown failure co-occur on a merged outcome —
current single-field structure drops the early reason; expected new
observation carries both. GREEN: two-field (or equivalent) recording;
sanctioned pin updates where existing tests pinned the overwrite.
Size: small. Risk: low (record-shape change, no decision logic).

## Slice 2 — Stop dropping fail()-path sandboxTeardown failures (prd item 2)

**Behavior change.** `src/loop.ts` + `src/loop.test.ts`.
RED: teardown failure on the fail() path currently vanishes; expected
observation is a teardown suffix on the FAILED summary line, matching
the teardown-line precedent from WI-8's preflight/verification
surfaces. GREEN: minimal recording beside the failure. Depends on:
none (independent of slice 1; land after it only to keep the review
diffs separable). Size: small. Risk: low.

## Slice 3 — Unify reverted-surface notify vocabulary (prd item 3)

**Behavior change, string-level.** `src/loop.ts` + `src/loop.test.ts`.
Unify `notify: not configured` (reverted summary line) with
`notify handle not configured` (uncanaried detail) on the precise
wording; pinned-string updates ship in the same commit. Size: small.
Risk: low.

## Slice 4 — Code-comment + record hygiene (prd items 4–5)

**No behavior change.** Fix the stale WI-6 comment wording in
`src/loop.ts` (guarding moved to `main()`); append dated addenda to
`docs/work/WI-9/` and `docs/work/WI-10/` records (cite PR #24/#25/#27
RED/GREEN body evidence; fix WI-9 probe-attribution wording).
Append-only — evidence is never rewritten. Depends on: slices 1–3
accepted (so the addenda can reference the final state). Size: small.
Risk: none.

## Slice 5 — CLAUDE.md module-table honesty check (standing rule)

Verify the module rows in `CLAUDE.md` still describe `src/loop.ts`
accurately after slices 1–3; adjust wording only if a row became
inaccurate. Ships in the same PR as the surface change. Depends on:
slices 1–3. Size: trivial. Risk: none.

## Slice 6 — Stale-branch cleanup (prd item 6, delivery-time)

External git operations: delete fixtures `origin/fix/gh-{1,2,3,10}`
and local `worktree-wi-2-trial`; read back after. Never executed
without explicit owner authorization naming the branch set. Depends
on: nothing in this branch's code — sequenced at delivery. Size:
small. Risk: destructive/external (that is why it is authority-gated).
