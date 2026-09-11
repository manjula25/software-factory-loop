---
name: setup-agentic-workflow
description: Configure the current repository for the selected Agentic Development Skills, including tracker rules, durable context, Architecture Decision Records, repository navigation, project policy, commands, and workflow integration.
disable-model-invocation: true
---

# Setup Agentic Workflow

## Required inputs

The target repository and user approval for repository-local changes.

## Optional inputs

Preferred tracker, base branch, branch naming, command set, evidence levels, and installed workflow selection.

## Required companion skills

None.

## Output

An approved, durable repository context: `CONTEXT.md`, `docs/adr/README.md`, `docs/adr/ADR-TEMPLATE.md`, `docs/agents/workflow.md`, `docs/agents/issue-tracker.md`, `docs/agents/domain.md`, `docs/agents/project-policy.md`, `docs/agents/repository-map.md`, and one bounded `## Agent workflow` instruction section. Also produce an installed-skill capability report naming missing companions.

## Process

1. **Explore repository before writing.** Inspect version control, remotes, base branch, monorepo signals, existing instructions, context, Architecture Decision Records, agent documents, tracker signals, installed skills, commands, policies, and worktree suitability.
2. Report existing and missing context. Never create empty architecture/testing documents merely to fill a checklist.
3. Detect installed skills and report capability coverage. Recommend tracker, context, and isolation defaults, but perform **no automatic skill installation**.
4. Select the repository instruction file safely: an existing `CLAUDE.md` wins over creating `AGENTS.md`; otherwise use an existing `AGENTS.md`. If neither exists, ask which file to create. Never create both.
5. Ask one question at a time for decisions repository evidence cannot answer.
6. Render proposed edits before writing. The proposal includes one bounded `## Agent workflow` section and every approved generated file. Preserve surrounding user content.
7. Obtain explicit approval, then create or reconcile only the approved files from [the templates](templates/).
8. Configure one tracker variant as `docs/agents/issue-tracker.md`; tracker access remains read-only unless a write is explicitly authorized.
9. Create Architecture Decision Record infrastructure only. Do not invent Architecture Decision Records: create one only when a decision is hard to reverse, surprising without context, and based on a meaningful trade-off.
10. Verify all references and perform an idempotent rerun check: the bounded instruction section remains unique, user content remains unchanged, and owned files reconcile rather than duplicate.
11. Report installed capability coverage and every missing companion without installing it.

## This repository is already configured — reconcile, do not overwrite

`test-harness` has its durable context in place. Treat these as the source of truth and
**reconcile against them, never overwrite**:

- `CLAUDE.md` — the single copy of agent guidance (repo identity, hard constraints, lifecycle,
  self-learning).
- `harness-prd-v2.md` — the plan of record; wins on product purpose.
- `docs/agents/workflow.md` — base branch, worktree policy, and the Repository commands table
  (currently *(none yet)* per surface — that is accurate, not a gap to fill with invented
  commands).
- `.claude/skills/<name>/` — the repo-local ADLC skills, flattened (no `engineering/` layer),
  adapted for the harness's two surfaces.

Deliberately absent, and not to be created by a rerun of this skill without approval: no
`CONTEXT.md` yet, no `docs/adr/` yet, no tracker policy yet, no `docs/agents/issue-tracker.md`.
Create each only when the decision it records has actually been made.

If `templates/` and the live file disagree, the live file wins. The `templates/` directory stays
as generic starters for a fresh repository; do not copy them over existing content.

## Completion criterion

Every approved project-context file exists; the repository instruction block is unique; all references resolve; surrounding content is preserved; rerun output is idempotent; and the capability report names every missing companion without installing it.

## Stop conditions

Stop before writing when approval is absent, when a proposed edit would overwrite unowned content, when instruction-file choice is unresolved, or when repository evidence cannot support a non-empty document. Stop rather than invent decisions or command results.

## Next recommended skill

Run `grilling` to stress-test the selected work item, or `writing-plans` when the work item is already well specified.
