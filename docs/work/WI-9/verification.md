# WI-9 Verification

## Claim (exact)

The delivered harness tree (worktree `worktree-wi-9`, evidence at `f11100f`)
ran live, end-to-end, in local Docker with real LLM fix runs (no stubs)
against `manjula25/loop-fixtures-py`, and processed both WI-9-seeded issues
through the full opt-in auto-merge chain — closing the standing
pipeline-integration non-claim carried by every work item since WI-6.

## Task 1 — seed (FR-001)

Claim: two dormant bugs seeded in one new module with two open issues; suite
green; baseline MATCH. Zero LLM except one probe.

Evidence: `evidence/t1-seed.md` (seed commit `88a18c3` pushed; fresh-clone
suite in the sandbox image **17 passed**; defects hand-verified; preflight
`MATCH`, branch auto-deleted; probe `OK` exit 0; smoke 9/9; issues **#22**
clean-style and **#23** messy-log-style, both OPEN — the entire eligible
queue).

## Run 1 — gh-22 through the full chain, gh-23 deferred (FR-002/FR-003)

Claim: one live queue-mode run with triage: higher-ranked issue fixed,
verified, merged, canaried green, closed; the other deferred for file
overlap with the reason visible.

Evidence: `evidence/run1.log` (verbatim, exit 0) + `evidence/run1-endstates.md`
(fresh gh read-backs: #22 CLOSED, #23 OPEN, PR #24 MERGED with born-red RED /
GREEN / symptom-mapping / independent-verification body; squash merge
`5f372b6` on the seed; triage raw JSON `gh-22:4 > gh-23:3`, both naming
`src/loopfix/numops.py` → `NOT ADMITTED gh-23: file overlap with gh-22`;
this run's branches all cleaned).

## Run 2 — the deferred issue completes (FR-002/FR-003)

Claim: second live run admits the previously-deferred issue (re-admission
after its blocker merged), runs the same chain, no triage pass.

Evidence: `evidence/run2.log` (verbatim, exit 0) + `evidence/run2-endstates.md`
(#23 CLOSED, PR #25 MERGED @ `b46c9ef` with born-red evidence body; no
triage lines in the log; both issues now CLOSED; no leftover branches).
Operational note recorded there: the controller session restarted mid-run;
the run process was unaffected and completed normally.

## Final state (FR-002 success criteria) — proven 2026-09-19

Fresh clone of `origin/main`, suite run inside the committed
`sandcastle-loop` image:

- `src/loopfix/numops.py`: `clamp` = `max(lo, min(value, hi))`; `mean` =
  `sum(values) / len(values)` — both seeded defects fixed.
- `tests/fixed-issues/test_gh_22.py` + `test_gh_23.py` present (constraint 4:
  repro tests retained in the suite).
- `python -m pytest -q` → **23 passed in 0.05s** (17 pre-seed + 6 new
  repro-test assertions-worth of tests), exit 0.

`origin/main` history: `b46c9ef (gh-23 #25)` → `5f372b6 (gh-22 #24)` →
`88a18c3 seed` — both fixes stacked as squash merges.

## Spend (FR-003)

Total agent-bearing invocations: **1 probe + 1 triage pass + 2 fix runs** —
exactly the approved plan (design decision (b)). Zero strong-model retries;
zero unaccounted invocations; the per-run cap machinery admitted at most 1
issue per run (run 1: cap 3, triage deferred 1; run 2: 1 eligible).

## Defects (FR-004)

None surfaced. Task 5 never triggered; the "no defects remain unrecorded"
criterion holds (nothing to record). No harness `src/` file changed in this
work item — confirmed by the branch diff (docs + evidence only).

## Harness gates (fresh at evidence candidate `f11100f`)

| Check | Command | Result |
|---|---|---|
| Full suite | `npm test` | 10 files / 216 tests, exit 0 (unchanged baseline) |
| Typecheck | `npm run typecheck` | exit 0 |
| Tree | `git status --short` | clean |

## Non-claim closure — and the non-claims that remain

**Closed:** "no pipeline-integration (Docker/gh) run of the current tree" —
the standing non-claim in WI-6/WI-7/WI-8's verification records — is now
closed for the delivered tree: real Docker sandboxes (preflight, fix,
verification, canary), real gh acquisition/dedup/triage/PR/merge/issue-close,
real LLM fix runs, through the complete opt-in chain, twice.

**Still non-claims (unchanged):**
- Failure-path surfaces (teardown throws, uncanaried merge, revert-on-red)
  were not exercised live — no fault injection was attempted (per spec
  boundary); WI-7/WI-8 unit evidence stands. No naturally occurring one
  arose (both canaries green).
- No cloud sandbox (constraint 6); spend claims are invocation counts, not
  cost figures; the loop ran against the harness's own synthetic fixtures
  repo with self-authored issues only (constraint 3).

## Remaining risks

- The two live runs prove the happy path plus the deferral/re-admission
  path on this tree; a naturally red canary or revert remains
  live-proven only by WI-6 T7's evidence (older tree).
- Old `origin/fix/gh-{1,2,3,10}` branches from prior work items remain on
  the fixtures repo (adjacent observation; tolerated by the stale-branch
  pass).

---

## Work-item completion verification — WI-9

Claim (exact): at candidate `ffc64c0` (worktree-wi-9 HEAD, clean tree), the
harness's delivered tree has run the complete opt-in auto-merge chain live
twice with real LLM fix runs; both seeded issues are closed with merged,
evidence-bearing PRs; the deferral/re-admission path behaved per design
decision (b); spend matched FR-003 exactly; no harness `src/` changed; the
standing pipeline-integration non-claim is closed.

Proving commands, fresh at `ffc64c0` (2026-09-19):

| Check | Command | Result |
|---|---|---|
| Full suite (broad) | `npm test` | 10 files / 216 tests, exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Tree | `git status --short` | clean |
| Branch diff scope | `git diff --stat 278bbf7..HEAD` | 7 files, all docs/evidence under `docs/work/WI-9/` — zero `src/` changes |
| Issue #22 end-state | `gh issue view 22` | CLOSED |
| Issue #23 end-state | `gh issue view 23` | CLOSED |
| PR #24 end-state | `gh pr view 24` | MERGED |
| PR #25 end-state | `gh pr view 25` | MERGED |
| Fixtures main | `git log origin/main` | `b46c9ef (#25)` → `5f372b6 (#24)` → `88a18c3 seed` |

(External gh/git reads above are the runtime/external evidence class; the
run logs `run1.log`/`run2.log` and per-task evidence files carry the
in-run detail, including born-red RED sections in both PR bodies — read
back fresh at T-task time and recorded in `run1-endstates.md` /
`run2-endstates.md`.)

Unknown reconciliation: none open. Both approved design decisions were
exercised as decided — (b) deferral/re-admission ran live (gh-23 deferred in
run 1, admitted and completed in run 2); (a) red-canary handling was never
triggered (both canaries green) — it remains a defined posture, not claimed
as live-proven on this tree (matches the stated remaining risk).

Deferred (explicit, owner: follow-up backlog): stale
`origin/fix/gh-{1,2,3,10}` fixtures branches from prior work items;
naturally-red-canary/revert live proof on the current tree.

Remaining risks: none within the claimed boundary. Hard constraints all
held live: opt-in chain only on the fixtures repo (1), fresh-sandbox gates
real (2), self-authored synthetic data only (3), repro tests retained (4),
spend exactly as ledgered (5), local Docker only (6).

Non-claims (final): failure-path surfaces not exercised live (no fault
injection; none arose naturally); spend claims are invocation counts; no
cost figures; no claims about the naturally-red-canary path on this tree.
