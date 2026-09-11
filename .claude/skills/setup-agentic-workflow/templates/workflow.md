# Agent Workflow Configuration

## Work artifact path

`docs/work/{WORK_ITEM_ID}/`

## Base branch

<!-- Repository-configured protected base branch. -->

## Branch patterns

<!-- Patterns derived from work-item identity. -->

## Repository commands

- Install:
- Focused test:
- Full test:
- Lint:
- Format:
- Type check:
- Build:
- Runtime smoke:

Remove commands that do not apply; do not leave unsupported commands as facts.

## Worktree policy

<!-- When isolation is required and where worktrees are created. -->

## Review topology

Top-level controller → one implementer → specification reviewer → code-quality reviewer. Children are non-recursive leaves.

## Shortened-flow rules

Record why any phase is skipped and prove the next phase still has its required inputs.
