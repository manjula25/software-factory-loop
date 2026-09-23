# Delivery — WI-14

## Work item

WI-14: escalation on failed fix attempts. Spec `docs/work/WI-14/specification.md`
(FR-001..FR-006), approved 2026-09-20; grilling record `docs/work/WI-14/prd.md` (also amends
`harness-prd-v2.md`). Plan `docs/work/WI-14/implementation-plan.md` — five tasks T1–T5, all
accepted; interpretation note 1 amended by the owner 2026-09-23 to widen FR-005's label
removal to every verified-PR-delivered outcome.

## Summary

When a lane ends an issue **unfixed with no visible artifact of its own on GitHub** — a
reproduction-test failure, a verification failure, or a preflight/sandbox failure (`fix-failed`
and `preflight-failed`) — the harness now escalates inline at the moment it fails, for
GitHub-sourced issues only:

- **a comment on the failed issue**, posted immediately (never batched, never retried),
  carrying the `@<notifyHandle>` mention when a handle is configured — and when none is, the
  comment still posts with no `@` and both the run summary and the single-issue report state
  `notify handle not configured` in the existing WI-11/12 vocabulary — plus the outcome class,
  the failure reason **byte-identical** to the summary's FAILED line, and a pointer to the
  operator's console output. No excerpts, no diagnosis, no suggested fix.
- **a `harness-failed` label**, created once at run start on GitHub-sourced runs, added by that
  same trigger, and **removed on every verified-PR-delivered outcome** (the green PR-opened
  return, the merged + canary-green chain with its issue close, and the four PR-left returns —
  merger-gate non-proceed, review skip, merge throw, halted sibling). Reverted and uncanaried
  merges keep it: delivered but unverified is not fixed.

Outcomes that leave a PR open never escalate. A failed comment post or label write is captured
verbatim in the run summary (the FAILED line's suffix, the `harness-failed label add/remove
failed` line, the single-issue report's stderr), never retried, and never displaces the verdict
it rides beside — the escalation recording changes no existing outcome field.

## Plan artifacts

`docs/work/WI-14/`: `prd.md`, `slices.md`, `specification.md`, `implementation-plan.md`,
`implementation-notes.md` (controller ledger T1–T5 + adjacents A1–A17 and observations O1–O3),
`evidence/escalation-live-run.log` (T5: three live runs, verbatim), `verification.md` (completion
record), `review.md` (branch-level two-axis review), `delivery.md` (this file).

## Verification

Completion gates re-run at the verified source identity `785a026` (source blobs
`src/loop.ts` `e51d2f82…`, `src/loop.test.ts` `3a890e34…`), recorded with exit codes in
`verification.md`:

| Gate | Result |
|---|---|
| `npm run typecheck` | exit 0 (re-confirmed at the delivered commit) |
| `npx vitest run src/loop.test.ts` | exit 0 — **162/162** (140 prior + 22 WI-14; re-confirmed at the delivered commit) |
| `npm test` | exit 0 — **283/283**, 10 files |
| `npm run build:image` | exit 0 |
| `npm run smoke:image` | exit 0 — 9/9 `ok:` |

The delivered source is **byte-identical** to the verified and live-exercised source:
`git diff --stat 785a026..HEAD -- src/` is empty and the blob SHAs match at both ends, so the
docs-only commits after `785a026` (live-run evidence, verification record, review record, this
record) do not invalidate any gate or the T5 evidence.

Live evidence (T5): three runs against `manjula25/loop-fixtures-py`, a **public synthetic
fixture repo** (hard constraint 3 not engaged), provider `claude-via-proxy`, local Docker only.
The escalation arm was proven live — lane FAILED, exit 1, no PR, no leftover `fix/*` branch,
**exactly one** comment carrying `@manjula25`, `Outcome: fix-failed` and a `Reason:` byte-identical
to the console summary line, the label added, issue left OPEN — and the removal arm was proven
live on the amended re-run (PR #55, squash-merge `f22c294`, canary green on main, issue closed,
exit 0, label `["harness-failed"]` → `[]`), with a negative check that the success path posted
only the close comment. The already-exists label classifier — whose dead-code regex was T2's
blocking defect — fired against real `gh`, three runs.

## Evidence boundary

Harness-source behavior is dep-injected vitest at the public seam. The T5 live runs executed
with `src/` at `e07584e`, byte-identical to the delivered source (blob SHAs above). Live
evidence covers **only** `manjula25/loop-fixtures-py`; the image/smoke result is
candidate-independent (no `Dockerfile`/`scripts/` change). Local Docker only (constraint 6).

## Non-claims

- **Not produced live:** the `preflight-failed` arm, the reverted and uncanaried outcome arms,
  and the **absent-handle** arm (the fixtures profile sets a handle, so only the present arm was
  witnessed). Those rest on vitest alone.
- **A9's failure mode is unproven** — no run produced a genuine `gh` error during a label
  remove; only the intended idempotent-absent branch was exercised.
- The *comment* side's reverted/uncanaried non-triggering is pinned by code reading, not a test
  (the *label* side is pinned) — A5.
- Vitest proves behavior through the injected `LoopDeps` seam, not the wiring inside `main()`;
  for this work item the live runs cover the wiring instead, which is stronger but not
  repeatable in CI.
- No lint claim — there is no lint step in this repo, and none was added.
- **No merge-policy change:** this repository still keeps human merge (constraint 1). WI-14
  never merges anything itself.

## Remaining risks

1. **The over-broad label-remove classifier (A9)** — `src/loop.ts:2745` matches
   `/not found|not present|does not exist|could not remove/i`, wider than FR-005's boundary, so
   a genuine `gh` error during a removal is swallowed: the issue keeps `harness-failed` while
   no longer failing, with only a silent summary. **The Spec axis re-raised this at the
   branch-level review.** Kept deferred, not blocking — effect bounded, no verdict affected,
   already recorded with an owner — but it is the one finding with a reachable
   operator-visible consequence, and the owner can override at merge time.
2. **Stale-baseline spam** (plan interpretation note 2): a stale profile fails every lane that
   reaches preflight, and each such lane escalates — bounded by wave size, accepted deliberately
   rather than special-cased.
3. **The label is the harness's only cross-run state** (FR-005 non-claim); combined with risk 1,
   the label's "currently failing" meaning can drift.
4. Adjacent backlog (A1–A17, O1–O3): test-hygiene, doc-shape and console-wording items, plus the
   tautological `expectedEscalationBody` helper and the two spellings of the gh-sourced
   predicate. None blocking; candidates for a future test/docs slice.

## Review status

Per-task dual reviews (specification then code-quality) at every checkpoint T1–T4, all accepted;
one blocking verdict at T2 (the `ensureHarnessFailedLabel` already-exists classifier was
unreachable dead code) — resolved at `5470a97` with both reviews re-run on the new identity.
Branch-level review (`review.md`, candidate `f4b029d`): **Standards pass-with-findings** (zero
documented-standard violations, six smell judgement calls), **Spec pass-with-findings**
(FR-001..FR-006 faithful, six findings). **No blocking findings.**

Three reviewer claims were controller-verified rather than accepted: the "false summary line"
claim was dismissed (`notifyHandle` is populated from the profile independently of the post);
the unguarded `createFixSandbox`/`runFixRun` throw arms were confirmed as behaviour but narrowed
to a follow-up (pre-existing; FR-001 is framed as an outcome family); and
`escalation.outcomeClass` was narrowed from "dead" to test-pinned and renderer-unread. The
review also covers the two `CLAUDE.md` `## Lessons` bullets added after T4, found accurate.

## Branch and base

Branch `worktree-wi-14` (worktree `.claude/worktrees/wi-14`); base `main` @ `ef8d52e`.
Target: PR to `manjula25/software-factory-loop` `main`. Human merge only — this repo never
auto-merges itself (constraint 1).

**Base-ref note for the owner:** `origin/main` is at `a175dea`, and local `main` is **3 commits
ahead** of it — `42b64b1`, `e488832`, `ef8d52e`, WI-14's own grilling/spec/plan docs, which have
never been pushed. Pushing only the branch therefore yields a PR showing **19** commits
(those 3 plus the branch's 16), not the WI-14 implementation range alone. Options at the ask
below.

## Commit range

`ef8d52e..690c2e3` — 16 commits, all of T1–T5, the live-run evidence, the verification record
and the review record. Extended by this record's own commit, so the PR will carry
`ef8d52e..HEAD` (17 commits).

## Requested external actions

**None yet — awaiting explicit authorization.** Nothing in this delivery has been pushed, opened,
merged or deleted. The only execution outside the harness repo in this work item was T5's
fixture-repo activity (`manjula25/loop-fixtures-py`), authorized separately on 2026-09-23 and
recorded verbatim in `evidence/escalation-live-run.log`.

To be decided at the ask:

1. Whether to push local `main` (`ef8d52e`) to `origin` first, so the PR's diff is the WI-14
   implementation range alone — or to let the PR carry the 3 planning commits too.
2. Push `worktree-wi-14` to `origin`.
3. Open a PR `worktree-wi-14` → `main` on `manjula25/software-factory-loop`.

## Executed external actions and observed results

None. No delivery action has been performed for WI-14.

## Pending actions

- Owner authorization for the push and PR above (each action separately).
- Human review + merge of the PR (owner; this repo never auto-merges itself).
- Post-merge worktree/branch cleanup, and the fixtures-repo cleanup already noted in
  `implementation-notes.md` — both need explicit authorization at that point.