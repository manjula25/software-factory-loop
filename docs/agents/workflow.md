# Workflow

Base branch, worktree policy, and repository commands for agents working in `test-harness`.

## Base branch

`main`. Never implement directly on it.

## Worktree policy

One worktree per work item, created under `.claude/worktrees/` named for its branch, per the
`using-git-worktrees` skill. Two caveats specific to this machine and project:

- Worktrees share this repo's `.git` object store — another agent can commit into a worktree you
  are using; check author trailers before trusting commits as yours.
- Worktrees share the local Docker daemon: two worktrees building the same sandbox image collide.
  Image builds are coordinated by the controller, not per-leaf.

## Repository commands

| Surface | Commands |
|---|---|
| Harness source (`src/`, TypeScript) | *(none yet — no scaffold)* |
| Pipeline integration (local Docker) | *(none yet — no scaffold)* |

Where a surface reads *(none yet)*, it is not scaffolded: any claim about it is a stated
**non-claim**, not a pass, and no command may be invented for it. When the scaffold lands
(`sandcastle init`, vitest), the real commands replace this table through a PR, like everything
else.

## Review topology

Specification review before code-quality review, both read-only, both rerun when the candidate
changes — see the `implement` skill.
