# WI-5 — Auto-merge tier (constraint-1 revision)

**Status:** Grilling complete 2026-09-18; PRD revision drafted. Owner
approved every decision interactively (this file is the record).

## Origin

User direction 2026-09-18: build an auto-merge agent, noting Sandcastle
(mattpocock) ships one. Cross-check found the plan of record already
anticipated this: PRD line 86 records the team lead's confirmed long-term
architecture including auto-merge, explicitly gated on "its own grilling
and a PRD revision." This work item is that grilling's output and the
revision it cleared.

## Feasibility cross-check (facts, verified 2026-09-18)

- Sandcastle's `parallel-planner-with-review` template (installed 0.12.0)
  is fully autonomous end-to-end: plan → implement → LLM reviewer per diff
  → **merger agent** (`merge-prompt.md`: resolve conflicts itself, re-run
  typecheck + tests, fix failures) → close issues. No human gate anywhere.
  The confirmed PRD tier called this "Sandcastle's autonomy tier with two
  gates his templates lack."
- Surfaces encoding "never auto-merge": PRD L20 (user story 6), L51
  (review-and-merge gate), L68 (wrong-test guard — "human judges"), L100
  (out of scope); CLAUDE.md hard constraint 1 + lifecycle text;
  `src/loop.ts:277` PR body ("A human reviews and merges this");
  `src/queue.ts` dedup lists `--state open` PRs only (merged fix PRs stop
  deduplicating under auto-merge → re-fix loops); PRD decision 2 (L83:
  same-module conflicts resolved by "the human merges in order").
- Mechanically small: a `mergePr` dep beside `createPr`, `gh pr merge
  --squash` over existing auth. The cost is the gaps auto-merge opens,
  addressed by the decisions below.

## Grilling decisions (owner, 2026-09-18)

1. **Shape B — standalone merger, safety-railed.** Keep the built pipeline
   (issue → repro → fix → verify → PR), then auto-merge on
   verification-green. Not the full confirmed tier (no plan-approval gate);
   not merge-on-approval. Humans remain at: authoring the issue queue, the
   per-repo opt-in, the confidentiality gate. The harness's own repository
   keeps human merges — this changes the product's behavior on target
   repos, not the development process.
2. **PRs stay; squash-merged via `gh`.** The PR is the audit artifact
   (RED/GREEN evidence, symptom mapping) and the revert handle. One commit
   per issue on main.
3. **Canary after every merge; revert halts the run.** Post-merge, the
   full suite runs on main in a fresh sandbox (it includes every prior
   regression test). Red → auto-revert the merge commit; the run HALTS
   (a revert means the verification machinery misjudged — do not grind on);
   the reverted issue stays in the queue for the next run.
4. **Opt-in: `--auto-merge` at onboarding → `autoMerge: true` in the
   profile.** Off by default; existing repos unchanged; hand-editable to
   disable. Mirrors `confidentialityCleared`: a considered, per-repo human
   assertion.
5. **Conflicts: the merger agent resolves them** (Sandcastle-style), but
   every merge — conflicted or not — still passes the canary; revert +
   halt still apply. A conflict is detected deterministically (no
   misjudgment); a bad resolution is caught by the canary.
6. **Revert notification: immediate, via GitHub.** The moment a revert
   happens, a comment on the merged PR @-mentions the owner (GitHub pushes
   the notification) + a loud `⚠️ REVERTED` section in the run summary +
   failing exit code. Zero new secrets or channels.
7. **Close the issue on merge**, with an evidence comment — keeps the
   queue honest (acquisition lists open issues; without closing, fixed
   bugs re-enter the queue every run). Spec-doc/plain-list sources have no
   GitHub issue; nothing to close there.
8. **Pre-merge review pass on opted-in repos only:** a cheaper-model diff
   review ("does this change do what the report asked, nothing more?").
   Uncertain/wrong/unavailable → skip auto-merge, leave the PR open with a
   comment, run continues. Never applied to non-opted repos (their
   behavior and spend are unchanged). This is the step PRD L51 described
   but was never built, and matches Sandcastle's reviewer phase.

## Constraints carried unchanged

Verification still gates everything (constraint 2 — never trust the
agent's "done"); confidentiality gate; budget cap; local Docker only;
reproduction tests permanent.

## Mechanical consequences (implementation must include)

- Dedup must consider merged PRs (not only open) or fixed issues re-run.
- PR body text reflects auto-merge mode when opted in (the "A human
  reviews and merges this" line is conditional).
- Issue closing only for `gh`-sourced issues.

## Scope of this work item

This WI-5 record + the PRD and CLAUDE.md revisions only. Implementation is
a separate work item through the normal chain (to-spec → to-tickets →
writing-plans → ponytail → implement), carving the FRs from the revised
PRD.
