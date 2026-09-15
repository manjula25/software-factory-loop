# PRD carve-out — WI-2: Queue ingestion

## Status

Approved scope — 2026-09-14, owner (four scope decisions below); extended 2026-09-15
after adversarial spec review (decisions 5–8) and a grilling pass against Sandcastle's
actual template code and the wider agent market (decisions 9–13); amended 2026-09-15
after an owner comparison review against Sandcastle (decisions 14–15: dependency-aware
deferral under `--triage`; Zod-validated triage output).

## Source

This is a carve-out of `harness-prd-v2.md` (the plan of record), not a new product document.
Every requirement here traces to a PRD section; the PRD wins on any disagreement.

## Problem

WI-1 proved one bug fixed end-to-end, but the loop accepts a single issue number
(`--issue N`) at a time. The PRD's whole framing is a *queue* of already-known issues worked
in order, with a cap so a backlog cannot silently burn API budget or flood the human
reviewer, and a check so an issue with an open PR is never fixed twice in parallel.

## In scope (this work item)

1. **Queue acquisition (GitHub Issues only)** — read the target repo's open issues via
   `gh issue list` (optional `--label` filter, one page at the default limit) and normalize
   each through the existing normalizer into `{ id, description, attachedLog?, sourceType }`.
   The one-page bound also caps downstream triage spend. PRD L3, L35; User Story 1
   (GitHub subset).
2. **Budget cap** — a hard cap on issues *processed* (fix attempts) per run, no silent
   spend beyond the cap. Default admission order is deterministic (ascending issue id);
   priority ranking is opt-in (see 3). PRD L22 (User Story 8), L47 (Budget control).
3. **Triage pass (opt-in)** — an optional `--triage` flag that, when the deduped queue
   exceeds the cap, ranks issues by priority from their descriptions to choose the admitted
   subset, and also reports the files each issue likely touches so an issue overlapping an
   already-admitted one is deferred to a later run with the reason named (decision 14).
   Its output is validated with a Zod schema — Sandcastle's `Output.object` pattern
   (decision 15). Without the flag, the cap admits issues in deterministic order with no
   file knowledge. PRD L47, reinterpreted by grilling decision 9 (Sandcastle's
   cheap-by-default shape).
4. **Dedup / already-in-progress check** — skip an issue that has an **open PR** (the PRD's
   own signal, L43). A `fix/gh-N` branch left over *without* a PR (a failed or interrupted
   attempt) is stale: deleted, and the issue stays eligible for retry. PRD L21
   (User Story 7), L43, L104.
5. **Sequential multi-issue run** — process the capped, ordered queue one issue at a time
   through the existing hardened per-issue loop (baseline preflight, fix, fresh-sandbox
   verification, PR); one issue's failure does not abort the rest; end-of-run summary of
   attempted / fixed / failed / skipped with PR links. PRD L22, L25 (User Story 11).
6. **No new bookkeeping state** — failure knowledge lives in the stores that already exist:
   the open issue (reappears in every queue), the accumulated per-issue agent logs on disk,
   and open PRs. No run-record file. Failed attempts delete their branch so every retry
   starts from clean main (constraint 2: never trust leftover agent state).

## Adopted from Sandcastle (grilling 2026-09-15, decision 12)

Everything worth taking except machine merge:

- **Deterministic branch identity** (`fix/<issue-id>`, stable across runs) — already WI-1
  behavior, now load-bearing for dedup and stale-branch handling.
- **Structured output** (validated JSON, the `Output.object` pattern) for triage scores —
  concretely a **Zod schema** since decision 15; already the PRD's standing pattern (L86).
- **Install-before-agent hooks** in every sandbox — already WI-1 behavior.
- **A hard run bound** (their `MAX_ITERATIONS`; our `--max-issues` cap) instead of
  unbounded backlog grinding.
- **`copyToWorktree`-style dependency reuse** to skip full installs in sandboxes — noted as
  an implementation consideration for the plan, not a requirement.
- **Dependency-graph planning** — taken in a *lightweight* form since decision 14: the
  triage pass reports per-issue file overlap and admission defers overlapping issues
  (sequential execution turns "blocked-by" into "deferred-to-next-run"). Full
  overlap-aware *grouping* still belongs with the future parallelism item, matching
  Sandcastle's own pairing of the two.

## Future direction — confirmed target architecture (decision 13, updated 2026-09-15)

**Confirmed by the team lead, 2026-09-15.** The target loop is: issue (with client-provided
log) → harness builds a plan → **human approves the plan** → execute → verify independently
→ loop until verified → **merge automatically** → next issue. This is Sandcastle's autonomy
tier (plan-prompt → merger agent → auto-closed issues) with two gates Matt's templates omit:
explicit human plan approval before execution, and our independent fresh-sandbox
verification before merge. Human judgment moves from per-diff review to per-plan approval.

Market check (2026-09-15): platform agents for real repos (Copilot, Codex, Jules, Cursor,
Devin by default, OpenHands, Sweep, Factory) all use issue → PR → human merge; auto-merge
survives as opt-in for unattended/CI contexts, and agentic-PR research (~29% never merged;
task completion 38–65%) argues for keeping *a* human gate — the plan approval is that gate.

**Replan rule (decided 2026-09-15, same day):** the human approves the plan **once**, before
execution. If verification later proves the plan's logic wrong, the agent automatically
drafts a revised plan and continues — no re-approval — but only up to a bounded number of
replans per issue (then the issue stops and reports). Every replan is recorded so the human
can see what changed and why. This adopts Sandcastle's automatic-replan behavior (its outer
loop re-plans every cycle; its implementers grind within an iteration budget) while keeping
the one approval gate that distinguishes our tier from Matt's no-human tier. Tactical
adaptation below the plan line (implementation details the plan doesn't specify) was always
the agent's freedom and needs no replan.

Open questions for this tier's own grilling pass (when that work item starts): the post-merge
risk a PR would otherwise have caught (rollback replaces review — there is no PR to reject
anymore); the replan budget N and what happens to an issue that exhausts it; where plans
live and what the approval interaction looks like.

Still required before implementation, unchanged: **auto-merge remains banned for the POC
(constraint 1); adopting this tier needs its own grilling pass and a PRD revision**, and the
confidentiality gate (constraint 3) applies to any client-provided log regardless of
architecture: no client data reaches the harness until Bitcot's policy confirmation is
explicit.

## Out of scope (deferred)

- **Attachment-URL fetching** (user-attachments links in issue bodies) → WI-3. Live test
  case already seeded: fixtures issue #3's uploaded file.
- **Spec-doc and plain-list sources** (Sandcastle `custom` tracker / SETUP_ISSUE_TRACKER.md
  seam) → WI-3 or later. PRD L33, L35.
- **Parallelism and dependency-aware grouping** → later work item. Sequential first; the
  shared Docker daemon and repo worktrees make concurrency a separate risk to prove.
  PRD L45 is the end state, not this item.
- **Content-matching dedup** (same bug re-filed under a new issue number) → not built;
  branch/PR-existence identity only. PRD L43 names the label/body-reference mechanism;
  the WI-1 identity scheme (`fix/gh-N`) makes existence checking exact for that scheme.

## Owner scope decisions

1. WI-2 is **queue + cap + triage + dedup only**; attachment fetch and other sources move to
   WI-3. (2026-09-14)
2. **Sequential** issue processing; parallelism is a later item. (2026-09-14)
3. Triage uses the **same provider/model as the fix agent** (glm-5.2 via the registry) with a
   short prompt — "cheap" is honored by the prompt, not a second model. Revisit when a
   genuinely cheaper model exists. (2026-09-14)
4. Dedup identity is **existence-based only** — no content similarity matching. (2026-09-14;
   refined to open-PR-primary by decision 11)
5. Queue acquisition supports an **optional `--label` filter** (default: all open issues).
   The label is the human's curation tool against non-bug issues; the harness does not try
   to detect issue type itself. (Adversarial review, 2026-09-15)
6. **`--issue N` stays an explicit single-issue override** when queue mode lands: no cap,
   no triage — the user named the issue. Dedup still applies. Queue mode is the default
   when `--issue` is absent. (Adversarial review, 2026-09-15)
7. **Unreadable triage output degrades, not aborts**: fall back to a deterministic order
   (ascending issue number) up to the cap, with a loud warning. (Adversarial review,
   2026-09-15)
8. Live evidence for cap + triage must include a **cap-forcing run** (cap < deduped queue
   size, e.g. `--max-issues 1` with ≥ 2 fixable issues) — unit stubs alone are not enough
   for the riskiest new machinery. (Adversarial review, 2026-09-15)
9. **Deterministic order is the default; AI ranking is opt-in** (`--triage`), following
   Sandcastle's cheap-by-default shape — its templates have no priority scoring at all,
   just a hard iteration bound. PRD constraint 5's "triaged by priority" is read as
   "capped and ordered, deterministically by default." (Grilling, 2026-09-15)
10. **Accept merge-time conflicts** between sequential fixes to the same module; the human
    resolver merges in order. Overlap-aware grouping stays with the future parallelism
    item, matching Sandcastle's own pairing. *(Amended 2026-09-15 by decision 14: under
    `--triage`, overlapping issues are deferred instead of stacked — conflicts are only
    accepted when triage is off.)* (Grilling, 2026-09-15)
11. **No run-record file** (rejected Option C). Failure memory = the stores that already
    exist: open issue, open PRs, accumulated agent logs. Failed branches are deleted so
    retries start from clean main; resume-on-branch is rejected because unverified leftover
    changes could fool the RED-truthfulness gate. Dedup's primary signal becomes the
    **open PR**; a branch without a PR is stale — deleted, retried. (Grilling, 2026-09-15)
12. **Adopt Sandcastle's best practices except machine merge** — see "Adopted from
    Sandcastle" above. (Grilling, 2026-09-15)
13. **Future direction recorded**: plan-approval-gated autonomy (human approves plan
    up front, machine may then merge) — see "Future direction" above. Not this POC.
    (Grilling, 2026-09-15)
14. **Dependency-aware deferral under `--triage`** (Sandcastle's plan-prompt dependency
    graph, translated for sequential execution): the triage pass returns per-issue priority
    scores *and* the files each issue likely touches; admission walks the ranked list and
    defers an issue whose file set overlaps an already-admitted issue's, reporting it as
    not-admitted with the overlap reason. The deterministic default is unchanged — no
    model call, no file knowledge, conflicts accepted per decision 10. Full grouping
    stays with the parallelism item. (Comparison review, 2026-09-15)
15. **Triage output is validated with a Zod schema** (`{ scores: Record<id, 1–5>,
    files: Record<id, string[]> }`), following Sandcastle's `Output.object` + Zod
    pattern instead of a hand-rolled tolerant parser. Any validation failure takes the
    existing decision-7 degrade path (deterministic order, loud warning). Zod becomes a
    direct dependency of the harness. (Comparison review, 2026-09-15)

## Constraints inherited unchanged

Hard constraints 1–6 of the repo CLAUDE.md (never auto-merge; never trust the agent's
completion signal; confidentiality gate; regression tests stay in the suite; budget cap;
local Docker only), plus: environment values never echoed in prompts, PR bodies, or anything
the harness writes (Grilling decision 5); provider selection stays registry-driven with no
hard-coded provider (Grilling decision 4).
