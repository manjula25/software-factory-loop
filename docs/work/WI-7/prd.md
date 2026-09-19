# WI-7 PRD carve-out — post-WI-6 hardening & cleanup batch

Derived from `harness-prd-v2.md` (plan of record) and the WI-6 evidence trail
(`docs/work/WI-6/review.md`, `implementation-notes.md`, `verification.md`). The
PRD wins on any disagreement. This is a traceability artifact, not a new product
requirement: every item below is a recorded WI-6 follow-up or review finding on
surfaces the PRD already mandates.

## Why this work item exists

WI-6 delivered the opt-in auto-merge chain live-proven (green chain, real-agent
canary-red chain with revert/halt/notify, re-queue proof — `docs/work/WI-6/verification.md`
T7/T7b). Delivery deferred a bounded set of findings. Two are
correctness-adjacent edges of the revert net; three are test gaps on wired-but-
unasserted behaviors; the rest are recorded quality debt. None changes the
product's purpose, scope, or any hard constraint.

## Scope

### 1. Acquisition-time freshness (correctness)

PRD anchor: "Review and merge gate" (the revert net) + "Dedup /
already-in-progress check"; WI-6 spec FR-002/FR-006.

The queue's git-derived signals (`mainRevertsPr`, remote `fix/*` branch
listing, stale-branch deletion) read the target clone's local
remote-tracking refs, which are only refreshed after a successful auto-merge
(`syncMainToOrigin`). A clone that missed a revert — pushed from elsewhere, or
by a human merge — can wrongly skip a reverted issue (treat it as fixed) or
miss that a remote fix branch is gone. Fix: refresh remote state
(`git fetch --prune origin`) once at queue acquisition, before any dedup
judgment. Failure of that fetch is a harness-level abort (loud, before spend),
matching the existing staleness posture.

### 2. syncMain failure surface (correctness)

PRD anchor: "Review and merge gate" — red → auto-revert, run halt, immediate
notification; WI-6 spec FR-005/FR-006.

Today a thrown `syncMain` (divergent local main, git/network failure) after a
successful merge propagates uncaught: exit 1 and a stack trace, but no PR
comment, no summary record, and an uncanaried merge left on main — the one
point where the revert net silently fails open. WI-7 defines the failure
surface: the merge that could not be canaried must be loudly reported (PR
comment + run summary + halt), and a blind `git revert` against an unsynced
local main must NOT be attempted. Exact behavior shape is a spec-review
decision recorded in `specification.md`.

### 3. Negative-path test gaps (verification)

PRD anchor: "Testing Decisions" (dedup behaviors tested; test only external
behavior). Wired-but-unasserted behaviors from WI-6:

- a secret-bearing fix diff blocks the review call (guard-before-call ordering);
- the `loop/review` throwaway branch is deleted on the throw path;
- `syncMainToOrigin`'s fetch-ref (non-main) branch refuses a divergent main.

### 4. Refactor-while-green batch (quality, no behavior change)

Recorded code-quality follow-ups: extract `runPreMergeReview()` /
`runCanary()` from `runSingleIssue`; `advanceUpstream()` test helper;
`BoundedRunOptions` named type; `covers` predicate and `valuelessFlag` helper
(both now at their n=3 thresholds); rename `OPEN_PR_PAGE_LIMIT` →
`PR_PAGE_LIMIT`; deduplicate the byte-identical `CANARY_RED_*` test constants;
`autoMerge` doc-comment wording ("by a human, outside the harness"). All
refactors keep the suite byte-green; none changes a public seam's behavior
(seam signatures may not change — `diff` on the review input and the
positional `closeIssue` shape are frozen this work item).

## Out of scope (explicit)

- Revert-matcher permanence after a human re-merge (spec-silent; future work
  item — recorded in WI-6 `review.md`).
- `skipped-merged` summary segment on non-opted repos (cosmetic tension,
  recorded; FR-002 mandates the dedup source-agnostically).
- Merger-agent conflict resolution, replan tier, parallelism (PRD out-of-scope).
- Any change to hard constraints or the PRD's product scope.

## Success criteria

At delivery: both correctness edges have live-reasoned unit coverage at the
public seam and the recorded stale-clone scenario is closed; the three test
gaps assert their behaviors; the refactor batch lands with the suite green and
no public-seam behavior change; full suite + typecheck fresh at the delivered
candidate.
