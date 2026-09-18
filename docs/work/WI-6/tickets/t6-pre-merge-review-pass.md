# T6 — Pre-merge diff-review pass

## What to build

On opted-in repos only, between verification-green and merge, a cheap-model review of
the PR diff judges the change against the reported issue. The pass is blocking: merge
happens only on an explicit approving verdict. Verdict uncertain, wrong-fix, or
reviewer unavailable (API down, budget refusal, unparseable response) → no auto-merge,
PR stays open for a human, a skip-reason comment is posted, the run continues.
Non-opted repos: the review pass never runs (zero spend).

## Blocked by

T3 (fills the review-gate extension point T3 leaves between verification and merge;
can be built in parallel with T4/T5 but merges after T3).

## Requirement coverage

FR-009 (specification.md) + completes FR-004's blocking order; slice 6.

## Acceptance criteria

- [ ] Approving verdict → merge proceeds; ordering verification → review → merge holds (`unit`, stubbed reviewer)
- [ ] Each non-approving verdict class (uncertain / wrong / unavailable / unparseable-as-uncertain) → no merge call, PR open, skip-reason comment posted, run continues, summary records the skip (`unit`)
- [ ] Non-opted repo → reviewer never invoked (`unit`)
- [ ] One live exercise with the real cheap model on the fixtures repo, cost recorded in `docs/work/WI-6/verification.md` (`pipeline-integration`)

## Evidence boundary

The reviewer sees diff + issue context only; it cannot merge, push, or branch. Spend
bounded to one review call per candidate merge. Not a security or style review and not
a replacement for the fresh-sandbox verification gate — it judges wrong-root-cause /
wrong-test risk only. The live exercise proves the real-model path once; verdict-class
coverage is stubbed-unit.

## Status

Ready for planning
