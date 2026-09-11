---
name: writing-plans
description: Turn approved development artifacts into an exact, executable implementation plan.
disable-model-invocation: true
---

# Writing Plans

## Required inputs

The most precise approved artifacts available, preferring `specification.md`, then `slices.md`, `prd.md`, `discovery.md`, and `context.md` in that order. A bounded user-supplied specification is acceptable when the complete chain is intentionally skipped and the reason is recorded.

## Optional inputs

Repository workflow commands, project policy, accepted simplification recommendations, and fixed delivery constraints.

## Required companion skills

None.

## Output

`docs/work/{WORK_ITEM}/implementation-plan.md`, where `{WORK_ITEM}` names the approved work item. Do not pre-create `implementation-notes.md`.

## Process

1. Confirm approved scope and trace every task to requirement identifiers or bounded source statements.
2. Inspect the repository before naming work. Each task names exact files, exact commands, and expected results.
3. Break behavior changes into public-seam **RED** and **GREEN** steps: state the expected failing observation, minimal correction, focused verification, and refactor-while-green opportunity. **The seam depends on which surface the task touches — harness source (`src/`, vitest) or pipeline integration (a real run against a seeded buggy repo in Docker); see `tdd/SKILL.md`** — and is never source text. Name the surface and working directory for each plan task. Note where a task carries a non-optional pipeline run (anything touching the sandbox flow does).
4. Include setup, validation, and rollback-safe sequencing. Use standard-library or native features where adequate.
5. Define frequent coherent commits and provide the exact commit message for each task.
6. Include no placeholders, invented file paths, ellipses standing for work, or unsupported commands.
7. Present the complete plan for approval without beginning implementation.

## Completion criterion

The approved plan is executable line by line, traces to requirements, names exact files, commands and expected results, includes RED/GREEN evidence gates and frequent commits, and contains no placeholders.

## Stop conditions

Stop when required scope is not approved, a file or command cannot be determined from repository evidence, traceability is incomplete, or a step still depends on an unstated decision.

## Next recommended skill

Recommend `ponytail` for plan simplification, then `using-git-worktrees` and `implement` to execute the approved plan slice by slice.
