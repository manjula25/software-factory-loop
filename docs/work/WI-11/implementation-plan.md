# WI-11 — Implementation plan (cleanup & docs batch)

Traceability: FR-001→T1, FR-002→T2, FR-003→T3, FR-004→T4a/T4b, FR-005→T5,
FR-006→delivery-time (prepared below, authority-gated). Source:
`docs/work/WI-11/specification.md` (approved 2026-09-19, decisions d1–d3).

All behavior work is harness-source surface: `src/loop.ts` +
`src/loop.test.ts` (vitest, public seam). No pipeline run is required
(spec non-claims); Docker is not involved.

## Task 0 — Worktree + baseline (controller, before any dispatch)

Create the WI-11 worktree from local main (`7a3ce60`) via
`using-git-worktrees` convention (branch `worktree-wi-11`,
`.claude/worktrees/wi-11`). Baseline inside the worktree:

- `npm run typecheck` → exit 0
- `npm test` → 10 files / 216 tests passed (committed baseline)

A failing baseline blocks dispatch (documented investigation only).

## Task 1 — FR-001: both teardown origins recorded (slice 1)

Files: `src/loop.ts`, `src/loop.test.ts`.

**Design (pinned by d1):** keep `LoopOutcome.teardownFailure` as the
*early* origin (preflight/verification — its meaning on every non-merged
path is unchanged); add a distinct canary-origin field
`canaryTeardownFailure?: string` beside it (same doc-comment discipline).
Rendering rule: exactly one failed origin renders exactly as today
(`teardown: <reason>`); both failed renders both, origin-labeled.

**RED (new test, `describe` beside the WI-7/WI-8 teardown blocks):**
"(p) green merge + throwing verification close AND throwing canary
close: the merged outcome carries BOTH teardown reasons and the MERGED
line names both" —
`makeDeps` knobs already exist (`closeThrowsFor` at `src/loop.test.ts:1400`,
canary-branch-delete at `:1404`); enable both for one issue, run the
opted-in single-issue seam, assert
`outcome.teardownFailure` contains the verification-close message AND
`outcome.canaryTeardownFailure` contains the canary message, and
`formatSummary` renders a MERGED line containing both messages.
Expected failing observation today: `teardownFailure` holds only the
canary message (overwritten at `src/loop.ts:1018`) and no
`canaryTeardownFailure` field exists.

**GREEN (minimal):**
1. Add `canaryTeardownFailure?: string` to `LoopOutcome` after
   `teardownFailure` (`src/loop.ts:244`), with the two-origin doc note.
2. Merged return (`src/loop.ts:1013-1019`): spread `prOutcome` (keeps
   early `teardownFailure`) and attach
   `...(teardownFailure !== undefined ? { canaryTeardownFailure: teardownFailure } : {})`
   — no longer overwrites.
3. Reverted return (`src/loop.ts:1055-1075`): attach the early reason at
   outcome level (`...(prOutcome.teardownFailure !== undefined ? { teardownFailure: prOutcome.teardownFailure } : {})`)
   and keep `reverted.teardownFailure` as the canary reason.
4. Queue MERGED tuple (`src/loop.ts:1300-1305`): keep the 4-slot tuple;
   the 4th element becomes the pre-composed teardown suffix at push time —
   `teardown: <early>` / `canary teardown: <canary>` when exactly one
   origin failed (byte-identical to today's single-failure rendering, with
   the canary-only case rendering `teardown: <canary>` exactly as now),
   and `teardown: <early>; canary teardown: <canary>` when both.
   `formatSummary`'s MERGED line (`:1341-1346`) interpolates the suffix
   unchanged in shape. *(Ponytail 2026-09-19: replaces a 5-element tuple
   growth with the pre-composed string — same observable output, tuple
   shape untouched.)*
5. Single-issue report (`src/loop.ts:1506-1521`): after the existing
   `sandbox teardown failed:` line, push
   `canary teardown failed: <reason>` when the canary origin failed.

**Sanctioned pin updates (same commit):** test (l) `src/loop.test.ts:856`
pins the canary-only MERGED line — must remain byte-identical (assert it);
no existing pin should change. If any pin breaks, that is a defect, not a
sanctioned update.

**Focused verify:** `npx vitest run src/loop.test.ts` → all green.
**Gates:** `npm run typecheck` (exit 0), `npm test` (217+ passed).
**Refactor-while-green:** none expected — attachment points only.

**Commit:** `fix(loop): record both early and canary teardown origins on merged/reverted runs (WI-11 FR-001)`

## Task 2 — FR-002: fail()-path teardown recorded (slice 2)

Files: `src/loop.ts`, `src/loop.test.ts`.

**RED (new test):**"(e2) verification rejected + throwing verification
close: the FAILED line carries the failure plus a `(teardown: …)` suffix
and the single-issue report emits the teardown stderr line" — construct a
run whose fresh-sandbox suite reports a new failure vs baseline while the
verification sandbox `close()` throws; assert queue-mode FAILED line ends
`… (teardown: docker: container rm failed — busy)` and the single-issue
report's stderr contains `sandbox teardown failed: docker: container rm
failed — busy`. Expected failing observation today: no suffix, no stderr
line (the comment at `src/loop.ts:720-723` documents the drop).

**GREEN (minimal):** inside the verification try block, the three failure
returns (`src/loop.ts:731,738,749`) currently `return fail(...)`. Change
each to store the outcome (`failOutcome = await fail(...)`) and exit the
try; after the `finally` that captures `sandboxTeardown` (`:765-771`),
return `failOutcome` with
`...(sandboxTeardown !== undefined ? { teardownFailure: sandboxTeardown } : {})`
attached. The FAILED suffix (`:1320-1324`) and report lines (`:1520-1521`)
already read `outcome.teardownFailure` — no rendering change needed.

**Boundary guard:** the stale-abort path (`:664-671`) and green/PR'd paths
are untouched; their pins (WI-8 tests (a)–(d)) must stay green unmodified.

**Focused verify / gates / commit:**
`npx vitest run src/loop.test.ts`; `npm run typecheck`; `npm test`.
**Commit:** `fix(loop): stop dropping verification teardown failures on fail() paths (WI-11 FR-002)`

## Task 3 — FR-003: unified notify vocabulary (slice 3)

Files: `src/loop.ts`, `src/loop.test.ts`.

**RED (new test):** "(f2) canary red with notifyHandle ABSENT: the ⚠️
REVERTED failure line says `notify handle not configured`" — extend the
existing reverted-absent-handle scenario (`src/loop.test.ts:594-660`) to
assert `outcome.failure` contains `notify handle not configured`.
Failing today: `src/loop.ts:1059` renders `notify: not configured`.

**GREEN (minimal):** `src/loop.ts:1059` — only the absent arm changes. The
present-handle form is today bare (`notify: manjula25`, live-observed in
WI-10's run log) and FR-003 pins it unchanged, so the change is:
`notify: ${handle ?? "not configured"}` →
`notify: ${handle !== undefined ? handle : "handle not configured"}` —
present renders `notify: manjula25` (byte-identical), absent renders
`notify handle not configured` (no colon), matching `:298` and `:1352`.

**Sanctioned pin updates (same commit):** any test pinning
`notify: not configured` on the reverted failure line. The handle-present
pins (incl. the WI-10 live observation) must remain byte-identical.

**Focused verify / gates / commit:**
`npx vitest run src/loop.test.ts`; `npm run typecheck`; `npm test`.
**Commit:** `fix(loop): unify absent-notify vocabulary on the reverted failure line (WI-11 FR-003)`

## Task 4 — FR-004: comment + record hygiene (slice 4; no behavior change)

Files: `src/loop.ts` (comment only), `docs/work/WI-9/verification.md`,
`docs/work/WI-10/run-endstates.md` (addenda, append-only).

**4a — comment:** `src/loop.ts:1514-1516` justifies the failure-line
emission as "passes the guard like its siblings above" — guarding moved to
`main()` in WI-8. Reword to state the guarding fact for today's code (the
string is guarded at the CLI entry; the emission site itself does not
guard). No code change; `npm run typecheck` + `npm test` prove no behavior
moved (216+… identical counts, zero source-line changes outside comments).

**4b — addenda (dated 2026-09-19, appended sections, nothing rewritten):**
- `docs/work/WI-9/verification.md`: addendum citing the PR #13 RED/GREEN
  body as the durable GitHub-side evidence (WI-9 review A1), and
  correcting the probe-attribution wording (A5: the probe's authorization
  is the approved implementation plan, not spec decision (b)).
- `docs/work/WI-10/run-endstates.md`: addendum citing PR #27's RED/GREEN
  body and the revert comment as durable evidence (WI-10 review A1/M1),
  and noting the observed exit-code capture caveat is documented at
  `run-endstates.md`'s deviations section (A2 — canonical location).

**Commit:** `docs(WI-11): stale comment corrected + WI-9/WI-10 record addenda (FR-004)`

## Task 5 — FR-005: CLAUDE.md module-table honesty check (slice 5)

Read the `src/loop.ts` row against T1–T3's delivered behavior. Expected:
the row's WI-7/WI-8 teardown sentence stays accurate (recording extended,
not replaced); if so, record "checked, no row changed" in the verification
record. Only if a row became inaccurate: minimal wording update.

**Commit (only if changed):** `docs(WI-11): CLAUDE.md module row updated for two-origin teardown recording (FR-005)`

## FR-006 — stale-branch deletion (delivery-time only, prepared)

Prepared commands (NOT executed by implement; run at delivery only after
the owner explicitly authorizes this exact branch set):

- `git -C /home/bitcot/Documents/projects/loop-fixtures-py push origin --delete fix/gh-1 fix/gh-2 fix/gh-3 fix/gh-10`
- `git branch -D worktree-wi-2-trial` (this repo)
- Read-back: `git -C /home/bitcot/Documents/projects/loop-fixtures-py ls-remote --heads origin | grep -E "fix/gh-(1|2|3|10)$"` → no output;
  `git branch --list worktree-wi-2-trial` → no output.

Re-verify the branch list immediately before deletion (no live
`fix/gh-*` branch gets touched). Without authorization: branches stay,
delivery record marks FR-006 pending.

## Sequencing and rollback

T0 → T1 → T2 → T3 (three separable commits; T1 first because T2/T3 tests
sit beside surfaces T1's diff touches) → T4 → T5. Each commit is
independently revertable (`git revert <sha>`); no task rewrites history.
Post-T3 gates are the completion-verification entry point
(`verification-before-completion` → `code-review` → delivery).
