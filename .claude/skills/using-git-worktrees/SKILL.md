---
name: using-git-worktrees
description: Use when implementation needs an isolated branch and worktree with a verified repository baseline.
---

# Using Git Worktrees

## Required inputs

The user-selected work item and target repository.

## Project context — read before acting in this repository

- **Shared `.git` object store.** All worktrees share one object store. Another agent or tool
  (e.g. Devin) can commit directly into a worktree you are actively using with no signal other
  than `git log` changing underneath you. Before trusting that uncommitted changes or new
  commits in a worktree are yours, check author/co-author trailers and timestamps.
- **Never `git stash` to tidy in a shared worktree** before your own commit — it can sweep up
  another agent's live in-progress edits. Extract only the relevant files' diffs by hand.
- **Repository boundary.** Three separate git repos sit on this machine: this one
  (`/Users/manju/Documents/test-harness`), the unrelated Port.io POC
  (`/Users/manju/Documents/port-poc` — reference only, never a command target from here), and
  the home directory `/Users/manju`, which is itself an unrelated repo. Never run repo-wide
  git commands (`git add -A`, `git status` without a path, `git commit -a`) from `/Users/manju` —
  they operate on the home repo. Scope every git command to the folder you mean.
- **Shared Docker state is not isolated by a worktree.** A worktree isolates the branch and the
  files. It does not isolate the local Docker daemon or its images — two worktrees building the
  same sandbox image or running the same container name still collide. Coordinate image builds
  through the controller. See `docs/agents/workflow.md` for the worktree policy.

## Optional inputs

Existing ticket branch, location preference, and commands configured in `docs/agents/workflow.md`.

## Required companion skills

None.

## Output

An isolated worktree on the intended branch, with repository status clean or intentionally documented and fresh baseline command outputs recorded. Also return exact cleanup instructions without executing cleanup automatically.

## Process

1. Verify repository identity, current branch, configured base branch, HEAD, remotes, dirty state, and existing worktrees before action. Read the base branch, branch pattern, worktree policy, and baseline commands from `docs/agents/workflow.md`.
2. Refuse direct implementation on protected base branches. Do not create an implementation branch until the user-selected work item is known.
3. If the ticket branch exists, verify whether it is already checked out and reuse its existing worktree rather than duplicating it.
4. For a new branch, derive the configured name from the work item, confirm the intended base, then create one isolated worktree.
5. If the branch is checked out elsewhere, report that exact worktree and ask whether to use it; never force-move it.
6. If the root checkout is dirty, preserve and report its state. Never reset, stash, clean, overwrite, or delete another worktree's changes.
7. Run configured baseline commands inside the isolated worktree and record commands, full outputs, exit statuses, candidate identity, and evidence boundary.
8. A failing baseline blocks implementation unless the user explicitly chooses a documented investigation path.
9. Return exact, conditional cleanup instructions for later use; do not execute branch or worktree cleanup automatically.

## Completion criterion

The isolated worktree exists on the intended branch, repository state is clean or intentionally documented, and configured baseline command outputs are fresh and recorded.

## Stop conditions

Stop on an unknown work item, protected-base implementation attempt, ambiguous repository, conflicting existing worktree, unsafe dirty state, branch-name collision, or failing baseline.

## Next recommended skill

Return the verified workspace and baseline to the plan task that invoked this, then proceed with `tdd` for the behavior change.
