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
| Pipeline integration (local Docker) | `npm run build:image` (Sandcastle-built `sandcastle-loop`), `npm run smoke:image` (9 checks), `npm run loop -- --repo <dir> --provider <name> [--model <m>] [--issue <n>] [--label <label>] [--max-issues <n>] [--spec-doc <path> | --plain-list <path>]` — queue mode is the default: when more than one issue is eligible, one bounded planner pass orders the queue by priority and `blockedBy` edges and independent fixes run in concurrent waves (a failed or unusable plan degrades loudly to a deterministic order — never costs the queue its issues; `--triage` is retired and fails at startup with exactly `--triage was removed — the dependency-aware planner now always runs when more than one issue is eligible`); `--max-issues <n>` is an optional ceiling on the issues attempted — absent it, every unblocked issue the plan surfaced runs, so the surviving guarantee is no spend beyond what the plan surfaced at run start; `--issue <n>` is the single-issue override (no planner, no ceiling, dedup still applies); a source flag (`--spec-doc` / `--plain-list`) replaces GitHub issue acquisition entirely — the queue comes from the parsed file, dedup, the planner and the ceiling still apply, and the run summary names the source — and cannot be combined with the other source flag, with `--issue`, or with `--label` (all rejected as startup errors); on profiles with `autoMerge: true` (set only by `--auto-merge` at onboarding), verified PRs are squash-merged automatically after a pre-merge diff-review pass, with a post-merge canary suite on main and auto-revert on red (CLAUDE.md constraint 1) — and when a fix branch would conflict with current main, a bounded merger pass resolves the conflict and the resolved branch is re-verified in a fresh sandbox BEFORE the pre-merge review; a failed merger or red re-verification leaves the PR open with the failure recorded and the queue continues; and a run escalates its no-visible-artifact failures (repro, verification, preflight/sandbox) on gh-sourced issues — an inline `@<notifyHandle>` comment when a handle is configured plus a `harness-failed` label, both best-effort with any failure recorded in the run summary and the label cleared on every verified-PR-delivered outcome |
| Integration tests (`tests/integration/`, local Docker + `gh`) | `npm run test:integration` (vitest, isolated config; needs the fixture repo `manjula25/loop-integration-fixture`, provisioned once per `docs/work/WI-16/implementation-plan.md` T1.3), `npm run build:image:test` (plain-docker `sandcastle-loop-test`: the production image plus a scripted `claude` entry point — `.sandcastle/Dockerfile.test`) |
| Scenarios (`tests/scenarios/`, local Docker + `gh` + the fixture repo) | `npm run test:scenarios` (vitest, isolated config `vitest.scenarios.config.ts`; each scenario opens with a precondition check and holds the fixture guard `loop-integration-fixture.guard`; the machinery — `SEED_COMMIT`, the reset, the guard, the empty-queue label — lives in `tests/scenarios/fixture-reset.ts`) |

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
