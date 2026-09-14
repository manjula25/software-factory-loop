# Delivery

## Work item

WI-1 — Scaffold harness and prove one bug fixed end-to-end (`harness-prd-v2.md`; specs
`specification-harness.md` FR-001…005, `specification-fixtures.md` FR-101…104).

## Summary

A TypeScript issue-driven test & fix loop on Sandcastle 0.12.0 (pinned, behind a single adapter
module with an enforced boundary): normalize a GitHub issue → baseline preflight on the unfixed
tree (aborts before agent spend if the onboarding profile is stale) → fix agent in a local Docker
sandbox on `fix/<issue-id>` → independent re-verification in a fresh sandbox (reproduction test
passes AND full-suite diff vs the born-red baseline, unreadable output refused) → PR with verbatim
RED/GREEN evidence and a symptom-mapping line, machine commit identity, no closing keywords, no
auto-merge. Provider registry (claude-via-proxy / codex-direct / opencode) with `--model`
override; secrets reach the sandbox only as env, and every emitted string passes a leak guard
whose own errors never echo the value. Plus: the Docker sandbox image (built only via
`npm run build:image` through Sandcastle, smoked 9 checks), the seeded target repo
`manjula25/loop-fixtures-py` with three independent bugs and three report shapes, the onboarding
pass that records an execution-verified profile, and the diagnostic/evidence scripts.

## Plan artifacts

`docs/work/WI-1/specification-harness.md`, `specification-fixtures.md` (approved 2026-09-11,
two owner-directed clarifications on attachment shapes), `implementation-plan.md` (11 tasks,
executed T1–T11), `verification.md`, `review.md`, this file.

## Verification

Fresh at delivery (`docs/work/WI-1/verification.md`, last updated 2026-09-14): `npm ci` → exit 0
(pinned lockfile, 0 vulnerabilities); `npm test` → 38/38; `tsc --noEmit` (incl. `scripts/`)
→ clean; image smoke 9/9; adapter boundary enforced over `src/` + `.sandcastle/`. End-to-end:
four complete loop runs producing open PRs on `loop-fixtures-py` — #5 (gh-2), #6 (gh-3),
and **#7 (gh-1, re-run through the final hardened loop: preflight ran, throwaway branch
auto-deleted, all evidence sections present)**. RED truthfulness independently re-derived
(all repro tests fail on unfixed `main`); baseline profile independently matched against a
fresh clone.

## Evidence boundary

The PR-evidence e2e runs for gh-2/gh-3 (#5, #6) were produced by the pre-hardening loop; their
hardened-path counterparts are covered by 38 unit tests plus the live gh-1 re-run (#7), which
exercised every hardening change end-to-end. PR #4 (gh-1, original run) is closed as superseded;
its evidence is preserved in verification.md.

## Non-claims

The fixes are not claimed correct in the human sense — every PR awaits human review; the harness
never merges (constraint 1). No queue ingestion, dedup, priority triage, or multi-issue
processing (WI-2+). No protection against a malicious in-sandbox agent (sandbox is trusted
execution; the guard covers only what the harness itself writes). The fixture issues are seeded
by us, not real reporters — any demo says so. No client repo, issue list, or log has been pointed
at this harness; the confidentiality gate (constraint 3) still bars that until Bitcot policy is
confirmed.

## Remaining risks

Proxy model availability can change under us (glm-5.3 worked 09-13, 400s 09-14 — the model is
one `--model` flag away); the weekly token-plan quota is a real budget and exhausted once;
fragment-only secret matches pass the whole-value guard (documented limitation); user-attachment
URLs are not fetched (WI-2). Image rebuilds must use `npm run build:image` (plain `docker build`
produces a UID-mismatched image).

## Review status

`docs/work/WI-1/review.md` — PASS, zero open findings: 1 blocking (guard echoed the secret it
blocked) + 4 adjacent/evidence findings, all resolved inline or post-review with owner direction.

## Branch and base

`worktree-wi-1` → `main`, remote `manjula25/software-factory-loop`.

## Commit range

`6ac4cf9..81a6fcf` (merge-base to HEAD), 24 commits, 37 files.

## Requested external actions

Push `worktree-wi-1` to origin and open the delivery PR into `main` — authorized by the owner
in conversation ("yes finishing-a-development-branch", after explicit confirmation of this step).

## Executed external actions and observed results

- `git push -u origin worktree-wi-1` → new branch on origin, tracking set (a94d483 at push time).
- `gh pr create --base main --head worktree-wi-1` → **https://github.com/manjula25/software-factory-loop/pull/2** (open).

## Pending actions

None beyond the requested push + PR. Merging is a human act (constraint 1).
