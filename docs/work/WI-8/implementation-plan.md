# WI-8 Implementation Plan

Branch `worktree-wi-8` (worktree `.claude/worktrees/wi-8`), base `main` @ `3c3f214`.
Baseline recorded 2026-09-19: clean tree, `npm run typecheck` exit 0, `npm test`
10 files / 207 tests exit 0. Traced to `docs/work/WI-8/specification.md`
(FR-001…FR-003, approved `3cd162c`) and `slices.md` (slices 1–3).

Commands (authoritative list, `docs/agents/workflow.md`): `npm run typecheck`,
`npm test`, focused `npm test -- src/loop.test.ts`. No lint exists. Every task
follows the implement loop: one leaf implementer, observed RED + focused GREEN,
controller fresh gates, sequential spec-then-quality reviews, controller commits
with the exact message below.

---

### Task 1: preflight & verification teardown parity (FR-001, slice 1)

Files: `src/loop.ts`, `src/loop.test.ts`.

1. **Production shape (mirrors the WI-7 FR-003 canary idiom exactly):**
   - Declare `let preflightTeardown: string | undefined` before the preflight
     `try` (`src/loop.ts:619`); wrap the preflight `finally` body
     (`pre.close()` + `deleteBranch(preBranch)`, lines 640–643) in its own
     try/catch setting `preflightTeardown` from the error message.
   - The stale-baseline abort return (line 644–650) gains
     `...(preflightTeardown !== undefined ? { teardownFailure: preflightTeardown } : {})`
     — the abort reason stays the `failure` string, untouched.
   - `fail()` (line 671) gains the same conditional spread, so a green-baseline
     run that later fails verification still carries the preflight teardown.
   - Declare `let sandboxTeardown: string | undefined`; wrap the verification
     `finally`'s `sandbox.close()` (line 737) in try/catch setting it. (A throw
     here on a `fail()`-returned path is caught — the fail outcome is returned,
     not erased; the field is not attached on those paths: boundary note, below.)
   - `prOutcome` (line 744) gains
     `const earlyTeardown = preflightTeardown ?? sandboxTeardown; … ...(earlyTeardown !== undefined ? { teardownFailure: earlyTeardown } : {})`
     — it then flows into every `{...prOutcome, …}` return (reviewSkip, merged,
     and, via runCanary's own conditional spread, the merged line's existing
     4th tuple element, which only fires when the canary's own teardown did not
     fail).
   - Generalize the `LoopOutcome.teardownFailure` doc comment (line 233–240) to
     name all three sandboxes (preflight / verification / canary); no type change.
   - `runQueue`'s `failed.push` (line 1278) appends
     `${outcome.teardownFailure !== undefined ? ` (teardown: ${outcome.teardownFailure})` : ""}`
     to the reason — existing tests unaffected (no `teardownFailure` on their
     outcomes).
2. **RED (`src/loop.test.ts`, new knobs in `makeDeps`:
   `preflightCloseThrows`, `sandboxCloseThrows` (wrap the preflight and 2nd
   sandbox handles' close respectively — the single production catch covers the
   preflight branch-delete too, no separate knob); `makeQueueDeps`:
   `preflightCloseThrowsFor`):**
   - (a) green verification + `sandboxCloseThrows` → assert the returned outcome
     has `prUrl` AND `teardownFailure` defined. Pre-fix: the raw throw
     propagates out of `runSingleIssue` — expected RED.
   - (b) stale baseline (`staleBaseline: true`) + `preflightCloseThrows` →
     assert the outcome `failure` contains `Aborted before the fix run` AND
     `teardownFailure` is defined. Pre-fix: raw throw replaces the abort reason
     — expected RED.
   - (c) green baseline + `preflightCloseThrows` → assert `runFixRun` was
     called (run continued) and the final PR'd outcome carries `teardownFailure`.
     Pre-fix: raw throw kills the run before the fix run — expected RED.
   - (d) queue mode, `makeQueueDeps({ staleBaselineFor, preflightCloseThrowsFor })`
     → `runQueue` rejects with `QueueAbortedError`; `formatSummary` of the
     carried summary exact-pins
     `FAILED gh-1: Aborted before the fix run — project profile is stale… (teardown: <knob message>)`.
     Pre-fix: the raw throw is not a `QueueAbortedError` — expected RED.
3. **GREEN:** step 1. **Focused:** `npm test -- src/loop.test.ts` (expect
   211 = 207+4); typecheck; full suite green.
4. **Commit:** `fix(WI-8): preflight/verification teardown recorded, never deciding or erasing the outcome (FR-001)`

### Task 2: single-issue report carries the teardown line (FR-002, slice 2)

Files: `src/loop.ts`, `src/loop.test.ts`.

1. **Production shape:** extract `main()`'s single-issue print block
   (`src/loop.ts:1636–1675`) into an exported pure builder
   `formatSingleIssueResult(result): { stdout: string[]; stderr: string[]; exitCode: 0 | 1 }`
   — the skipped/PR'd/merged/mergeFailure/closeFailure/no-PR branches move
   verbatim (stdout lines to `stdout`, guarded stderr line *contents* to
   `stderr`, exitCode 1 only on the no-PR branch, unchanged). New: when
   `result.outcome.teardownFailure !== undefined`, append
   `sandbox teardown failed: ${result.outcome.teardownFailure}` to `stderr`
   (both the PR'd and no-PR branches — the line is bookkeeping, never fatal;
   exitCode unchanged, per the approved spec decision). `main()` calls the
   builder, emits `stdout` via `console.log`, guards each `stderr` line through
   `assertNoSecrets` then `console.error` (guarding stays in `main`, matching
   the current per-line posture), sets `process.exitCode` when the builder says 1.
2. **RED (scaffold-first, per the construction-failure rule):** add the export
   as a stub returning the CURRENT block's lines (no teardown line), then write
   the tests — RED is behavioral (missing line), not a compile error:
   - (i) PR'd outcome with `teardownFailure` → `stderr` contains the teardown
     line; `stdout` still carries the PR line; `exitCode` 0.
   - (ii) PR'd outcome WITHOUT `teardownFailure` → `stderr` is empty, lines
     byte-identical to the current output shape (no new line anywhere).
   - (iii) no-PR failure outcome with `teardownFailure` → `stderr` carries BOTH
     `Loop finished without a PR — …` and the teardown line; `exitCode` 1.
3. **GREEN:** step 1. **Focused:** `npm test -- src/loop.test.ts` (expect
   214 = 211+3); typecheck; full suite green.
4. **Commit:** `feat(WI-8): single-issue report carries a recorded teardown failure line (FR-002)`

### Task 3: uncanaried merge pings the notify handle (FR-003, slice 3)

Files: `src/loop.ts`, `src/loop.test.ts`.

1. **Production shape:** `UncanariedRecord` gains `readonly notifyHandle?:
   string` (absent = not configured — mirrors `RevertedRecord`); `runCanary`'s
   uncanaried catch reads `input.profile.notifyHandle` into the record; the
   comment body appends, when configured,
   `cc @${handle} — this merge needs a human decision.` (the existing
   "A human must decide" sentence stays); `uncanariedDetail` appends
   `; notify: @${record.notifyHandle}` when configured, else
   `; notify handle not configured` (mirrors the reverted summary line's
   vocabulary). The comment stays best-effort; `commentNote` semantics
   unchanged; the halt unchanged.
2. **RED (`src/loop.test.ts`, extend the WI-7 FR-002 uncanaried describe,
   reusing its `syncThrows` knob and the `optedInNotify` profile idiom):**
   - (i) with `notifyHandle: "manjula25"` → `commentOnPr` called with a body
     containing `@manjula25`; the outcome `failure` string and the queue
     summary `⚠️ UNCANARIED MERGE` line both contain `notify: @manjula25`.
     Pre-fix: no notify anywhere on this path — expected RED.
   - (ii) without a handle → body contains no `@`; the detail carries
     `notify handle not configured`. Pre-fix: no such text — expected RED.
3. **GREEN:** step 1. **Focused:** `npm test -- src/loop.test.ts` (expect
   216 = 214+2); typecheck; full suite green.
4. **Commit:** `feat(WI-8): uncanaried merge pings the configured notify handle (FR-003)`

---

## Sequencing and rollback

Task 1 first (produces the field task 2 surfaces); tasks 2 and 3 are
independent of each other and may land in either order after 1. Each task is
one revertable commit; no data migration, no half-states.

## Evidence boundaries and non-claims (all tasks)

- Vitest public-seam + tsc only; no Docker/gh/pipeline-integration run of the
  WI-8 tree; teardown failures are exercised via throwing-dep knobs, matching
  the WI-7 FR-002/FR-003 idiom.
- `main()`'s print-loop wiring (task 2) is typechecked + seam-verified (the
  builder is unit-proven; the thin loop follows the existing guarded-emit
  posture) — not executed as a live CLI in tests, per house precedent.
- Teardown is not retried; on `fail()`-paths inside the verification try the
  teardown failure is caught (outcome preserved) but not attached to the
  returned failure outcome — recorded boundary, not a claimed surface.
- Hard constraint 1 untouched: auto-merge gating unchanged; this repo never
  auto-merges itself.

## Completion gate (per task, controller-run)

Fresh at the exact candidate: focused `src/loop.test.ts`, `npm run typecheck`,
full `npm test`; sequential read-only spec-then-quality reviews before the
commit; implementation-notes + verification appended per checkpoint.
