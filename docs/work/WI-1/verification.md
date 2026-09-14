# Verification Record — WI-1

## Claim

The WI-1 harness implementation (branch `worktree-wi-1`, HEAD `83a1bb2`) satisfies every FR in
`specification-harness.md` (FR-001…005) and `specification-fixtures.md` (FR-101…104), and the
end-to-end gate of FR-103 is met: loop runs on `loop-fixtures-py` produced open, unmerged PRs
carrying verbatim RED/GREEN evidence, symptom mapping, the machine commit identity, and retained
reproduction tests.

## Proving commands (all run fresh 2026-09-14 against `83a1bb2`)

### Candidate identity

```
$ git rev-parse HEAD
83a1bb27c14e5bd6cdd7a885674f6069ce51df84
$ git status --porcelain
(empty — clean)
```

### FR-001 — pinned Sandcastle behind the adapter

```
$ grep '@ai-hero/sandcastle' package-lock.json → "0.12.0" (exact pin)
$ npm ci   → exit 0, found 0 vulnerabilities
$ grep -rln "@ai-hero/sandcastle" src/
src/sandcastle-adapter.ts            (the adapter — 2 imports)
src/sandcastle-adapter.boundary.test.ts   (enforcement test; imports nothing)
```

**Boundary note:** FR-001's success criterion says a grep matches "only files inside the adapter
module." The boundary test file contains the package *string* (it must, to enforce the rule) but
performs no import — it greps other files for import patterns. No functional dependency outside
the adapter. Recorded as a literal-wording deviation, not a boundary breach.

### FR-002 — provider registry

Covered by `src/providers.test.ts` (registry resolution, two entries differ, unknown name lists
the registry, missing env var named at startup). Fresh run: `npm test` → 32/32 passed (below).
Runtime proof: all three e2e runs resolved `claude-via-proxy` and injected
`ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN` as env (the agent reached the proxy; no secret ever
appeared in any prompt/PR/log — see FR-003).

### FR-003 — secrets as env only

Covered by `src/assert-no-secrets.test.ts` + the loop tests that apply the guard to prompt,
evidence blocks, PR title and body (sentinel-based). Environmental checks, fresh:

```
$ git check-ignore .env → ".env" (ignored)
$ git status --porcelain → clean with a populated .env present
```

Locked-in limitation (documented in the module): whole-value matching only; a *fragment* of a
secret value would pass. Guard scope is `.env` values (`readEnvFile`), not the full process env
(see commit `749f1b5` — npm-injected `npm_package_name` collided with the loop identity).

### FR-004 — image carries CLIs + runtime

```
$ bash scripts/smoke-image.sh → exit 0, 9/9 ok:
  python 3.12.x, pytest 8.x, node 22.x, git 2.47.3, gh 2.100.0,
  claude 2.1.270, codex-cli 0.154.0, opencode 1.18.30, non-root agent user
```

Built with `npm run build:image` (→ `sandcastle docker build-image --image-name sandcastle-loop`,
the wired one-command path — re-run fresh after wiring: exit 0, image `dbce76b7216c`, smoke 9/9).
Operational lesson: a plain `docker build` skips the AGENT_UID/GID args and produces an image whose
container user cannot touch the bind-mounted worktree (attempt-5 failure). The npm script is the
only supported build path; plain `docker build` is not used anywhere.

### FR-005 — identity and PR authorship

Fresh external check (2026-09-14), all three PRs:

```
$ gh pr list --state all → #4 OPEN, #5 OPEN, #6 OPEN, mergedAt: null (nothing merged)
$ gh pr view 4/5/6 --json commits → authors include "software-factory-loop"
```

PR titles `[loop] fix gh-N: …`; bodies contain no closing keywords (grep = 0 matches; verified on
all three).

### FR-101/102/104 — fixtures repo, seeded bugs, baseline

Durable references: `manjula25/loop-fixtures-py` on GitHub; issues #1–#3 all OPEN (fresh check
above); `.loop-harness/profile.json` committed on `main` (before any fix run). Baseline (3 node
ids) matched a fresh-clone suite run at onboarding (T9 cross-check) and was exercised as the diff
base in all three e2e verifications below — the born-red gate held on every run.

### FR-103 — end-to-end gate (the exit criterion)

Three complete runs (one issue per run — the WI-1 cap), 2026-09-14, provider `claude-via-proxy`
(model glm-5.2 via the aliyun proxy):

| Run | PR | Files | Evidence |
|---|---|---|---|
| gh-1 | [#4](https://github.com/manjula25/loop-fixtures-py/pull/4) | `src/loopfix/textops.py`, `tests/fixed-issues/test_gh_1.py` | verbatim RED/GREEN, symptom-mapping line, fresh-sandbox diff vs baseline: no new failures |
| gh-2 | [#5](https://github.com/manjula25/loop-fixtures-py/pull/5) | `src/loopfix/dates.py`, `tests/fixed-issues/test_gh_2.py` | same, gate held with #1/#3 symptoms still failing on that branch |
| gh-3 | [#6](https://github.com/manjula25/loop-fixtures-py/pull/6) | `src/loopfix/textops.py`, `tests/fixed-issues/test_gh_3.py` | same |

FR-103's literal criterion is BUG-1 only, with #2/#3 "untouched" — satisfied by the gh-1 run; the
gh-2/gh-3 runs were separately requested by the owner as additional evidence, each its own capped
single-issue run. Normalizer inspection (`scripts/inspect-issue.ts`, fresh): all three real issue
bodies yield `attachedLog` PRESENT (inline REPL blocks); issue #3's separate web-UI file upload
(URL) is deliberately not fetched — WI-2 scope per the spec clarification.

**RED truthfulness (owner-requested extra check, 2026-09-14):** fresh clone of `main`, the three
PRs' repro tests staged on it, run in one sandcastle-loop container (`scripts/red-check.ts`):

```
FAILED tests/fixed-issues/test_gh_1.py::test_slugify_keeps_first_character
FAILED tests/fixed-issues/test_gh_1.py::test_slugify_keeps_first_character_simple_phrase
FAILED tests/fixed-issues/test_gh_2.py::test_parse_iso8601_utc_z_suffix
FAILED tests/fixed-issues/test_gh_3.py::test_titlecase_not_all_caps
FAILED tests/fixed-issues/test_gh_3.py::test_titlecase_preserves_inner_casing
5 failed in 0.37s  (exit 1 — every repro test genuinely fails on unfixed main)
```

All three PR bodies carry all four evidence sections (RED verbatim, GREEN verbatim, symptom
mapping, independent-verification line); source diffs are one focused fix each (gh-1 drops the
`[1:]` slice; gh-2 strips a trailing `Z` and sets `tzinfo=utc`; gh-3 title-cases per word
preserving inner casing, exactly the issue's `pyTest suite` → `PyTest Suite` expectation).

Machinery defects found and fixed during the runs (each TDD, committed):

- `61b8478` gh CLI JSON field is `url` not `html_url`
- `749f1b5` secrets guard scope = `.env` values
- `5f273c5` container CLI pinned 2.1.270; provider model glm-5.2 (glm-5.3 now 400s on the proxy)
- `21fc3af` fresh verification sandbox must run `installCmd` before testing (attempt-5 false gate
  rejection — every file errored at collection and read as new failures)

### Harness suite + types

```
$ npm test → Test Files 7 passed (7), Tests 32 passed (32), exit 0
$ npx tsc --noEmit → exit 0
```

## Post-verification hardening (owner-requested, before code review)

Five small issues were fixed after the e2e runs above (owner reviewed the list and approved):
unreadable-suite gate refusal, failed-run branch cleanup, `--model` CLI override, agent env hardening
(`CLAUDE_CODE_MAX_CONTEXT_TOKENS`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` — probe-verified to
kill the background session-title call; one benign startup catalog notice remains and cannot be
silenced), and the FR-104 baseline-staleness preflight (runs before agent spend; component-checked
against the real repo in docker: `scripts/preflight-check.ts` → MATCH, branch deleted).

**Evidence boundary:** the three PR-evidence e2e runs were produced by the pre-hardening loop;
unit evidence for the hardened loop is fresh (38/38) but no full e2e run has yet used it (all
three issues already have open PRs; a re-run needs quota and branch/PR cleanup or a new seeded
issue). Recommend one confirming e2e at WI-2 kickoff.

**Boundary closed 2026-09-14 (owner direction):** gh-1 was re-run end-to-end through the hardened
loop (PR #4 closed as superseded, branch deleted). Fresh evidence:
[PR #7](https://github.com/manjula25/loop-fixtures-py/pull/7) — preflight baseline check ran
before agent spend, the throwaway `loop/preflight-gh-1` branch was auto-deleted (no leftovers),
fix branch pushed and PR opened with all four evidence sections (RED/GREEN verbatim, symptom
mapping, independent verification) and the FR-005 author identity. The flagship flow is now
proven in its final form.

## Unknowns — closed or deferred

- **Closed:** container agent could run against the proxy (probe: glm-5.2 → `OK`, exit 0).
- **Closed:** "unrecognized_model" is benign catalog advice (appears on 2.1.270 too), not a
  rejection; the real blockers were quota exhaustion and the glm-5.3 400.
- **Deferred (WI-2):** fetching `user-attachments` URLs in the normalizer; queue ingestion; spec-doc
  and plain-list sources; structured output/report; demo format.
- **Deferred (design):** fragment-only secret matching — documented limitation of whole-value
  matching.

## Remaining risks

- **Proxy model availability can change under us** (glm-5.3 worked on 09-13, 400s on 09-14). The
  model is one line in `providers.ts`; a quota/plan wall mid-run fails the run loudly (observed as
  a clean error, no silent behavior).
- **Quota is a real budget** — the weekly token-plan quota exhausted once already; three e2e agent
  runs consumed part of the current window.
- **Image rebuilds** must use `npx sandcastle docker build-image`; a plain `docker build` produces
  a UID-mismatched image that fails at `safe.directory` (noted under FR-004).

## Explicit non-claims

- The fixes are not claimed *correct* in the human sense — every PR awaits human review (constraint
  1). The gate proves the loop completed with honest evidence, nothing more.
- No parallel processing, dedup, priority triage, or multi-issue queue behavior is exercised —
  WI-2+.
- No protection against a malicious fix agent exfiltrating secrets at runtime — the sandbox is
  trusted execution; FR-003 covers only what the harness itself writes.
- The fixtures issues are seeded by us, not real reporters; any demo says so explicitly.
- Confidentiality gate (constraint 3) still stands: no client repo, issue list, or log has been
  pointed at this harness; Bitcot policy confirmation remains a precondition for that.
