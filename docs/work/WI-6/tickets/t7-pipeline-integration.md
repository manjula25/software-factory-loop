# T7 — Pipeline integration (live end-to-end)

## What to build

The whole chain, live against the seeded fixtures repo in local Docker, onboarded with
`--auto-merge`: issue admitted → fix → verification green → review pass → squash merge
→ canary green on main → issue closed with evidence. Plus an observed canary-red
scenario: a merge whose canary fails → revert lands on main → run halts → @-mention
comment posted → `⚠️ REVERTED` summary → non-zero exit → issue stays queued.

## Blocked by

T4, T5, T6 (everything above it in the chain must exist).

## Requirement coverage

FR-010 (specification.md), observing FR-001/003/004/005/006/007/008/009 end-to-end;
slice 7.

## Acceptance criteria

- [ ] Green chain observed end-to-end on the fixtures repo with auto-merge opted in, recorded with commands, outputs, exit codes in `docs/work/WI-6/verification.md` (`pipeline-integration`)
- [ ] Canary-red scenario observed end-to-end: revert on main, halt, notification comment, `⚠️ REVERTED` summary, non-zero exit, issue still queued (`pipeline-integration`)
- [ ] LLM spend limited to at most the one real cheap-model review exercise (T6); the canary-red scenario constructed without LLM spend where feasible
- [ ] The harness's own repository is never merged into by any test or run

## Evidence boundary

The fixtures repo is the only live target. No performance or multi-issue-throughput
claims beyond the existing cap. Observations recorded as evidence in verification.md,
not as new requirements.

## Status

Ready for planning
