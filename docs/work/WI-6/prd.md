# WI-6 — Auto-merge implementation (carve-out)

**Status:** Carved from the revised `harness-prd-v2.md` (PR #9, 2026-09-18).
Requirements of record: user story 6 (amended), "Review and merge gate"
(amended), decision records 2 (amended) and 5 (amended), and the grilling
record `docs/work/WI-5/prd.md` — the eight owner decisions. The PRD wins
on any disagreement.

## Scope table

| # | Requirement | PRD anchor |
|---|---|---|
| 1 | `--auto-merge` at onboarding records `autoMerge: true` in the profile; absent flag → field omitted; hand-editable | User story 6 (amended); decision 4 (WI-5) |
| 2 | On opted-in repos, verified PRs are squash-merged via `gh` after a blocking pre-merge diff-review pass; review uncertain/wrong/unavailable → no auto-merge, PR stays open, run continues | Review and merge gate (amended); decisions 2, 8 |
| 3 | Post-merge canary: full suite on main in a fresh sandbox after every merge; red → auto-revert the merge commit, halt the run, reverted issue stays queued | Review and merge gate; decision 3 |
| 4 | Revert notification: @-mention comment on the merged PR + loud `⚠️ REVERTED` run-summary section + failing exit code | Decision 6 |
| 5 | Issue closing on merge (gh-sourced issues only), with evidence comment; spec-doc/plain-list: nothing to close | Decision 7 |
| 6 | Dedup considers merged PRs, not only open ones — a merged fix means the issue is done | User story 7; mechanical consequences (WI-5 prd.md) |
| 7 | PR body text reflects the mode: auto-merge repos state the machine gate chain instead of "A human reviews and merges this" | Mechanical consequences (WI-5 prd.md) |
| 8 | Conflict resolution by the merger agent is out of WI-6's first cut if it expands scope materially — `gh pr merge` fails on conflict → treat as "no auto-merge, PR open, run continues" (the decision-5 agent-resolution is a named follow-up unless cheap) | Decision 5 (partial by design; record honestly) |

## Non-goals (unchanged constraints)

Verification gates everything (constraint 2); confidentiality gate; budget
cap; local Docker only; repro tests permanent. Plan-approval/replan tier:
future work item. The harness's own repo: always human merge.

## Evidence expectations

Unit (vitest) at every new seam; pipeline-integration: one live fixtures
run with auto-merge opted in (seeded bug → merged, canary green, issue
closed) and a canary-red → revert → halt scenario observed end-to-end
(zero or minimal LLM spend; the review pass may be exercised with the real
cheap model once, cost recorded).
