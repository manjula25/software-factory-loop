# Code Review — WI-1

## Candidate identity

- Fixed point: `6ac4cf9` (merge-base of `worktree-wi-1` with `main`)
- Candidate at review start: `35c6762` (`worktree-wi-1`)
- Range: 21 commits, 35 files, +4110/−2. Ancestry verified (`git merge-base`, non-empty).
- **Candidate changed during review:** three review findings were fixed as part of this review
  (guard message leak, stale workflow.md row, scripts/ outside typecheck) — the reviewed verdict
  below applies to the review-fix commit, the single commit directly on top of `35c6762` that
  carries these fixes and this file; the fixed findings are marked *resolved inline*.

## Changed-path accounting

All 35 changed paths read in full: src/ (10 files: 5 modules + 5 test files, incl. boundary test),
scripts/ (6), .sandcastle/ scaffold (7 — `sandcastle init` output per FR-001, Dockerfile extended),
docs (workflow.md, specification-fixtures.md clarification, verification.md), config
(package.json + lockfile, tsconfig, vitest, .gitignore, .env.example). No unaccounted paths.

## Axis verdicts

### 1. Repository standards — PASS

Real commands recorded in `docs/agents/workflow.md` (was stale mid-review, fixed inline);
`.env` git-ignored with a populated file present and status clean; commit messages conventional
and specific; the `.sandcastle/` scaffold is committed as `sandcastle init` produced it, per
FR-001's "scaffold committed" requirement.

### 2. Specification fidelity — PASS (one finding, resolved inline)

- FR-001: pinned 0.12.0 in the lockfile; boundary enforced by an import-pattern test (a textual
  mention alone does not trip it — the test file itself proves that). *Adjacent observation:*
  `.sandcastle/main.ts` (the init template) imports the package outside `src/`; the FR's grep
  scope is `src/` and the file is dead scaffold, not harness code — recorded, not acted on.
- FR-002: registry resolution tested across providers; no provider name in pipeline code; missing
  env fails at startup, naming the variable.
- FR-003: **BLOCKING FINDING (resolved inline)** — `assertNoSecrets`'s error message re-printed
  the offending string, which by construction contains the secret; an uncaught error lands in the
  console, i.e. a log the harness writes — precisely what FR-003 forbids. Worse, the unit test
  *asserted* the secret appears in the message. Fixed: the message names the KEY only; the test
  now asserts both the key's presence and the value's absence (38/38 green).
- FR-004/005/101–104: satisfied; evidence in verification.md (image smoke 9/9, three open PRs
  with machine identity, born-red baseline diff held on every run, staleness preflight now real).

### 3. Evidence and risk integrity — PASS with one explicit gap

verification.md is fresh for the hardening commits, maps every FR to a command with exit codes
and durable references, and carries explicit non-claims. Known gap (recorded there): the three
PR-evidence e2e runs predate the hardening commits; the hardened loop is covered by unit tests
plus real-Docker component checks but not yet by a full e2e run — one confirming run is
recommended at WI-2 kickoff.

### 4. Unnecessary complexity — PASS

The three-export adapter seam is deliberate (FR-001 names the primitives; `mergeBack` is unused
in WI-1 but part of the specified seam, not dead weight). `FixRunOutcome.logFilePath` and the
profile's `expectedDurationSec` are spec-named fields recorded for later work items. The four
diagnostic scripts under `scripts/` are evidence generators referenced from verification.md.
Nothing found that a smaller replacement would improve without weakening a seam.

## Findings summary

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | **Blocking** | Secrets-guard error message echoed the secret (and its test asserted it) | Fixed inline this review; TDD-updated |
| 2 | Adjacent | `docs/agents/workflow.md` pipeline row still said "none yet" after T7/T11 landed | Fixed inline |
| 3 | Adjacent | `scripts/*.ts` outside `tsconfig` include — tsx-run but never typechecked | Fixed inline (`scripts` added; strict tsc clean) |
| 4 | Adjacent | `.sandcastle/main.ts` template imports sandcastle outside the adapter | Resolved post-review (owner direction): boundary test now scans `src/` **and** `.sandcastle/` with an explicit allowlist — the template is the one named exemption; any new importer anywhere fails the build |
| 5 | Missing evidence | No full e2e run with the hardened loop (post-`9d5ccd7` changes) | Resolved post-review (owner direction): gh-1 re-run through the hardened loop → PR #7 with full evidence; preflight and branch cleanup verified live. verification.md updated |

## Unverified evidence

None beyond finding #5, which is explicitly bounded in verification.md.

## Verdict

**PASS — no open blocking findings.** All three review-time fixes are committed on the branch
with tests green (38/38, tsc clean incl. scripts/). Recommend `finishing-a-development-branch`.
