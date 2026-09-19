# WI-13 — Dependency-aware parallel queue (Sandcastle model)

**Status:** Grilling complete 2026-09-19; PRD + CLAUDE.md amendments drafted.
Owner approved every decision interactively (this file is the record).

## Origin

User direction 2026-09-19: bring the dependency-aware queue into scope as the
next work item — the growth item parked in the PRD's out-of-scope list ("Detecting
or handling non-independent issues"). The owner directed the design to follow
Sandcastle's model throughout ("full Sandcastle parallelism needed… this also i
have given already to follow sandcastle"), which this record honors wherever it
does not break constraint 2 (never trust an agent's completion signal) — and
amends, with compensating controls, where the owner explicitly chose to.

## Feasibility cross-check (facts, verified 2026-09-19)

- Sandcastle's `parallel-planner-with-review` template (installed 0.12.0) is a
  three-phase outer loop: **Phase 1** one planner agent reads all issues and
  emits one structured plan — the dependency graph (`blockedBy` edges, defined
  in `plan-prompt.md`: "B's requirements depend on a decision or API shape that
  A will establish…") plus priority ("include the single highest-priority
  candidate") — no separate triage call exists; **Phase 2** every unblocked
  issue runs concurrently (`Promise.allSettled`, one sandbox/branch each, no
  count cap); **Phase 3** a merger agent merges completed branches, resolving
  conflicts itself and re-running tests inside its own sandbox; the outer loop
  re-plans after merges (blocked issues unblock).
- Our surfaces that this supersedes: `--triage` (priority scoring + file-overlap
  deferral, opt-in, `buildTriagePrompt`/`parseTriageOutput`); the sequential
  `for (const issue of admission.admitted)` queue runner in `src/loop.ts`;
  `parseCap`'s hard default of 3.
- Our surfaces this reuses untouched: the whole per-issue loop (repro → fix →
  fresh-sandbox verification → PR), the WI-6 chain (pre-merge review →
  squash-merge → canary → revert/halt/@-notify → issue close), dedup + revert
  re-queue guard, the triage fallback pattern (unparseable output →
  deterministic order, loud warning, queue continues).

## Grilling decisions (owner, 2026-09-19)

1. **Full Sandcastle parallelism is in scope.** A planner builds a dependency
   graph; unblocked issues run concurrently, each in its own sandbox and fix
   branch. Amends the PRD out-of-scope line on non-independent issues.
2. **A merger agent resolves conflicts** between parallel fix branches
   (Sandcastle's Phase 3), extending the WI-5 machine-merge amendment: machine
   *conflict resolution* is now sanctioned — but only as scoped by decisions 3
   and 4.
3. **Verified merger — the merger is never trusted.** Its output is agent work:
   no merge counts until the merged result passes fresh-sandbox verification
   the merger never touched, then the existing chain (pre-merge review →
   squash-merge → canary → auto-revert). Constraint 2 stays fully intact; the
   merger is "the fix agent for conflicts." This is the compensating control
   that makes decision 2 acceptable.
4. **The merger chain runs only on `autoMerge: true` repos.** Non-opted repos
   get parallel fixing and parallel per-issue PRs — no merger agent, no machine
   merge; humans merge, and conflicts between open PRs are the human's call,
   as today. Constraint 1's opt-in gate untouched.
5. **Per-issue PRs, landed one at a time — no batch PRs.** Each fix keeps its
   own PR, merge, canary, and revert unit. The merger's job: before each
   merge, resolve that branch's conflicts against the just-updated main. A red
   canary reverts exactly one fix and re-queues exactly one issue.
6. **No concurrency knob.** No `--lanes`/parallelism flag; concurrency is
   governed by the attempted-issue budget alone (see decision 11).
7. **Parallel is the default queue behavior — no `--parallel` flag.** The
   queue always plans and runs unblocked issues concurrently; sequential is
   the degenerate case (`--max-issues 1`). One code path.
8. **One planner call replaces `--triage`.** Always runs; outputs priority
   ordering + `blockedBy` edges together (Sandcastle's Phase 1 shape).
   Same-file overlap (today's deferral) becomes an edge — serialized, not
   deferred out of the run. The existing fallback carries over: unparseable
   planner output → deterministic ascending order, loud warning, queue
   continues. `--triage` retires.
9. **Same-run re-plan (Sandcastle's outer loop).** After each merge wave the
   planner re-runs; newly unblocked issues are attempted while budget remains.
   Terminates when the budget is spent or nothing is unblocked.
10. **Stop-the-line preserved.** A red canary, an uncanaried merge, or a
    repo-wide failure halts the run exactly as today; other lanes' already-open
    PRs stand as deliverables and the summary reports them honestly.
    Parallelism changes when fixes are *produced*, not how *failures* are
    treated.
11. **All unblocked issues run by default, regardless of count** (owner
    decision, overriding the recommended cap — "match Sandcastle exactly").
    Amends hard constraint 5 / user story 8: per-run spend is bounded by the
    open-issue queue, surfaced in the plan before any spend, not by a fixed
    default number.
12. **`--max-issues` survives as an explicit optional ceiling.** Absent → all
    unblocked issues (decision 11). Passed → at most N attempted. The dial
    stays for an operator who wants a bound on a particular run.

## Constraints — carried and amended

- **Constraint 2 untouched** (decision 3 is its enforcement for the merger).
- **Constraints 3, 4, 6 untouched** (confidentiality gate, repro-test
  retention, local Docker — noting N concurrent containers on one machine is a
  practical limit to watch, not a rule).
- **Constraint 1 extended, not weakened** (decisions 2–4): machine conflict
  resolution joins machine merge behind the same per-repo opt-in, under the
  verified-merger gate and the existing revert net.
- **Constraint 5 amended** (decisions 11–12): the cap becomes an explicit
  optional ceiling; the default bound is the surfaced plan (all unblocked
  issues). "No silent API spend" survives as "no spend beyond what the plan
  surfaced at run start."

## Mechanical consequences (implementation must include)

- The sequential queue runner becomes wave-based: plan → run unblocked
  concurrently (`Promise.allSettled` shape) → land per-issue PRs sequentially
  through the existing chain → re-plan → repeat.
- Planner pass: new prompt + parser replacing `buildTriagePrompt`/
  `parseTriageOutput`; `--triage` flag removed from the CLI; the
  degraded-fallback path (deterministic order + warning) reused verbatim.
- `parseCap` loses its default of 3; absent flag = unlimited; explicit values
  still validated (integer ≥ 1).
- Merger-agent wiring lives behind the adapter boundary
  (`src/sandcastle-adapter.ts` stays the only Sandcastle import), invoked only
  on opted-in profiles, its output routed through the existing verification
  seam before any `mergePr`.
- Budget/summary surfaces must state the plan up front (issues to be
  attempted) so the constraint-5 amendment's "surfaced before spend" holds.
- CLAUDE.md module table and workflow.md commands updated in the same PR as
  the code.

## Explicit non-goals

- No batch PRs, no lanes knob, no cloud sandboxes, no change to the
  confidentiality gate or reproduction-test retention.
- The confirmed tier's plan-approval gate and whole-work replan budget
  (PRD decision 5, 2026-09-15) remain out of scope; decision 9's re-plan is
  dependency-driven issue *selection* within a run, not that tier's replan.

## Scope of this work item

This WI-13 record + the PRD and CLAUDE.md amendments only. Implementation is
a separate work item through the normal chain (to-spec → writing-plans →
ponytail → worktree → implement), carving the FRs from the revised PRD.
