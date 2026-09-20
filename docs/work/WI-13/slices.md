# WI-13 — Slices

Four items, one work item, all on the queue/planning seam in `src/`
(primarily `src/queue.ts` + `src/loop.ts` + the adapter) plus one live
integration validation. Slices 2 and 3 are the risk carriers; slices 1 and 4
are bounded.

## Slice 1 — Planner pass replaces triage (record decisions 1, 8)

**Behavior change.** One always-run model call per queue run outputs
priority ordering + `blockedBy` edges over eligible issues; its parser
reuses the triage fallback contract (unparseable/failed → deterministic
ascending order + loud warning, queue continues). `--triage` retires
(CLI flag removed; passing it is a startup error, loud not silent).
Sandcastle's "every issue blocked → single highest-priority candidate"
rule carries into the planner prompt. RED: planner output parsing
(accept/reject/degrade), edge-aware ordering, flag-removal error.
Size: medium. Risk: medium.

## Slice 2 — Wave runner, admission, cap semantics (record decisions 1, 5, 7, 9, 10, 11, 12)

**Behavior change.** The sequential queue runner becomes wave-based:
plan → unblocked eligible issues run concurrently, each an isolated
per-issue loop (own sandbox, own branch, own PR) → outcomes collected →
re-plan → newly unblocked attempted while attempted-budget remains.
Admission defaults to ALL unblocked surfaced issues; `--max-issues N`
(passed) caps attempted issues; the surfaced plan is printed before any
agent spend. Blocked-issue semantics: on opted-in repos, blocked waits
for its blocker to MERGE (re-plan unblocks); on non-opted repos, blocked
waits for its blocker's lane to finish (PR opened) then runs — the
"human merges in order" posture of 2026-09-15 decision 2. Stop-the-line
preserved verbatim: issue-level failures don't abort other lanes;
harness-level failures (stale baseline, red canary, uncanaried) abort
with the partial summary. `--max-issues 1` is the sequential dial.
RED: concurrent-lane collection, per-issue outcome independence,
halt-on-harness-failure with open PRs standing, cap absent/present,
plan-before-spend line. Size: large. Risk: high.

## Slice 3 — Merger agent behind the verified gate (record decisions 2, 3, 4)

**Behavior change.** On `autoMerge: true` profiles only: before each
per-issue merge, a merger agent resolves that branch's conflicts against
the just-updated main; its output is then treated as untrusted agent
work — the merged result must pass fresh-sandbox verification (repro +
suite vs baseline) before the existing chain proceeds (pre-merge review
→ squash-merge → canary → revert/halt/@-notify). A failed merger run or
failed verification leaves the PR open for a human, run continues (the
existing mergeFailure posture). Non-opted repos never invoke the merger.
Adapter boundary holds (`src/sandcastle-adapter.ts` stays the only
Sandcastle import). RED: opted-in invocation, non-opted non-invocation,
verified-merger gating order, merger-failure fallback. Size: large.
Risk: high.

## Slice 4 — Docs honesty + live integration validation (record: mechanical consequences)

**Validation + docs.** CLAUDE.md module rows and `docs/agents/workflow.md`
updated in the same PR as the code. One live parallel run against the
seeded fixtures repo (`manjula25/loop-fixtures-py`) with multiple open
seeded issues in Docker: proves planner → parallel lanes → per-issue PRs →
(opted-in) sequential verified merges → re-plan unblocking a blocked
issue. Size: medium. Risk: low (observation-shaped).

## Sequencing

Slice 1 → 2 → 3 → 4; 2 depends on 1's graph shape, 3 depends on 2's
landing order, 4 validates the whole. Standing rules apply: no lint step
exists; every emitted string through the secrets guard; the harness repo
itself keeps human merge.
