# WI-16 — Slices

**Six slices, one prerequisite.** Record: `docs/work/WI-16/prd.md` (D1–D5). D3 bounds this work
item as "**one integration harness** (disposable repo + scripted-agent image, per D1/D4/D5)
**driven by three scenarios**, plus an explicit call on TD6" — so **Slice A is the harness and is
a blocker for B, C and D**. E and F are independent of everything.

This file is a carve-out of the grilling record, not new requirements: every slice names the
decisions and PRD bullets it descends from. Nothing here is decided that `prd.md` did not settle,
except the two spec-stage questions the record explicitly delegated (`prd.md` D5, D4's
consequence) — those are settled in `specification.md`, not here.

## Slice A — The integration harness (prerequisites for B, C, D)

**Behavior.** A test-driven fixture repository on GitHub, reset to a known state before each run
(remote branches pruned, open PRs closed, base branch reset to the seed commit); a **test-only
sandbox image** identical to the production image except that its agent entry points are scripts;
and the vitest wiring that makes the integration run part of `npm test`.

Answers the four hazards by construction: H1 and H3 stop being hazards because mutation lands in
a repo whose purpose is to be mutated **and** the pre-run reset removes the leftover that makes a
later run skip the work; H2 by the fixture profile carrying no notify handle; H4 by a
serialization guard around the fixture.

**RED.** The reset is provably effective — a run killed mid-flight leaves a branch and an open
PR, and the next run reaches the same outcome anyway. The serialization guard is provably
effective — a second concurrent invocation does not interleave with the first.

Size: large. Risk: medium — this is the slice that touches the network, Docker and a real
GitHub repo, and it is where the flakiness would live if the design is wrong.

## Slice B — Scenario 1: reproduce-then-fix, end to end (blocked by A)

**Behavior.** The real CLI entry, driven against the seeded fixture through the **queue path**
(not the `--issue` override), with exactly one issue eligible so the run is single-lane and
planner-free. From an open GitHub issue describing a seeded Python bug, the run drafts a
reproduction test, fixes the code, re-verifies in a fresh sandbox, opens a real PR, and — the
fixture being opted in — carries the merge chain through the pre-merge review, the squash-merge,
and the post-merge canary on the base branch.

Two requirements land together here and they are the same test: **TD3** ("go from issue
description to a verified, passing fix", at least one seeded repo in a non-Node language) and
**A-2** (`main()` and its real `git`/`gh` closures executed by an automated test for the first
time).

**RED.** Planted-defect evidence: a deliberately wrong subprocess argument in the entry path
turns the scenario red, and reverting it turns it green — the check that could not previously
fail now can. Separately, the vacuous-pass guard: with the harness prevented from doing its work,
the scenario **fails** rather than passing on a clean exit.

Size: large. Risk: medium-high — it is the first automated execution of the wiring, and it is
expected to find defects in `main()`. That is the point of the work item, not a surprise.

## Slice C — Scenario 2: onboarding against two seeded setups (blocked by A)

**Behavior.** Onboarding run against two seeded setups — one with thorough docs, one with none
(config files only) — confirming the recorded profile's commands **actually execute**, and that a
docs claim failing execution never reaches the profile.

Size: medium. Risk: medium — the seeded setups are new fixtures, and "no docs at all" is the
harder half to seed honestly.

## Slice D — Scenario 3: profile staleness (blocked by A)

**Behavior.** A fixture whose profile's test command no longer matches the code records a failed
verification and flags the profile for re-onboarding, rather than treating an errored or
zero-test command run as a pass.

Note the behavior is already implemented (`src/loop.ts:985–1009`); what is missing is the
seeded-repo scenario. This slice adds the scenario, not the behavior.

Size: medium. Risk: low-medium.

## Slice E — The TD6 call (independent)

**Behavior.** The prompt-text assertions in `src/loop.test.ts` are narrowed to the interface the
harness itself produces or parses, and the prose-sentence assertion is removed. `specification.md`
FR-012 states the rule and the reasoning; this slice applies it.

Test-only. No source behavior changes.

Size: small. Risk: low.

## Slice F — Docs honesty (independent)

**Behavior.** `docs/agents/workflow.md`'s command table gains `--image`, which the integration
test now depends on and which the table does not currently name (D4). `CLAUDE.md`'s module table
and the testing tiers stay honest about what the new gate does and does not prove, in the same PR
as the code — the table's own standing rule.

Size: small. Risk: none (review-verified).

## Sequencing

A → {B, C, D}; E and F ride alongside whichever slice lands first, all in one PR. Standing rules
apply: no lint step exists; every emitted string passes the secrets guard at its existing
emission seam; the harness repo itself keeps human merge (hard constraint 1) — unchanged by this
work item, which adds tests only.