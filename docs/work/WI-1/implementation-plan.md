# Implementation Plan — WI-1

Source: approved `specification-harness.md` (FR-001..005) and `specification-fixtures.md`
(FR-101..104). Every task names its surface, exact files, exact commands, expected results,
RED/GREEN evidence where behavior changes, and its exact commit message. No placeholders.

Seams per `tdd/SKILL.md`: **harness source** (`src/`, vitest at the module's public seam) and
**pipeline integration** (actually running the flow against `loop-fixtures-py` in Docker).

Setup note: `npx sandcastle init` (T2) is interactive — a manual step with the answers spelled
out. Everything else is scriptable.

---

## T1 — Node scaffold *(harness source)*

**Files:** `package.json` (private, `"type": "module"`, scripts: `test` = `vitest run`,
`typecheck` = `tsc --noEmit`), `tsconfig.json` (strict, ES2022, NodeNext), `vitest.config.ts`
(`passWithNoTests: true`).

**Commands / expected:** `node --version` → ≥ 20. `npm install -D typescript vitest tsx
@types/node` → exit 0. `npm run typecheck` → exit 0. `npm test` → exit 0, "no tests found".

**Then:** update `docs/agents/workflow.md` Repository commands — `src/` row becomes
`npm run typecheck` + `npm test`.

**Commit:** `chore(WI-1): node + typescript + vitest scaffold`

## T2 — Sandcastle pinned, adapter boundary *(harness source)*

**Commands:** `npm install --save-exact @ai-hero/sandcastle@0.12.0` → exit 0; `npm ls
@ai-hero/sandcastle` → `0.12.0 exact`. Manual: `npx sandcastle init` — answer issue tracker =
**custom** (scaffolds broken-until-configured files + `SETUP_ISSUE_TRACKER.md`; leave broken,
our ingestion is `src/issues.ts`, not a tracker integration).

**RED:** `src/sandcastle-adapter.boundary.test.ts` — scans `src/**/*.ts` for imports of
`@ai-hero/sandcastle`; expects matches **only** in `src/sandcastle-adapter.ts`. Run before the
adapter exists → fails.

**GREEN:** `src/sandcastle-adapter.ts` — exports `runFixRun`, `createFixSandbox`, `mergeBack`
as typed thin wrappers; the only file importing the package. (A `structuredOutput` wrapper is
added in WI-2 when structured extraction gains its first caller.)
`npm test` → green. `grep -rl '@ai-hero/sandcastle' src | grep -v sandcastle-adapter` → no
output.

**Commit:** `feat(WI-1): pin sandcastle 0.12.0 behind adapter boundary`

## T3 — Provider registry *(harness source)* — FR-002

**RED:** `src/providers.test.ts` — (a) resolving two stubbed registry entries yields different
agents; (b) unknown provider name throws listing the registry entries; (c) selected provider
with a missing env var throws naming the variable — all before implementation.

**GREEN:** `src/providers.ts` — registry entries `claude-via-proxy` (CLI: Claude Code via
`CLI_PROXY_API_URL`), `codex-direct` (CLI: codex via `CODEX_API_KEY`), `opencode` (CLI: opencode
via `OPENCODE_API_KEY`); `resolveProvider(name, env)` validates at startup, never mid-run.

**Commit:** `feat(WI-1): provider registry with startup validation`

## T4 — Secrets leak guard *(harness source)* — FR-003

**Files:** `src/env.ts` (loads `.env` from repo root; aborts if the selected provider's vars
are absent), `.env.example` (names only, committed), `src/assert-no-secrets.ts`
(`assertNoSecrets(strings, env)` — throws naming the string if any contains a substring of any
secret value).

**RED:** `src/assert-no-secrets.test.ts` — sentinel dummy secrets: strings containing them
throw; clean strings pass. `git check-ignore .env` → exit 0 (add `.env` to `.gitignore`).

**GREEN:** implement; `npm test` green. (Applied by T10's loop to every string it emits —
prompt and PR body. The run report itself is queue-scale output, WI-2.)

**Commit:** `feat(WI-1): env loader and secrets leak guard`

## T5 — Issue normalization *(harness source)* — PRD's new component, WI-1 slice

**RED:** `src/issues.test.ts` — a fetched GitHub issue normalizes to the internal
`{ id, description, attachedLog?, sourceType }` shape (PRD Testing Decision #1; the spec-doc
and plain-list normalizers land in WI-2 beside queue ingestion, before any multi-source run).

**GREEN:** `src/issues.ts` — `NormalizedIssue` type + `normalizeGitHubIssue`.

**Commit:** `feat(WI-1): issue normalization to internal shape`

## T6 — Baseline-diff verification *(harness source)* — FR-104 logic, Grilling 6

**RED:** `src/verify.test.ts` — recorded pytest outputs: (a) post-fix run whose only failures
are in the baseline → gate passes; (b) one new failure → gate fails naming it; (c) reproduction
test not passing → gate fails regardless of baseline.

**GREEN:** `src/verify.ts` — parse pytest output into failing-test names;
`diffVerification({baselineFailures, postFixFailures, reproTestPassed})` → gate result.

**Commit:** `feat(WI-1): baseline-diff verification gate`

## T7 — Sandbox image *(pipeline integration)* — FR-004

**Files:** extend `.sandcastle/Dockerfile` — base `python:3.12-slim` + Node 22 + git + `gh` +
Claude Code, Codex, OpenCode CLIs + non-root agent user. `scripts/smoke-image.sh` — runs
`python --version`, `pytest --version`, each CLI's `--version` in the built container.

**Commands / expected:** `npx sandcastle docker build-image` → exit 0.
`./scripts/smoke-image.sh` → all versions print, exit 0.

**Commit:** `feat(WI-1): sandbox image with python + three agent CLIs`

## T8 — Seed `loop-fixtures-py` *(pipeline integration + document)* — FR-101, FR-102

**Files (new repo `manjula25/loop-fixtures-py`):** `pyproject.toml`, `src/loopfix/textops.py`
(houses BUG-1: wrong offset in a pure function; BUG-3: different defective function, same
module), `src/loopfix/dates.py` (BUG-2: crash with stack trace on valid input),
`tests/` (green tests + one failing test per bug), `README.md`.

**Commands / expected:** `gh repo create manjula25/loop-fixtures-py --public` → exit 0; push;
clean clone: `pip install -e . && pytest` → exit 1 with **exactly 3 failures** (the seeded
tests), nothing else, offline. File issues #1–#3 via `gh issue create`, symptom-first, no cause
revealed: #1 text only; #2 with the stack trace attached as a raw log file; #3 text only. All
three remain open and dormant.

**Spot-check (human):** each bug reproducible from its issue text alone without reading source.

**Commit (fixtures repo):** `seed: loop-fixtures-py with three staged defects`

## T9 — Onboarding pass + project profile *(pipeline integration)* — FR-104

**Run:** the onboarding flow via the adapter against `loop-fixtures-py`: docs as hints; execute
install + suite; write `.loop-harness/profile.json` — `language`, `installCmd`, `testCmd`,
`singleTestCmd`, `baselineFailures` (the 3 seeded test names), `expectedDurationSec`. Commit to
the fixtures repo; human reviews once.

**Expected:** profile's `baselineFailures` matches a fresh `pytest` run exactly (run both,
diff).

**Commit (fixtures repo):** `chore: harness project profile (onboarded)`

## T10 — Single-issue loop + PR *(harness source)* — FR-005, FR-103 machinery

**RED:** `src/loop.test.ts` — stubbed adapter + agent: (a) fix fails verification → no `gh pr
create` call, failure recorded; (b) fix passes → `gh pr create` called with a body containing
verbatim RED output, GREEN output, symptom-mapping line, and no closing keywords; (c) every
string the loop emits (prompt, PR body) passes `assertNoSecrets`; (d) commits carry the
`software-factory-loop <manjula25+loop@users.noreply.github.com>` identity.

**GREEN:** `src/loop.ts` — `runSingleIssue(issue, providerName, profile)` plus the inlined
`buildFixPrompt` and `buildPrBody`: worktree `fix/<issue-id>`, fix prompt = issue + inlined log
excerpt + profile's pinned commands; then **fresh-sandbox** re-run of repro test + suite; gate
via `src/verify.ts`; on pass open PR. Add package.json script `loop` = `tsx src/loop.ts`.

**Commit:** `feat(WI-1): single-issue loop with fresh-sandbox verification`

## T11 — End-to-end run + gate evidence *(pipeline integration)* — FR-103

**Command:** `npm run loop -- --repo manjula25/loop-fixtures-py --issue 1 --provider
claude-via-proxy`

**Expected (the WI-1 gate):** PR open on `loop-fixtures-py` — body contains verbatim RED
output, GREEN output, symptom-mapping line; commits authored
`software-factory-loop <…+loop@users.noreply.github.com>`; diff contains the fix **and** the
reproduction test under `tests/fixed-issues/`; issues #2 and #3 untouched; PR not merged.
Any verification failure → no PR, failure recorded (a valid machinery diagnosis, not a gate
pass).

**Then:** record evidence under `docs/work/WI-1/`; update `docs/agents/workflow.md` Repository
commands with the real commands (`npm run loop …`).

**Commit:** `docs(WI-1): end-to-end run evidence`

---

## Sequencing and rollback

T1 → T2 → T3/T4/T5/T6 (independent of each other, any order) → T7 → T8 → T9 → T10 → T11.
T8 can start any time after T1 (independent repo). Every task is one commit — rollback is
`git revert`. External state: the Docker image (rebuildable) and the fixtures GitHub repo
(deletable; WI-1 touches nothing else). On any inexplicable agent failure, the standing rule
applies: one re-run with `--provider` pointed at a strong model before blaming the pipeline.
