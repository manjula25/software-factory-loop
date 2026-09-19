# WI-9 slices

Dependency-ordered; the run itself (slice 2) is pipeline-integration
evidence, not harness-source TDD — its "tests" are live runs against the
seeded repo in local Docker, per the repo's two-surface rule. Slice 1 is
zero-LLM setup on the fixtures repo. Slice 3 is the evidence record.

## Slice 1 — seed two bugs + issues, refresh the baseline (zero LLM)

Two dormant buggy functions in one `loop-fixtures-py` module, committed to
its `main`; two GitHub issues in the WI-1 style (symptom + expectation, one
with a messy inline log block to exercise attachment discovery); suite on
`main` stays green (baseline unchanged); both issues open and eligible.
Evidence: issue URLs, fresh suite run on a clean clone, profile preflight
MATCH.

Files: `manjula25/loop-fixtures-py` (source + issues via gh) — no harness
source changes expected.

Depends on: nothing.

## Slice 2 — the live run (real LLM, opt-in auto-merge chain)

One `npm run loop` queue-mode run on the delivered harness tree against the
fixtures repo. Capture the full log verbatim (it is the primary evidence
artifact). Expected observable chain per issue: acquisition + dedup → triage
(2 eligible sharing a module — ranking and any file-overlap deferral visible)
→ real fix run (born-red repro test + fix) → fresh-sandbox verification gate
→ PR with RED/GREEN evidence → pre-merge diff review → squash-merge → canary
green on merged main → issue auto-close. Budget guard: exactly 2 fix runs +
1 triage pass; the PRD's strong-model retry rule only on inexplicable
failure. Machinery defects surfaced: fixed TDD in-loop, recorded, run
re-driven from a clean state.

Files: none in this harness repo unless a defect fix lands here (then: the
defecting module + its vitest seam test, per the normal TDD path).

Depends on: slice 1.

## Slice 3 — evidence record and non-claim closure

`docs/work/WI-9/verification.md`: the verbatim run log (durable reference or
committed log), PR/merge/canary/issue-close end-states read back fresh via
gh, final fresh-clone state of fixtures `main` (both repro tests present and
green, both fixes present), spend accounting, and the explicit closure of the
standing pipeline-integration non-claim for this tree. Remaining non-claims
stay stated (failure-path surfaces unit-proven only; no fault injection).

Depends on: slice 2.
