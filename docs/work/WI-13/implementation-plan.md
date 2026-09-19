# WI-13 Implementation Plan — dependency-aware parallel queue

Approved scope: `docs/work/WI-13/specification.md` (FR-001..FR-011), sliced per
`docs/work/WI-13/slices.md`. Baseline: main @ `0e75502`, 223 tests / 10 files green,
`npm run typecheck` exit 0. All tasks run in one worktree (branch `worktree-wi-13`,
created by `/using-git-worktrees` before T1; image builds are controller-coordinated).

Standing rules for every task: focused vitest evidence at the module's public seam
before commit (`npx vitest run <file> -t "<focused>"` then full `npm test` +
`npm run typecheck`); no lint exists; every emitted string passes `assertNoSecrets`
at its emission seam; `src/sandcastle-adapter.ts` stays the only Sandcastle import
(enforced by `src/sandcastle-adapter.boundary.test.ts`).

---

## Slice 1 — Planner pass replaces triage (FR-001, FR-009; record decisions 1, 8)

### T1 — Plan output contract: schema + parser (src/queue.ts, src/queue.test.ts)

RED: `parsePlanOutput` does not exist. New tests in `src/queue.test.ts` (focused tag
`plan-parse`): accepts a `<plan>{"priority":{"gh-1":5},"blockedBy":{"gh-2":["gh-1"]}}</plan>`
block with full id coverage; rejects missing block, bad JSON, Zod-invalid bodies,
unknown-id edges, self-edges, id coverage gaps, and any cycle among edges — each
returns `undefined`.

GREEN: add to `src/queue.ts` — `export interface PlanValue { priority: Readonly<Record<string, number>>; blockedBy: Readonly<Record<string, readonly string[]>> }`,
Zod schema `PlanOutput` (priority ints 1–5, blockedBy arrays of known-id strings;
edge-target validation and cycle detection in the parser, not the schema), and
`export function parsePlanOutput(stdout: string, ids: readonly string[]): PlanValue | undefined`
following `parseTriageOutput`'s exact contract shape. Do not delete the triage
functions yet (T3 does).

Refactor-while-green: none expected. Commit: `feat(WI-13): plan output contract — schema, parser, cycle/edge validation (FR-001)`

### T2 — Planner prompt + ordering (src/queue.ts, src/queue.test.ts)

RED: `buildPlanPrompt` / `orderFromPlan` absent. Tests (tag `plan-order`):
`buildPlanPrompt([gh-1, gh-2])` output contains both ids, the `<plan>` contract line,
and the all-blocked rule sentence; `orderFromPlan` ranks by priority desc with
ascending-number ties, and with no plan returns ascending-number order unchanged.

GREEN: `export function buildPlanPrompt(issues: readonly NormalizedIssue[]): string`
(modeled on `buildTriagePrompt`; adds the blocked-by definition and "if every issue is
blocked, give the single highest-priority candidate the highest priority and no
blockers"), and `export function orderFromPlan(issues, plan | undefined): NormalizedIssue[]`.

Commit: `feat(WI-13): planner prompt + priority ordering with deterministic fallback (FR-001)`

### T3 — Adapter + loop wiring: --triage retires (src/sandcastle-adapter.ts, src/loop.ts, src/loop.test.ts, src/sandcastle-adapter.boundary.test.ts untouched)

RED: tests in `src/loop.test.ts` (tag `planner-wiring`): the queue invokes the planner
dep exactly once when more than one issue is eligible, never for a single eligible
issue; a run invoked with `--triage` in argv fails at startup with a message naming
the always-on planner as the replacement (asserted through the exported
argv-validation path, before any dep call).

GREEN: adapter — replace `runTriage`/`TRIAGE_BRANCH`/`triageRunOptions` with
`runPlan`/`PLAN_BRANCH` (`loop/plan`)/`planRunOptions()`, same `boundedRunOptions`
(maxIterations 1, asserted bound). `src/loop.ts`: rename the `runTriage` dep to
`runPlan` in `QueueLoopDeps` and the real wiring in `main()`; `runQueue` calls the
planner (prompt via `buildPlanPrompt`, guarded by `assertNoSecrets`) whenever
`split.eligible.length > 1`, parses via `parsePlanOutput`, and keeps the degraded
fallback (loud warning line, deterministic order) from today's triage path verbatim.
CLI: `--triage` in argv → throw at startup (message: `--triage was removed — the
dependency-aware planner now always runs when more than one issue is eligible`);
remove `triage` from `QueueRunInput`. Delete `buildTriagePrompt`, `parseTriageOutput`,
`TriageValue` and their tests; `admitIssues`'s triage parameters go in T5.

Expected: full suite green (triage tests removed with their subject); boundary test
unchanged and passing.

Commit: `feat(WI-13): planner pass wired, --triage retired with loud startup error (FR-001, FR-009)`

---

## Slice 2 — Wave runner, admission, cap semantics (FR-002..FR-006; decisions 1, 5–7, 9–12)

### T4 — Admission rework: optional ceiling (src/queue.ts, src/queue.test.ts, src/loop.ts)

RED: `admitIssues` still requires `cap`. Tests (tag `admission`): with no ceiling all
ranked issues are admitted; with ceiling 2 of 5, two admitted and three carry reason
`cap`; file-overlap deferral is gone (two same-file issues both admitted — edges own
serialization now, FR-002).

GREEN: `AdmitInput.cap` becomes optional (`cap?: number`); remove the overlap-deferral
block and `NotAdmitted`'s overlap reason; `src/loop.ts` `parseCap` keeps validating
passed values (integer ≥ 1) but `main()` reads `--max-issues` as optional
(`cap: number | undefined` into `QueueRunInput`), and `runQueue` prints the surfaced
plan line — `plan: attempted ≤ N | all unblocked` followed by one line per issue
(attempt / blocked-by `<ids>`) — via `console.log` after admission, before any lane
starts.

Commit: `feat(WI-13): optional attempted-issue ceiling; plan surfaced before spend (FR-005)`

### T5 — Wave scheduling (src/queue.ts, src/queue.test.ts)

RED: `scheduleWaves` absent. Tests (tag `waves`): given order [A,B,C] with edges
B←A: non-opted mode yields waves [[A],[B,C-minus-blocked…]] — precisely: wave 1 = all
issues with no unresolved blockers ([A]), and after A completes, B becomes runnable —
expressed as `scheduleWaves(order, edges)` returning wave 1 plus a
`unblockedAfter(completed: Set<string>)` helper (the runner calls it after each lane
settles or each merge); opted-in semantics are the runner's re-plan (T6), not this
function's. Also: all-blocked input yields the highest-priority single candidate
(empty-edge override the planner already encodes — function tolerates edges pointing
outside the run by ignoring them).

GREEN: `export function initialUnblocked(order: readonly NormalizedIssue[], edges: Readonly<Record<string, readonly string[]>>): NormalizedIssue[]`
and `export function unblockedAfter(remaining, edges, completed: ReadonlySet<string>): NormalizedIssue[]`
— both pure, both counting only edges whose blocker is itself in the run.

Commit: `feat(WI-13): wave scheduling — unblocked-set computation over dependency edges (FR-002, FR-003)`

### T6 — runQueue becomes the wave runner (src/loop.ts, src/loop.test.ts)

RED (one test per behavior, tag `wave-runner`): (a) two independent issues → both
`runSingleIssue` invocations are in flight concurrently (assert the deps record
overlap — e.g. lane A's runSingleIssue not resolving until lane B has started);
(b) one lane's issue-level failure does not abort the other lane (both outcomes in
the summary); (c) a harness-level outcome (stale-baseline failure or reverted
outcome) aborts with `QueueAbortedError` whose snapshot carries the sibling lane's
open PR; (d) opted-in: B blocked-by-A is not attempted until A's outcome is merged,
then a second planner call runs and B is attempted (two `runPlan` calls total);
(e) non-opted: B starts only after A's lane settles with a PR; (f) `--max-issues 1`
admits one issue (sequential dial); (g) the plan line precedes the first
`runSingleIssue` call in emitted order.

GREEN: rewrite `runQueue`'s execution section: admission → plan line → loop { run
the current unblocked set concurrently via `Promise.allSettled` over
`runSingleIssue`; collect per-issue outcomes into the existing summary accumulators
(reused verbatim: reverted/uncanaried pre-abort collection, merged tuples,
mergeFailures, fixed/prUrls); after the wave, on opted-in profiles with ≥1 merge:
re-plan (`runPlan` again, one call per merge wave) and `unblockedAfter`; on
non-opted: `unblockedAfter` with completed = lanes that settled with a PR; a
harness-level failure aborts immediately after its wave's collection; terminate when
the attempted budget hits the ceiling or nothing is unblocked }. `attempted` counts
lanes started; not-attempted blocked issues ride `notAdmitted` with reason
`blocked by <ids>`.

Constraint: no new deps beyond renaming T3's — `runSingleIssue` and the summary
accumulators are reused untouched.

Commit: `feat(WI-13): wave runner — concurrent lanes, re-plan on merge, stop-the-line preserved (FR-002..FR-004, FR-006)`

---

## Slice 3 — Merger agent behind the verified gate (FR-007, FR-008; decisions 2–4)

### T7 — Adapter: bounded merger run (src/sandcastle-adapter.ts, src/sandcastle-adapter.boundary.test.ts if it asserts exports)

RED: `runMerger` absent; boundary/adapter tests for `mergerRunOptions()` assert
`maxIterations` is 1 and the branch is the passed fix branch (same shape as
`triageRunOptions`'s assertions today).

GREEN: `export const MERGER_MAX_ITERATIONS = 1`, `export function mergerRunOptions(branch: string): BoundedRunOptions`
(`boundedRunOptions("merger", branch)`), and
`export async function runMerger(input: TriageRunInput & { readonly branch: string; readonly mainRef: string }): Promise<{ stdout: string; commits: readonly { sha: string }[] }>`
— one bounded `run({..., branchStrategy: { type: "branch", branch }, ...})` whose
prompt (built by the caller in T8) instructs merging `mainRef` into `branch` and
resolving conflicts; returns commits for the caller's evidence.

Commit: `feat(WI-13): bounded merger run behind the adapter boundary (FR-007)`

### T8 — Verified-merger gate in the loop (src/loop.ts, src/loop.test.ts)

RED (tag `verified-merger`): (a) opted-in run whose second fix branch conflicts with
updated main: `runMerger` invoked, then a FRESH verification sandbox runs on the
resolved branch; if that verification is red → no merge, PR open,
`mergeFailure`-posture note recorded (`merger resolution failed verification: …`),
queue continues, issue not counted merged; green → existing chain (pre-merge review
→ mergePr → canary) proceeds unchanged; (b) non-opted run with the same conflict:
`runMerger` never invoked (assert zero calls), PR opens; (c) a thrown merger run →
PR open, loud note, run continues.

GREEN: new `LoopDeps` members `branchConflictsWithMain(repoDir, branch): Promise<boolean>`
(`git merge-tree` wiring in `main()`'s real deps) and `runMerger` (adapter). Extract
the existing verification block of `runSingleIssue` (install → repro → suite →
`diffVerification`) into a module-private helper `verifyInFreshSandbox(...)` reused
by both the primary verification and the merger gate — same rules, one
implementation. Insert, on `autoMerge === true` only, after `runPreMergeReview`
approves and before `mergePr`: if `branchConflictsWithMain` → `runMerger` (prompt
guarded by `assertNoSecrets`) → re-run `verifyInFreshSandbox` on the resolved branch
→ red returns the `mergeFailure`-posture outcome, green proceeds to `mergePr`.

Commit: `feat(WI-13): merger agent on opted-in repos, gated by fresh-sandbox verification (FR-007, FR-008)`

---

## Slice 4 — Docs honesty + live integration validation (FR-010, FR-011)

### T9 — Docs honesty (CLAUDE.md, docs/agents/workflow.md)

RED: none (documentation). Inspection criterion: CLAUDE.md's `src/queue.ts` and
`src/loop.ts` rows name the planner pass, wave runner, and merger gate (replacing
triage wording); workflow.md's loop command row drops `--triage`, documents the
removed-flag startup error, optional `--max-issues`, all-unblocked default, and the
merger-on-opted-in behavior.

Commit: `docs(WI-13): module rows + workflow commands — planner, waves, verified merger (FR-010)`

### T10 — Live integration run (fixtures repo, local Docker; evidence → docs/work/WI-13/)

Controller-coordinated (image build via `npm run build:image`; the fixtures repo
`/home/bitcot/Documents/projects/loop-fixtures-py` gets 3 seeded open issues: two
independent, one blocked-by-one-of-them, seeded on fixtures main by the owner-facing
git identity — the harness never discovers issues, a human seeds them). Run
`npm run loop -- --repo /home/bitcot/Documents/projects/loop-fixtures-py --provider claude-via-proxy`
(no `--max-issues`: all-unblocked default exercised; profile is `autoMerge: true`).
Expected observation, recorded verbatim to `docs/work/WI-13/evidence/live-run.log`:
plan line first → two concurrent lanes → two per-issue PRs → first merge → re-plan →
blocked issue attempted → third PR → merges with canaries green → summary's
attempted/fixed/merged lines. A defect found here goes through `diagnosing-bugs`
before delivery; failures are recorded verbatim, never re-rolled silently.

Commit: `docs(WI-13): live integration evidence — parallel lanes, re-plan unblock, verified merges (FR-011)`

---

## Sequencing and rollback

T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10, one commit each, one worktree.
Every commit leaves `npm run typecheck` + `npm test` green (baseline 223 tests;
counts move as triage tests are deleted and new tests land — record the delta per
checkpoint in the implementation notes). Rollback-safe: each task is a coherent
commit; a defect reverts its commit and re-runs the focused tag.

## Evidence gates per checkpoint (implement-skill contract)

- Focused GREEN: the task's vitest tag, named above.
- Broad: `npm run typecheck` exit 0; `npm test` all green.
- T10 additionally: pipeline-integration evidence (the recorded live log) — the only
  runtime surface claim in this work item.

## Non-goals (per the record)

No batch PRs, no lanes knob, no new provider, no cloud sandboxes, no change to the
confidentiality gate or reproduction-test retention; the plan-approval/replan tier
stays out of scope.
