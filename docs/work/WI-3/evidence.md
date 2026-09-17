# WI-3 live evidence runs (Task 6) — 2026-09-17

All runs executed from the `worktree-wi-3` branch against the fixtures clone at
`/home/bitcot/Documents/projects/loop-fixtures-py`, provider `claude-via-proxy`
(credentials from the untracked `.env`; values never appear in any log below).
Every PR opened by these runs **awaits human review — the harness never merges,
closes, or edits a PR.**

## 1. Gate refusal — uncleared profile (FR-002) — PASS

- Command: `npm run loop -- --repo /home/bitcot/Documents/projects/loop-fixtures-py --issue 3 --provider claude-via-proxy`
- Preconditions: profile had `confidentialityCleared` absent; issue 3 references one attachment.
- Outcome: fail-fast, exit 1, zero API spend — `Loop finished without a PR — … issue references
  1 attachment(s), but the repo is not cleared for third-party AI APIs. Either clear the repo
  (re-run onboarding with --confidentiality-cleared) or drop the attachment from the issue.`
- No fetch (`attachments/` did not exist after the run), no sandbox, no fix attempt.
- Log: `evidence/fixtures-gate-refusal-gh-3.log` (verbatim CLI output).

## 2. Live attachment run — cleared profile (FR-003) — PASS after one stale-profile abort

- Command: same as above, after adding `"confidentialityCleared": true` to the fixtures profile
  (one field, hand-edited).
- Pre-checks: no open PR and no `fix/gh-3` branch existed (an old PR #6 for gh-3 was CLOSED,
  not merged — dedup correctly did not treat the issue as a duplicate).
- Attempt 1 aborted **before the fix run** (no LLM spend): `project profile is stale — baseline
  no longer matches a fresh run (recorded but not failing: …TestWordCount::test_empty_string,
  …test_whitespace_runs…)`. Root cause: fixtures main had moved (PR #11 merged the gh-10
  word_count fix) while the profile still recorded those tests as baseline failures. Remediation
  was the harness's own prescribed action: `npx tsx scripts/onboard.ts <fixtures>
  --confidentiality-cleared` (Docker-only, zero API spend; refreshed baseline = 1 failure,
  the titlecase test). Log: `evidence/fixtures-attachment-gh-3-attempt1-stale-profile.log`.
  Notably the attachment was already fetched and staged by this aborted attempt too.
- Attempt 2 (the one live fix run): attachment fetched and staged at
  `<fixtures>/.loop-harness/attachments/gh-3/loopfix-issue3-session.log` — 384 bytes (content
  never recorded). Fix commit `6aea681` on `fix/gh-3` touches `src/loopfix/textops.py` and adds
  the retained regression test `tests/fixed-issues/test_gh_3.py`. PR opened:
  https://github.com/manjula25/loop-fixtures-py/pull/12
- PR-body confidentiality check: PASS — the body contains only issue link, RED reproduction
  output, and verification summary; **no attachment URL or filename appears**
  (grep for `user-attachments|loopfix-issue3-session|32143084` = 0 matches; content absence
  is inferred from the body containing nothing beyond the elements listed).
- Log: `evidence/fixtures-attachment-gh-3.log` (verbatim run output).
- Observed, non-blocking: CLI printed `Run succeeded but worktree has uncommitted changes …`
  and a final `Warning: 1 uncommitted change`. Inspected: the only uncommitted entry in the fix
  worktree is the untracked harness artifact `.loop-harness/.loop-harness/` (attachment staging),
  not agent code. Flagged to the controller.

## 3. Non-GitHub source end-to-end — spec-doc (FR-008) — PASS

- Source fixture authored from `gh issue view 3` text: `evidence/fixtures-spec-doc.md`
  (one `##` section + `log: <attachment URL>` line).
- Command: `npm run loop -- --repo /home/bitcot/Documents/projects/loop-fixtures-py --spec-doc docs/work/WI-3/evidence/fixtures-spec-doc.md --provider claude-via-proxy`
- Summary lines (verbatim):
  - `source: spec-doc (docs/work/WI-3/evidence/fixtures-spec-doc.md)`
  - `Run summary — attempted: 1 (fixed: 1, failed: 0) | skipped-duplicate: 0 | not-admitted: 0`
  - `PR: https://github.com/manjula25/loop-fixtures-py/pull/13`
- The spec-doc issue's attachment was also fetched and staged (same 384-byte file under
  `attachments/spec-titlecase-returns-all-caps-instead-of-title-case/`).
- PR-body confidentiality check: PASS (same grep, 0 matches).
- Log: `evidence/fixtures-spec-doc-run.log` (verbatim run output).

## Dedup interactions observed

- The spec-doc run was **not** deduped against the still-open PR #12 for the same underlying
  bug — the spec-doc issue carries its own id (`spec-titlecase-…`), so dedup by branch/PR
  identity does not fire across sources. Both PRs (#12, #13) are open and await human review;
  a human will presumably merge one and close the other. Recorded as observed behavior, not
  changed.
- No skipped-duplicate outcomes occurred in any run (`skipped-duplicate: 0`).

## Spend

Live fix runs: **3 total — 2 with LLM spend** (step 2 attempt 1 aborted pre-fix with no LLM
spend; step 2 attempt 2; step 3). Within the cap. Step 1 and the onboarding re-run spent
nothing.
