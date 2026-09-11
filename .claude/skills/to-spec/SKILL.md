---
name: to-spec
description: Produce measurable functional requirements and success criteria for a work item traced to harness-prd-v2.md.
disable-model-invocation: true
---

# To Spec

## Required inputs

A work item (a user story, implementation decision, or bounded subset of `harness-prd-v2.md`)
whose PRD entry is the approved source. Every functional requirement traces to the PRD section
it serves; a requirement the PRD does not support, or a PRD promise with no requirement behind
it, is a finding to raise — fix the PRD or the work item, never bridge the gap inside a
specification. There is no build plan yet; until one exists, the work item's boundary is stated
in the specification and approved by the user.

## Optional inputs

Durable project policy (`docs/agents/project-policy.md`, `CONTEXT.md`) and confirmed discovery
evidence from `grilling`.

## Project context — evidence labels here

There is no `verify.sh`. Evidence labels name the **surface** through which a success criterion
is observed, per the Repository commands table in `docs/agents/workflow.md`:

- **Document-level** — while no code exists: a citation into `harness-prd-v2.md`.
- **Harness source (`src/`)** — vitest at the public seam of the module being changed (once the
  scaffold exists).
- **Pipeline integration (local Docker)** — an actually-executed run of the flow against a
  seeded buggy repo; label it separately and note the Docker dependency.

Anything the PRD's Out of Scope list names stays a **non-claim** — never a requirement with a
hopeful success criterion.

## Required companion skills

None.

## Output

`docs/work/{WORK_ITEM}/specification.md` rendered from [the specification template](specification-template.md).

The specification is a work-item-local execution artifact: it makes that item's scope measurable.
It does not fork the PRD — where it and `harness-prd-v2.md` disagree, the PRD wins and the
disagreement goes back to the PRD as an edit, not into the specification.

## Process

1. Reference the task's plan entry and lettered sub-steps instead of restating their prose.
2. Give every functional requirement an `FR-###` identifier and trace it to the work item's plan steps and to the `harness-prd-v2.md` section it serves.
3. Define measurable success criteria with surface evidence labels and explicit boundaries, error behavior, and non-claims.
4. Keep the specification implementation-neutral: no implementation paths, class names, or speculative architecture.
5. Record open questions using `[NEEDS CLARIFICATION: question]`. Allow at most three markers; if more are needed, return to discovery.
6. Present the specification for approval before implementation planning.

## Completion criterion

Every functional requirement is uniquely identified and traceable, success criteria are measurable and evidence-labeled, boundaries are explicit, and no more than three clarification markers remain.

## Stop conditions

Stop and return to discovery when more than three clarification markers are required, the work item has no `harness-prd-v2.md` grounding, or measurable acceptance cannot be stated honestly.

## Next recommended skill

Recommend `writing-plans` after specification approval when installed.
