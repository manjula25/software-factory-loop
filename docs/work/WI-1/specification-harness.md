# Testable Specification — WI-1a: Harness Scaffold

## Status

Approved — 2026-09-11, owner.

## Source artifacts

- Issue #1 (`[WI-1] Scaffold harness and prove one bug fixed end-to-end`)
- `harness-prd-v2.md` — Solution, Implementation Decisions, Decisions from Grilling (2026-09-11) items 1–5, 7
- `docs/agents/workflow.md` — Secrets, Commit identity

## Functional requirements

### FR-001: Sandcastle scaffold, pinned, behind an adapter

- **Behavior:** `sandcastle init` output is committed; the exact Sandcastle version is locked in the lockfile; every call into Sandcastle (`run`, sandbox creation, merge-back, structured output) is routed through one adapter module, and no file outside that module imports `@ai-hero/sandcastle` directly.
- **Source traceability:** PRD Implementation Decisions (Base framework); Grilling decision 1.
- **Sub-step coverage:** WI-1 checklist items 1–2.
- **Success criteria:** a grep for `@ai-hero/sandcastle` across `src/` matches only files inside the adapter module; `npm ci` installs the pinned version deterministically.
- **Evidence label:** harness source (`src/`, vitest).
- **Boundary and errors:** the adapter surface is the four named primitives only — anything else Sandcastle offers is used nowhere in WI-1. Adapter functions throw on provider misconfiguration rather than defaulting silently.
- **Non-claims:** no claim that the adapter is a general abstraction for other frameworks; it is a seam, not a library.

### FR-002: Provider registry as configuration

- **Behavior:** the fix agent is selected from a configuration registry with three entries — `claude-via-proxy` (Claude Code CLI through CLIProxyAPI, primary), `codex-direct` (Sandcastle's `codex` agent, direct API key), `opencode` (alternate). No provider name is hard-coded in pipeline code; switching the entry changes the agent used by a run.
- **Source traceability:** PRD User Story 12, Implementation Decisions (swappable provider); Grilling decisions 3–4.
- **Sub-step coverage:** WI-1 checklist item 3.
- **Success criteria:** a vitest case runs the provider-selection unit against at least two registry entries with a stubbed agent and verifies the selected agent differs; configuration names an unknown provider → explicit configuration error naming the registry entries.
- **Evidence label:** harness source (`src/`, vitest).
- **Boundary and errors:** registry entries carry their CLI, env-var names, and proxy URL where applicable; a missing env var for the selected provider is a configuration error before any sandbox starts, not a runtime failure mid-run.
- **Non-claims:** no claim of quality parity between providers; cheap-by-default is a cost decision (Grilling 3), and the strong-model re-run rule is a standing operational rule, not code.

### FR-003: Secrets reach the sandbox only as environment variables

- **Behavior:** credentials are read from an untracked `.env` at the repo root and injected into sandbox containers via the Docker provider's env configuration. No secret value appears in any prompt text, PR body, run report, or log line the harness writes. `.env` is git-ignored.
- **Source traceability:** PRD Implementation Decisions (Data handling); Grilling decision 5; `docs/agents/workflow.md` Secrets.
- **Sub-step coverage:** WI-1 checklist item 4.
- **Success criteria:** a vitest case asserts `assertNoSecrets` rejects any string containing a substring of a configured secret value (sentinel dummies), and the loop (FR-005 machinery) applies it to every string it emits — prompt and PR body; `git status` is clean with a populated `.env` present; `.gitignore` contains `.env`.
- **Evidence label:** harness source (`src/`, vitest).
- **Boundary and errors:** a missing `.env` or a missing key for the selected provider aborts the run at startup with a named-variable message; it never proceeds with an empty credential.
- **Non-claims:** no claim of protection against a malicious fix agent exfiltrating values at runtime — the sandbox is trusted code execution; the rule covers what *the harness itself* writes.

### FR-004: Sandbox image carries the agent CLIs and target runtime

- **Behavior:** the scaffolded `.sandcastle/Dockerfile` is extended so one image contains the three agent CLIs (Claude Code, Codex, OpenCode) and the Python runtime with pytest; `sandcastle docker build-image` produces it locally.
- **Source traceability:** PRD Implementation Decisions (Sandbox/execution environment; Target project language); Grilling decision 4.
- **Sub-step coverage:** WI-1 checklist items 3–5.
- **Success criteria:** the built image passes a smoke check run in CI-equivalent fashion locally: `python --version`, `pytest --version`, and each agent CLI's `--version` all succeed inside the container.
- **Evidence label:** pipeline integration (local Docker).
- **Boundary and errors:** image build failure is a setup error with the build log preserved; no fallback to a cloud or host-executed agent path exists in WI-1.
- **Non-claims:** no claim about image size optimization or multi-arch builds; no language runtime beyond Python is included.

### FR-005: Agent commit identity and PR authorship

- **Behavior:** commits made inside a sandbox in the target repo are authored `software-factory-loop <manjula25+loop@users.noreply.github.com>`; PRs are opened through the owner's `manjula25` GitHub authentication; PR bodies reference the work item/issue id and contain no GitHub closing keywords.
- **Source traceability:** Grilling decision 7; `docs/agents/workflow.md` Commit identity.
- **Sub-step coverage:** WI-1 checklist item 7 (PR step).
- **Success criteria:** in the WI-1 end-to-end run, the opened PR's commits show the configured author; the PR is open (not merged) at gate time.
- **Evidence label:** pipeline integration (local Docker, PR on loop-fixtures-py).
- **Boundary and errors:** missing `gh` authentication aborts the PR step with the auth hint; nothing auto-merges under any code path (constraint 1).
- **Non-claims:** no dedicated bot account (deferred endgame per Grilling 7).

## Non-functional constraints

- Local Docker only (PRD constraint 6). No cloud sandbox provider is configured.
- TypeScript; vitest for harness-source tests at public seams, per `tdd/SKILL.md`.

## Clarifications

None.

## Traceability matrix

| FR | WI-1 checklist item | PRD section |
|---|---|---|
| FR-001 | 1–2 | Implementation Decisions (Base framework); Grilling 1 |
| FR-002 | 3 | User Story 12; Grilling 3–4 |
| FR-003 | 4 | Implementation Decisions (Data handling); Grilling 5 |
| FR-004 | 3–5 | Implementation Decisions (Sandbox; Target language); Grilling 4 |
| FR-005 | 7 | Grilling 7 |

## Approval

- [x] Approved by owner — 2026-09-11
