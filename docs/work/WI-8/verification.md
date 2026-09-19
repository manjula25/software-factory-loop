# WI-8 Verification Record

Controller-run evidence, appended per checkpoint. Harness-source surface unless a
check says otherwise; commands from `docs/agents/workflow.md`.

## T1 — preflight & verification teardown parity (FR-001)

Claim: a teardown failure at the preflight sandbox (close or branch-delete) or
the verification sandbox (close) is recorded beside the run's outcome and never
decides or erases it — a green baseline proceeds to the fix run with the
failure recorded (outcome field + FAILED/MERGED summary suffix); a recorded
baseline problem keeps its abort reason with the failure riding beside it; a
green verification with an open PR yields the PR'd outcome carrying the
failure; nothing propagates unhandled.

Exact candidate: `a30c4ac` (base `8693da2`), branch `worktree-wi-8`.

| Check | Command | Result |
|---|---|---|
| Focused suite | `npm test -- src/loop.test.ts` | 1 file / 103 tests passed (99+4), exit 0 |
| Typecheck | `npm run typecheck` (tsc --noEmit) | exit 0 |
| Full suite | `npm test` | 10 files / 211 tests passed (207+4), exit 0 |

RED evidence (leaf-observed, pre-fix, same four tests): raw
`Error: docker: container rm failed — busy` out of `runSingleIssue` at the
two finallys — green outcome erased, abort reason replaced, run killed before
the fix run; queue mode saw the raw throw instead of `QueueAbortedError`.
Verbatim lines in implementation-notes.md.

Evidence boundary:
- Vitest public-seam suite + tsc only; teardown failures exercised via
  throwing-dep knobs (WI-7 FR-003 idiom). No Docker/gh/pipeline-integration
  run of a teardown failure.
- Non-claim: on fail()-returned paths inside the verification try, a close()
  throw is caught (outcome preserved, never erased) but the field is not
  attached to the returned failure outcome — brief-sanctioned boundary.
- Non-claim: if both an early teardown and the canary teardown fail on a
  merged run, the canary's reason wins (single-field structure, pre-existing);
  recorded as adjacent follow-up, not claimed as combined reporting.

Reviews: specification PASS, code-quality APPROVED, both at the fixed package
`8693da2` → `a30c4ac` (record in implementation-notes.md).

## T2 — single-issue report carries the teardown line (FR-002)

Claim: a single-issue-override run carrying a recorded `teardownFailure` names
it in the terminal output (`sandbox teardown failed: <reason>` on stderr,
guarded at the emission seam) on both the PR'd and no-PR branches; runs
without one print nothing new (byte-stable); exit-code semantics unchanged.

Exact candidate: `8b4ff3f` (base `dff96ff`), branch `worktree-wi-8`.

| Check | Command | Result |
|---|---|---|
| Scaffold check (stub ≡ current output) | `npm test -- src/loop.test.ts` (pre-test) | 103/103, exit 0 — stub changes nothing observable |
| Focused suite | `npm test -- src/loop.test.ts` | 1 file / 106 tests passed (103+3), exit 0 |
| Typecheck | `npm run typecheck` (tsc --noEmit) | exit 0 |
| Full suite | `npm test` | 10 files / 214 tests passed (211+3), exit 0 |

RED evidence (leaf-observed against the stub): tests (i)/(iii) failed on the
missing teardown line (`expected [] to include 'sandbox teardown failed: …'`;
`expected [ Array(1) ] to deeply equal [ …(2) ]`); test (ii) is a documented
no-change regression pin (cannot fail against the stub by design — the plan's
own "byte-identical" wording). Verbatim lines in implementation-notes.md.

Evidence boundary:
- The exported builder is unit-proven at its seam; `main()`'s emit loop is
  typechecked + seam-verified, not CLI-executed in tests (house precedent —
  same non-claim class as WI-7's `main()` wiring).
- Non-claim: no queue-mode output change; no exit-code change; cross-stream
  (stdout/stderr) ordering differs from the old interleaved emission —
  recorded adjacent, never an ordered contract.

Reviews: specification PASS (verbatim-move proof), code-quality APPROVED, both
at the fixed package `dff96ff` → `8b4ff3f` (record in implementation-notes.md).

## T3 — uncanaried merge pings the notify handle (FR-003)

Claim: an uncanaried merge's PR comment carries an @-mention of the
configured notify handle (`cc @<handle> — this merge needs a human decision.`,
appended only when configured, existing human-decision sentence verbatim) and
the shared uncanaried detail states the notify posture unconditionally —
`notify: @<handle>` when configured, `notify handle not configured` when not
(reverted-path vocabulary) — on both the outcome failure string and the queue
`⚠️ UNCANARIED MERGE` line; the comment stays best-effort; the halt,
no-blind-revert rule, and merge are unchanged; no new notification channels.

Exact candidate: `e845f89` (base `eb54918`), branch `worktree-wi-8`.

| Check | Command | Result |
|---|---|---|
| Focused suite | `npm test -- src/loop.test.ts` | 1 file / 108 tests passed (106+2), exit 0 |
| Typecheck | `npm run typecheck` (tsc --noEmit) | exit 0 |
| Full suite | `npm test` | 10 files / 216 tests passed (214+2), exit 0 |

RED evidence (leaf-observed, pre-fix, 4 failed / 104 passed): new tests (n)/(o)
failed on the missing cc mention and missing not-configured posture; the two
sanctioned pin updates (test (i) record `toEqual` gains `notifyHandle`; test
(j) exact pins gain `; notify handle not configured`) failed pre-fix for the
same reason — spec-mandated content change, not a weakened assertion. Verbatim
lines in implementation-notes.md.

Evidence boundary:
- Vitest public-seam suite + tsc only; the uncanaried path exercised via the
  throwing `syncMain`/`syncThrows` knobs (WI-7 FR-002 idiom). No Docker/gh
  run; the @-mention rides the existing best-effort PR comment (guarded by
  `assertNoSecrets`), not a new channel.
- Non-claim: no change to the halt, no-blind-revert rule, merge gating, or
  hard constraint 1's opt-in; the comment-posting failure path is covered by
  the pre-existing test (k), unchanged here.

Reviews: specification PASS, code-quality APPROVED, both at the fixed package
`eb54918` → `e845f89` (record in implementation-notes.md).
