# WI-10 Verification

## Claim (exact)

The delivered harness tree (worktree `worktree-wi-10`, evidence at
`d431f74`) ran live, end-to-end, in local Docker with a real LLM fix run
(no stubs) against `manjula25/loop-fixtures-py`, and drove a verified fix
through a deliberately raced merge into a **red post-merge canary** —
exercising the opt-in chain's compensating controls live on the current
tree: auto-revert on `main`, run halt, and the `@manjula25` notify comment
on the merged PR, with the issue left open. This closes the
red-canary/revert live non-claim (previously live-proven only on the older
WI-6 T7 tree with the LLM stubbed).

## FR-001 — seed + prepared conflicting test

Claim: one dormant bug + one open issue (the entire eligible queue) +
a prepared-but-unpushed contract test proven to pass against the buggy
code. Zero LLM except one probe.

Evidence: `evidence/t1-seed.md` — seed `afcee4a` pushed; fresh-clone suite
in the image **23 passed** (dormant); defect hand-checked
(`to_cents(1.50) → 1`); preflight `MATCH`; issue **#26** OPEN and the only
open issue; contract branch `wi10-conflict` @ `461a13f` local-only with a
**25 passed** image proof (both contract tests green against the buggy
code). Probe `OK` exit 0; smoke 9/9.

## FR-002 — the red-canary compensating controls, live

Claim: one single-issue run (decision (b)) with the timed push landing
in-window on attempt 1; the full chain observed: verification green on the
branch → pre-merge review → squash merge onto raced main → canary RED on
exactly the two contract tests → auto-revert → run halt → notify comment;
issue stays open (decision (c)); Task 2b never triggered.

Evidence: `evidence/run.log` (verbatim, 40 lines) + `evidence/run-endstates.md`
(timing table — push at 16:21:57, 65 s after branch start, agent visibly
working; fresh read-backs: four-commit linear main `afcee4a → 461a13f →
7febfdb → b113686`; tree = buggy `moneyops.py` + contract test present +
repro test absent; PR #27 MERGED with the verbatim `@manjula25 ⚠️ REVERTED`
comment, author `manjula25`; issue #26 OPEN; no run branches left; fresh
clone at `b113686` → **25 passed**).

## FR-003 — spend

**1 probe + 1 fix run, 0 triage, 0 strong-model retries** — under the
approved ceiling (decision (a): ≤2 fix runs) with zero unaccounted
invocations. Single-issue mode spent no triage pass (decision (b) held).

## FR-004 — defects and the record

No harness defects surfaced (Task 4 never triggered). One orchestration
evidence-capture deviation recorded in `run-endstates.md`: the tee pipeline
masked the CLI's true exit code (`$?` read tee's status); the harness's
exit-1-on-failure behavior stands on unit evidence (`src/loop.ts` report
path, pinned in `loop.test.ts` since WI-6/WI-8). No `src/` change in this
work item (branch diff = docs/evidence only).

## Harness gates (fresh at evidence candidate `d431f74`)

| Check | Command | Result |
|---|---|---|
| Full suite | `npm test` | 10 files / 216 tests, exit 0 (unchanged baseline) |
| Typecheck | `npm run typecheck` | exit 0 |
| Tree | `git status --short` | clean |
| Branch diff scope | `git diff --stat 9fc072b..HEAD` | 4 files, docs/evidence only, zero `src/` |

## Live-claim closure — and the non-claims that remain

**Closed:** "the canary-red path (auto-revert + halt + @-notify) is
live-proven only on the older WI-6 T7 tree" — now live-proven on the
current tree with a real LLM fix run, a real raced merge, and the revert
read back fresh.

**Still non-claims (unchanged):**
- The red canary was **induced** by an orchestrator-manufactured race
  (push timed into the fix-agent window) — the harness's behavior was
  unstubbed and untouched, but this is not evidence that naturally
  occurring developer races happen at any particular rate.
- The uncanaried-merge surface and canary/verification teardown-failure
  surfaces were not exercised live — no fault injection (per spec
  boundary); WI-7/WI-8 unit evidence stands.
- The true CLI exit code of the reverted run was not captured (tee-pipeline
  masking, above); the failure line, revert, comment, and halt are directly
  observed regardless.
- No cloud (constraint 6); invocation counts, not cost figures;
  self-authored synthetic data only (constraint 3).

## Remaining risks

- The race was landed on attempt 1 with ~2.5 minutes of margin; the window
  is comfortable for this repo's run shape (minutes-long fix runs), but a
  much faster fix could narrow it — relevant only to future inductions,
  not to the claim proven here.
- Old `origin/fix/gh-{1,2,3,10}` fixtures branches remain (pre-existing,
  tolerated by the stale-branch pass; backlog).
- Fixtures repo end-state is deliberately untidied per decision (c): issue
  #26 open, contract test pinning the buggy behavior on `main`. A future
  work item (or human) resolves the requirement conflict and fixes the
  issue for real.
