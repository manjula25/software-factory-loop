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
