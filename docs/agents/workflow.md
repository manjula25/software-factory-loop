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
| Pipeline integration (local Docker) | `npm run build:image` (Sandcastle-built `sandcastle-loop`), `npm run smoke:image` (9 checks), `npm run loop -- --repo <dir> --provider <name> [--model <m>] [--issue <n>] [--label <label>] [--max-issues <n>] [--triage] [--spec-doc <path> | --plain-list <path>]` — queue mode is the default (caps at 3 issues per run); `--issue <n>` is the single-issue override (no cap, no triage, dedup still applies); `--triage` spends one bounded scoring pass per run whenever more than one issue is eligible, and degrades loudly to ascending issue number if that pass fails or returns unusable output; a source flag (`--spec-doc` / `--plain-list`) replaces GitHub issue acquisition entirely — the queue comes from the parsed file, dedup and the cap still apply, and the run summary names the source — and cannot be combined with the other source flag, with `--issue`, or with `--label` (all rejected as startup errors); on profiles with `autoMerge: true` (set only by `--auto-merge` at onboarding), verified PRs are squash-merged automatically after a pre-merge diff-review pass, with a post-merge canary suite on main and auto-revert on red (CLAUDE.md constraint 1) |

Both surfaces are scaffolded; there is no lint surface, and no command may be invented for one.
Where a surface reads *(none yet)*, it is not scaffolded: any claim about it is a stated
**non-claim**, not a pass. This table is the authoritative command list — it changes through a
PR, like everything else.

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
