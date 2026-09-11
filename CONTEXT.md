# Project Context

## Purpose

Prove that a known issue can become a verified, human-reviewed fix without a human doing the
repetitive parts: an automated loop that reads an issue (with its log), writes a failing
regression test, fixes the code in an isolated sandbox, re-verifies independently, and opens a
PR. The harness never discovers issues and never merges — humans report, humans merge.

## Actors

- **Developer** — supplies the issue queue, reviews and merges PRs, owns the budget cap.
- **Harness (this project)** — normalizes issues, orchestrates fix agents, verifies, opens PRs.
- **Fix agent** — the in-sandbox coding agent (Claude Code CLI via Sandcastle); never trusted
  for its own completion signal.
- **Human reviewer** — the merge gate; the only path into `main` of a target repo.

## Glossary

- **Issue queue** — known issues from GitHub Issues, a spec doc, or a plain list, normalized to
  `{ id, description, attachedLog?, sourceType }`.
- **Sandbox** — a Docker container from the project-profiled image where an agent works on one
  issue; local only for the POC.
- **Worktree** — one git worktree per issue (`fix/<issue-id>`) in the *target* repo; per work
  item (`WI-<n>`) in *this* repo.
- **Project profile** — onboarded-once facts (language, install/test commands) validated by
  execution, committed to the target repo.
- **Verification** — reproduction test AND full suite re-run in a fresh sandbox; the only
  evidence a fix counts.

## Workflows

Issue queue → triage/budget cap → dedup (skip issues with open PRs) → dependency grouping →
per issue: reproduce (failing test) → fix → fresh-sandbox verify → diff review → PR → human
merge. Regression tests stay in the target repo's suite.

## Invariants

The hard constraints in `CLAUDE.md`: never auto-merge; never trust the agent's completion
signal; confidentiality gate on client data; reproduction tests retained; budget cap; local
Docker only for the POC.

## External boundaries

- Bitcot policy on client data in third-party AI APIs — gate for any client repo/log; unconfirmed.
- Sandcastle (`@ai-hero/sandcastle`) upstream — the harness builds on it, configured near its
  `parallel-planner-with-review` template, not rewritten around it.
- Model/agent provider — a registry, not a single choice: Claude Code CLI via the local
  CLIProxyAPI proxy (primary), Sandcastle's `codex` agent with a direct API key, and `opencode`
  as alternates. Cheap models by default; standing rule: any inexplicable failure is re-run
  once with a strong model before the architecture is blamed.

## Unresolved domain questions

- Dependency-grouping heuristic accuracy (over- vs under-grouping) — revisit with real data.
- Issue-tracker write authority: comments/labels stay read-only-by-default until exercised once.
