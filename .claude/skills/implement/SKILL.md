---
name: implement
description: Orchestrate one approved implementation slice through bounded plan-driven work and sequential independent reviews, on the public seam of whichever surface is being changed (harness source or pipeline integration).
disable-model-invocation: true
---

# Implement

## Required inputs

One approved slice (a ticket under `docs/work/{WORK_ITEM}/tickets/` or one numbered task from its
`implementation-plan.md`), a verified worktree and baseline, and a top-level controller
authorized to coordinate the work.

## Optional inputs

Project policy (`docs/agents/project-policy.md`), simplification recommendations from `ponytail`,
named expertise, and the per-surface verification commands in `docs/agents/workflow.md`
(Repository commands).

## Required companion skills

None. The implementer leaf follows the seam discipline of `tdd/SKILL.md`; the controller does not
re-invoke it as a separate orchestration layer.

## Output

One accepted candidate checkpoint plus `docs/work/{WORK_ITEM}/implementation-notes.md` created only
when implementation begins, and appended implementation evidence in `verification.md`.

## Project context

This repository has **two surfaces and the public seam differs on each** — see `tdd/SKILL.md`:
harness source (`src/`, TypeScript, proven through vitest at the public seam of the module being
changed) and pipeline integration (an issue moving through normalize → reproduce → fix → verify,
proven by actually running the flow against a seeded buggy repo in Docker — never a source-text
assertion). RED and GREEN are shaped by the surface, and a source-text assertion satisfies
neither. The hard constraints in `CLAUDE.md` (never auto-merge; fresh-sandbox re-verification,
never the agent's own completion signal; the confidentiality gate on client data; the per-run
budget cap) are invariants the reviews enforce.

## Process

The top-level controller is the only orchestrator. Use this loop exactly:

**select one approved slice → classify size and risk → verify worktree and baseline → create exact task brief → dispatch one leaf implementer → inspect candidate and focused GREEN → build fixed review package → run specification review → fix blocking specification findings → run code-quality review → rerun both reviews if candidate changed → accept checkpoint → append verification and implementation notes**

1. Record task size, risk, time budget, tool budget, evidence boundary, fixed point, and intended candidate before dispatch.
2. Use [task-brief](scripts/task-brief) to isolate one numbered plan task. The brief names the public seam for the surface being changed (the observable behavior and the command that exercises it), the files allowed to change, the commands and budgets, and the required RED/GREEN evidence shape.
3. Dispatch one implementer for one current slice using [the implementer contract](implementer-prompt.md). Every behavior change requires observed RED and focused GREEN evidence at the seam of its surface. Where a slice touches the sandbox pipeline, actually running the flow against a seeded buggy repo in Docker is part of the task, not optional.
4. Children are leaves: no child can invoke `implement`, any orchestration skill, another agent, or dispatch work. Missing expertise returns `UNVERIFIED` to the controller.
5. Inspect the candidate directly. Build a fixed package with [review-package](scripts/review-package) that accounts for every changed path and pins base and candidate identities.
6. Run [specification review](spec-reviewer-prompt.md) before [code-quality review](code-quality-reviewer-prompt.md); reviewers are read-only leaves.
7. Fix blocking findings through the controller. A changed candidate invalidates both prior review identities; rerun specification review first, then code-quality review.
8. Treat adjacent findings as follow-up work rather than silent scope expansion. Append deviations, new unknowns, conservative decisions, and follow-ups without silently rewriting approved specifications.
9. Accept a checkpoint only when focused GREEN and both sequential reviews apply to the exact candidate.

## Completion criterion

One bounded candidate has fresh RED/GREEN at its surface's seam and focused evidence, every changed path is accounted for, sequential reviews approve the same identity, and notes record deviations and follow-ups without scope expansion.

## Stop conditions

Stop on an unapproved slice, failing baseline, ambiguous task, missing evidence or expertise, `UNVERIFIED` review result, exhausted budget, recursive dispatch attempt, changed candidate awaiting both reviews, or unresolved blocking finding. A surface whose seam cannot yet be exercised (nothing scaffolded — see `docs/agents/workflow.md`, Repository commands) is a stated non-claim, never a reason to substitute a source-text assertion.

## Next recommended skill

Recommend `verification-before-completion` after all approved implementation checkpoints are accepted.
