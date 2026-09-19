# WI-12 — Implementation plan (adjacent-findings batch)

Traceability: FR-001→T1, FR-002→T2, FR-003→T3, FR-004→T4, module-row
honesty→T5. Source: `docs/work/WI-12/specification.md` (approved
2026-09-19, decisions d1–d2). All work is harness-source surface:
`src/loop.ts` + `src/loop.test.ts` (vitest, public seam). No pipeline run.

## Task 0 — Worktree + baseline (controller)

Create the WI-12 worktree from local main (`940533f`) — branch
`worktree-wi-12`, `.claude/worktrees/wi-12`. Baseline inside the worktree:
`npm ci` (or install), then `npm run typecheck` → exit 0 and `npm test` →
10 files / 219 tests passed. A failing baseline blocks dispatch.

## Task 1 — FR-001: uncanaried outcome records the early teardown reason

Files: `src/loop.ts`, `src/loop.test.ts`.

**RED** — new test beside the uncanaried describe (after test (o)),
"(q2) WI-12 FR-001: uncanaried merge + throwing verification close — the
early teardown reason rides the outcome, the FAILED suffix, and the
report stderr line". Construction (knobs verified to exist):
single-issue `makeDeps({ syncThrows: "divergent main", sandboxCloseThrows:
CLOSE })` with `optedInNotify`; queue `makeQueueDeps({ issues:
[queueIssue(1)], syncMainThrowsFor: "gh-1", sandboxCloseThrowsFor: "gh-1"
})` with the auto-merge profile. Assert: `outcome.uncanaried !==
undefined`; `outcome.teardownFailure` contains CLOSE; `formatSingleIssueResult`
stderr contains `sandbox teardown failed: ${CLOSE}`; queue FAILED line ends
`(teardown: ${CLOSE})`; failure string still contains `UNCANARIED MERGE`
and `notify: @manjula25` (unchanged). Expected failing observation today:
`outcome.teardownFailure` is undefined (dropped — the return at
`src/loop.ts:959-966` carries no teardown field).

**GREEN (minimal):** on the uncanaried return (`src/loop.ts:959-966`),
add the same conditional spread FR-001's reverted lift uses:
`...(prOutcome.teardownFailure !== undefined ? { teardownFailure: prOutcome.teardownFailure } : {})`
with a WI-12 (FR-001, d2) provenance comment. No rendering change — the
FAILED suffix and report line already read the field; the
⚠️ UNCANARIED MERGE detail is untouched (d2).

**Boundary guard:** clean-teardown uncanaried pins (tests (n)/(o) and the
comment-failed variant) must stay green UNMODIFIED.

**Focused verify / gates:** `npx vitest run src/loop.test.ts`;
`npm run typecheck`; `npm test` (10 files, ≥220).
**Commit:** `fix(loop): record the early teardown reason on uncanaried merges (WI-12 FR-001)`

## Task 2 — FR-002: present-handle rendering unified with @

Files: `src/loop.ts`, `src/loop.test.ts`.

**RED** — new test "(f3) WI-12 FR-002: reverted with notifyHandle
configured — the failure line renders `notify: @manjula25`": reuse
test (f2)'s present-arm construction (`run(makeDeps({ canary:
sandboxHandle(CANARY_RED_SUITE) }), optedInNotify)`); assert
`present.failure` contains `notify: @manjula25`. Failing today: renders
bare `notify: manjula25` (`src/loop.ts:1097` present arm).

**GREEN (minimal):** `src/loop.ts:1097` present arm
`` `notify: ${handle}` `` → `` `notify: @${handle}` ``; extend the
adjacent WI-11 comment to note the WI-12 unification (d1).

**Sanctioned pin update (same commit, the batch's only one):** test
(f2)'s contrast arm `expect(present.failure).toContain("notify:
manjula25")` → `toContain("notify: @manjula25")`, with a comment marking
the supersession of WI-11 FR-003's bare pin. The two sibling surfaces'
pins (tests (n)/(o), queue REVERTED line) must remain green UNMODIFIED.

**Focused verify / gates:** as above (≥221).
**Commit:** `fix(loop): unify present-handle rendering with @ on the reverted failure line (WI-12 FR-002)`

## Task 3 — FR-003: reverted-path lift pinned (characterization, no production change)

Files: `src/loop.test.ts` only.

New test "(r) WI-12 FR-003 (characterization): red canary + throwing
verification close — the reverted outcome carries the EARLY reason at
outcome level, the canary home stays clean, the FAILED suffix names the
early reason": `makeDeps({ canary: sandboxHandle(CANARY_RED_SUITE),
sandboxCloseThrows: VERIFY })` with `optedInNotify`; assert
`outcome.reverted !== undefined`; `outcome.teardownFailure` contains
VERIFY; `outcome.reverted.teardownFailure` is undefined (canary teardown
clean — its home exists, unused); queue FAILED line ends
`(teardown: ${VERIFY})`; the ⚠️ REVERTED queue line (via
`reverted.evidence`) still names the canary suite failure. **Must pass
against the worktree with zero production change** — if it fails, stop:
defect report to the controller, never weaken the pin.

**Focused verify / gates:** as above (≥222).
**Commit:** `test(loop): pin the reverted-path early-teardown lift at the seam (WI-12 FR-003)`

## Task 4 — FR-004: both-early-teardowns precedence pinned (characterization, no production change)

Files: `src/loop.test.ts` only.

New test "(e3) WI-12 FR-004 (characterization): verification rejected
with BOTH preflight and verification closes throwing — the preflight
reason wins on the fail() path": `makeDeps({ preflightCloseThrows: PRE,
sandboxCloseThrows: VERIFY, sandbox: sandboxHandle(SUITE_AFTER_FIX, /*
reproExit */ 1) })`; assert `outcome.failure` contains "Verification
failed"; `outcome.teardownFailure` contains PRE and not VERIFY (preflight
wins — it happened first); report stderr line names PRE. Queue variant
with `preflightCloseThrowsFor` + `sandboxCloseThrowsFor` + `failReproFor`
if the queue seam adds signal beyond the single-issue seam (implementer's
judgment, recorded). **Must pass with zero production change** — same
defect-report rule.

**Focused verify / gates:** as above (≥223).
**Commit:** `test(loop): pin preflight-wins precedence when both early teardowns fail (WI-12 FR-004)`

## Task 5 — CLAUDE.md module-row honesty check (standing rule)

The `src/loop.ts` row's WI-11 clause reads "…on merged/reverted runs and
the fail() outcomes" — T1 extends recording to the uncanaried outcome, so
the row needs the uncanaried mention appended (expected: a wording
extension, not a new row). Check the WI-8/WI-7 clauses remain accurate.

**Commit:** `docs(WI-12): CLAUDE.md module row updated for uncanaried teardown recording`

## Sequencing and rollback

T0 → T1 → T2 → T3 → T4 → T5. Each commit independently revertable; no
history rewrites. T3/T4 may swap order after T1 (both depend only on
merged code paths). Post-T5: `verification-before-completion` →
`code-review` → `finishing-a-development-branch`. No FR-006-style
external action exists in this batch — delivery is push + PR only.
