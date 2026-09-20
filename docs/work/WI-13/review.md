# WI-13 Code Review

- **Fixed point:** `61b90e26e8814633349afd289124bcd745f08622` (main; verified = merge-base)
- **Candidate:** `4b70005b6d103e5182426b079b3670240736ac12` (HEAD, `worktree-wi-13`)
- **Range:** 22 commits, non-empty (`git diff 61b90e2...HEAD`)
- **Spec:** `docs/work/WI-13/specification.md` (FR-001..FR-011); verification record fresh at
  `687e89b` (`verification.md`; the two docs commits after it touch only `docs/work/WI-13/`)
- **Method:** two read-only sub-agents in parallel (Standards, Spec), findings independently
  verified by the controller before classification below.

## Changed-path accounting (12 files)

| Path | Role |
|---|---|
| `src/queue.ts`, `src/queue.test.ts` | Planner contract/prompt/parsing, ordering, wave scheduling (T1, T2, T4, T5, T6b) |
| `src/loop.ts`, `src/loop.test.ts` | Planner wiring, wave runner, mutex, verified-merger gate, cap (T3, T4, T6, T6b, T8) |
| `src/sandcastle-adapter.ts`, `src/sandcastle-adapter.boundary.test.ts` | `runPlan`, bounded `runMerger` (T3, T7); comment-only fixes (T9) |
| `src/onboard-profile.ts` | Comment-only: `--triage` example → `--auto-merge` (T9) |
| `CLAUDE.md`, `docs/agents/workflow.md` | Module rows + command honesty (T9) |
| `docs/work/WI-13/*` | Plan-execution evidence: notes, live-run log, verification record |

Every changed path inspected by at least one axis; the four src files by both.

## Standards

**VERDICT: pass-with-findings** — zero documented-standard violations; six smell judgement
calls (adjacent/minor), none blocking.

(a) Documented-standard violations: **none found — verified, not assumed**:

- Constraint 1 (merger behind per-repo opt-in): `runVerifiedMergerGate` is called only inside
  `if (prUrl !== undefined && input.profile.autoMerge === true)` (src/loop.ts,
  runSingleIssue); CLAUDE.md's 2026-09-19 WI-13 amendment is already recorded.
- Constraint 2 (never trust the agent): the merger's output is re-verified via the same
  `verifyInFreshSandbox` before review/merge; red → PR open + `mergeFailure`, queue continues.
- Constraint 5 (amended): `cap: number | undefined`, no default; plan surfaced and printed
  (`plan: attempt/blocked/cap` lines) before any fix-agent spend.
- `assertNoSecrets` at the emission seam: every new emitted string (planner/re-plan/merger
  prompts, warnings, plan lines, re-surfaced attempt lines) passes the guard before emission.
- Module-table honesty: CLAUDE.md loop.ts/queue.ts rows and `docs/agents/workflow.md` were
  updated in this same diff, including the retired `--triage` message verbatim.
- Sandcastle import stays in the adapter (boundary test enforces — not reported as a smell).
  `npm run typecheck` exits 0 on the candidate.

(b) Smell judgement calls (all judgement, none blocking):

1. **Mysterious Name — adjacent** — `src/sandcastle-adapter.ts:154` `PlanRunInput` is now the
   base type for `runReview` and `runMerger` too. The name says "plan" but the role is "any
   bounded one-shot run input"; a neutral name (`BoundedRunInput`) would fit.
2. **Duplicated Code — adjacent** — `src/loop.ts` runQueue: the initial plan pass and the
   FR-006 re-plan repeat the same shape (`buildPlanPrompt → assertNoSecrets → runPlan →
   parsePlanOutput → catch → finally deleteBranch`); only the `edgeIds` option and the
   on-failure action differ. Extractable shared helper.
3. **Duplicated Code — minor** — the blocker predicate exists twice (`unblockedAfter` in
   `src/queue.ts`; `unresolvedInRunBlockers` in `src/loop.ts`); the "blocked by <ids>" string
   is composed at both the plan-surface and notAdmitted sites.
4. **Data Clumps — minor** — `(ranked, edges, completed)` travel together through four
   functions; a small `PlanGraph` type is trying to be born.
5. **Speculative Generality — minor** — `boundedRunOptions`' `maxIterations = 1` param's only
   caller passes the default; `runMerger` returns `commits` no caller reads. Both are cheap
   pins for the boundary test — defensible, judgement only.
6. **Primitive Obsession — minor** — `mainRef = "main"` never varies; a named constant would
   centralize it.

## Spec

**VERDICT: fail** — one blocking finding (controller-verified against spec text and code);
FR-011 satisfied from live evidence (legitimate); remainder minor/adjacent.

(a) Missing/partial: **none material.** FR-011 is provable only from live evidence, which is
legitimate: `evidence/live-run.log` shows plan lines (`blocked gh-31 by gh-29`), concurrent
lanes, PRs #33/#34/#35, green canaries, the second `[plan]` re-surface of gh-31, and the
summary. The merger conflict path was never exercised live (verification.md A46 non-claim) —
acceptable, as FR-011's listed sequence does not include the merger.

(b) Scope creep (minor):

- FR-001 ∅-case: the "invariant guard" force-attempting `remaining[0]` (src/loop.ts wave loop)
  is unreachable for validated plans and untestable by construction; documented as such. Dead
  defense, not asked for.
- FR-005: per-wave "plan: attempt" re-surface lines extend the print-first rule to later waves.
  In spirit, not in spec text.
- The shared-git mutex (T6b) and `verifyInFreshSandbox` extraction are concurrency-enabling,
  not creep.

(c) Implemented but looks wrong:

1. **BLOCKING — FR-004.** Spec: "No further merges occur after a red canary"; success
   criteria: "A red canary on lane A's merge halts the run; lanes B/C's already-open PRs
   appear in the summary; **no B/C merge is attempted afterwards**"; boundary: "the
   requirement pins that parallelism does not weaken it."
   **Controller verification (code read, confirms):** the abort is raised only after the whole
   wave settles (`harnessAbort` collected post-`Promise.allSettled`, src/loop.ts wave loop;
   thrown as `QueueAbortedError` after collection) and no halt flag reaches in-flight lanes —
   the mutex-wrapped chain (gate → review → merge → canary, src/loop.ts:859) consults no
   run-level state. With two opted-in lanes in one wave, if lane A acquires the mutex first
   and its canary goes red (revert inside the lock), lane B then acquires the lock and merges
   on reverted main — **deterministically, not racily**. Stop-the-line is weakened from
   merge-granularity to wave-granularity; the spec explicitly forbids exactly this. Test (c)
   (`src/loop.test.ts:569`) pins the weaker behavior ("no further WAVE starts"); test (k)
   pins only "no wave 2". The T6/T6b reviews' rationale ("sibling lanes' open PRs stand as
   deliverables") justifies not killing in-flight lanes' *PRs* — it does not license letting
   them *merge* after a red canary. **Fix direction:** a run-level halt signal checked inside
   the serialized chain before the merger gate/review/merge; a halted lane returns its PR-open
   outcome with a recorded skip reason (the spec's own stated end-state for B/C).
2. **ADJACENT — FR-008 boundary.** Spec: "Verification infrastructure failure during the
   merger gate is harness-level (abort with partial summary), identical to the existing
   verification posture." In `runVerifiedMergerGate`, every re-verification failure —
   including infrastructure classes (install exit ≠ 0 per `verifyInFreshSandbox`
   src/loop.ts:948, unreadable suite output) — becomes a `mergeFailure` (issue-level; PR open,
   queue continues); only a thrown `createFixSandbox` propagates harness-level.
   Controller verification: confirmed the verdict shapes are indistinguishable (infra and red
   both arrive as `{passed: false, failure}`). Note the spec line is internally tense: the
   primary verification treats the same infra failures as issue-level, so "identical to the
   existing verification posture" and "harness-level (abort)" cannot both hold literally.
   Errs safe (no unverified merge). Needs owner/spec adjudication rather than a unilateral
   code change — recorded adjacent.
3. **MINOR — FR-008.** "issue not counted fixed": a gate-failed issue keeps its `prUrl`, so
   the queue counts it in `fixed` with a `mergeFailures` entry (the WI-6 posture, which
   FR-007's boundary explicitly says to reuse) — spec-internal tension resolved toward FR-007.
4. **MINOR — FR-001.** "unknown ids … degrades to the deterministic fallback":
   `parsePlanOutput` rejects unknown blockedBy endpoints but tolerates unknown priority keys —
   harmless (A1, known since T1), not the literal rule.

## Aggregation summary

- **Standards:** 6 findings, worst = adjacent (`PlanRunInput` naming; plan-pass duplication).
- **Spec:** 6 findings, worst = **blocking** (FR-004 stop-the-line weakened to wave
  granularity within a wave).

Axes deliberately not merged or reranked. The blocking finding is the work item's second
blocking verdict overall (first: T6 quality); it was missed by the T6/T6b dual reviews because
test (c) pinned the weaker behavior as correct.

## Disposition

Blocking finding 1 → **back to stage 3** (controller fix pass through `implement`/
`diagnosing-bugs`: halt signal inside the serialized chain + test pinning no-sibling-merge
after a red canary; then fresh verification and a fresh review of the changed candidate).
Standards adjacents 1–6 and Spec findings 2–4 → adjacent ledger (implementation-notes.md),
candidates for the fix pass or a later taste slice.

## Resolution addendum (2026-09-20, candidate 3828c21)

Blocking finding 1 is **resolved**. Fix pass T11 (base `bc0400b` → `3828c21`, diff limited to
`src/loop.ts`, `src/loop.test.ts`, CLAUDE.md row): run-level `RunHaltSignal` set inside the
mutex before release by any harness-level outcome (shared `harnessLevelFailure` predicate now
also drives the wave loop's abort classification), checked at the serialized chain top before
the merger gate — a halted sibling returns its PR open with a recorded skip reason, the spec's
stated end-state. Test (l) pins no-sibling-merge (mutation re-check attached); test (c), which
had pinned the defect, corrected. Dual fresh reviews at `3828c21`: spec **PASS** (zero
blocking), quality **APPROVED** (zero critical/important). New adjacents A48–A53 ledgered.
Verification re-run fresh at `3828c21` (typecheck 0, 259/259, smoke 9/9); live-run applicability
boundary restated in `verification.md`. Findings 2–4 remain adjacents pending owner
adjudication of the FR-008 spec-internal tension; Standards adjacents 1–6 unchanged.
