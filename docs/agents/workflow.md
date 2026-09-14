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
| Harness source (`src/`, TypeScript) | `npm run typecheck` (exit 0), `npm test` (vitest) |
| Pipeline integration (local Docker) | `npm run build:image` (Sandcastle-built `sandcastle-loop`), `npm run smoke:image` (9 checks), `npm run loop -- --repo <dir> --issue <n> --provider <name> [--model <m>]` |

Where a surface reads *(none yet)*, it is not scaffolded: any claim about it is a stated
**non-claim**, not a pass, and no command may be invented for it. When the scaffold lands
(`sandcastle init`, vitest), the real commands replace this table through a PR, like everything
else.

## Secrets

API credentials reach the sandbox as environment variables injected by the Docker provider,
sourced from an untracked `.env` at the repo root (never committed). Hard rule: environment
values are never echoed in prompts, PR bodies, or any log the harness writes — the agent gets
its key implicitly via the environment, never as prompt text.

## Commit identity (sandbox work in target repos)

Commits made by the fix agent in a target repo are authored
`software-factory-loop <manjula25+loop@users.noreply.github.com>`; PRs open via the owner's
`manjula25` GitHub auth. Machine-made commits stay distinguishable from human ones.

## Review topology

Specification review before code-quality review, both read-only, both rerun when the candidate
changes — see the `implement` skill.
