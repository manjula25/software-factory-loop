# T4 — Scenario 1: reproduce-then-fix, end to end

## What to build

The first automated execution of the harness's real command-line entry. Driven against the seeded
fixture through the **queue path** — not the single-issue override — with exactly one issue
eligible, so acquisition, dedup, classification and the single-lane wave runner all run and the
planner does not (its trigger is more than one eligible issue, which is what keeps the run
deterministic).

From the open issue describing the seeded bug, the run must produce, as real observable artifacts:

- a reproduction test that fails before the fix and passes after it, committed **with** the fix
  (hard constraint 4 — it is a permanent artifact, not scaffolding);
- a fix that turns the fixture's suite green, created as a commit by the harness, on the fixture's
  base branch;
- an independent re-verification in a fresh sandbox against the full suite — the agent's own
  completion signal is never the evidence (hard constraint 2);
- a real pull request on GitHub, reviewed by the pre-merge review pass, **squash-merged** (the
  fixture is opted in), and then the post-merge canary run against the merged base branch.

Three demonstrations land here, and they are the point of the ticket as much as the flow is:

1. **Planted-defect RED→GREEN.** A deliberately wrong argument passed to a real `git` or `gh` call
   in the entry path turns the scenario red; reverting it turns it green. This is the check that
   could not previously fail, shown to now be able to (FR-001).
2. **Induced-skip RED.** With the harness prevented from doing its work while still exiting
   successfully, the scenario **fails** rather than passing on a clean exit (FR-005). A check that
   cannot fail is not evidence, applied inward.
3. **Killed-run → clean-run pair.** A run killed mid-flight leaves a branch and an open PR; the
   next run reaches the same outcome anyway. This completes FR-004's reset proof on a mess a real
   run made, and repeats FR-010's guard against runs that do work.

## Blocked by

T3 (the command, the reset and the guard), T1 and T2 transitively.

## Requirement coverage

FR-001; FR-005; FR-006; completes FR-004 and FR-010 from T3; slice B.

## Acceptance criteria

- [ ] Driving the real CLI through the queue path lands a fix commit on the fixture's base branch
      and the run reports the expected outcome (`integration run`)
- [ ] The reproduction test the fix carries fails on the pre-fix commit and passes on the post-fix
      commit, run in the sandbox (`integration run`, before/after pair)
- [ ] A pull request is opened on the fixture, reviewed, and merged by the harness — the merge
      gate's wiring executed for the first time (`integration run` + `gh` read-back)
- [ ] The canary runs against the merged base branch and its result is the one the run reports
      (`integration run`)
- [ ] A wrong argument in the entry path turns the scenario red, and reverting it turns it green
      (`integration run`, recorded RED→GREEN pair)
- [ ] With the queue unable to find work and the harness exiting clean, the scenario **fails**
      (`integration run`, recorded induced-skip RED)
- [ ] After a run killed mid-flight, the next run reaches the same outcome (`integration run`,
      killed-run → clean-run pair)
- [ ] The run's console output contains no `@`-mention of a real account (`integration run`)
- [ ] No file under `src/` is changed to make any of this pass; expecting defects here is the point
      of the work item, but fixing them is a separate, reported decision (`review`)

## Evidence boundary

Proves the scenario's branches of the entry — acquisition, dedup, classification, the single-lane
wave runner, the fix pass, verification, PR creation, the review pass, the merge, and the canary —
against real `git`, real `gh` and real GitHub. Does **not** prove the planner pass, the multi-lane
wave runner, the dependency-aware re-plan, the merger/conflict path, the auto-revert net, or the
escalation comment and label writes; A-2 is narrowed, not closed (FR-001's non-claims). Does not
prove anything about a live model.

## Status

Ready for planning