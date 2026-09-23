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

**Base-ref note (resolved at the ask):** `origin/main` was at `a175dea`, 3 commits behind local
`main` (`42b64b1`, `e488832`, `ef8d52e` — WI-14's own grilling/spec/plan docs, never pushed).
The owner chose to push `main` first, so the PR's diff is the WI-14 implementation range alone;
otherwise the PR would have shown 19 commits, since GitHub diffs against `origin/main`.

## Commit range

`ef8d52e..782edbf` as opened — 17 commits (T1–T5, the live-run evidence, the verification
record, the review record, this delivery record). This record's post-execution amendment adds
one further commit, so the branch tip to merge will be `ef8d52e..HEAD` (18 commits).

## Requested external actions

Owner authorized (2026-09-23, via AskUserQuestion, option "Push main, branch, open PR"):
(1) push local `main` to `origin`, (2) push `worktree-wi-14`, (3) open the PR. Scope was
confirmed against the base-ref wrinkle above — the owner was told the `main` push also publishes
WI-14's grilling/spec/plan docs to `main` directly, without review.

Authorized afterwards by the owner on 2026-09-23: (4) push this record's post-execution
amendment (a further push to the same PR), (5) prune the merged fixtures branch `fix/gh-3`, and
(6) correct this record. The **merge itself was never requested of the harness** — asked to
merge, the harness surfaced constraint 1 (this repo keeps human merge; all 15 prior merges were
the owner's in the UI) and the owner merged it in the GitHub UI.

## Executed external actions and observed results

- **Push `main`** → origin: executed 2026-09-23; observed `a175dea..ef8d52e  main -> main`,
  a fast-forward (verified `origin/main` was an ancestor first). `origin/main` now reads
  `ef8d52eb05a3e1dc23030443641b0e807f9f9ae8`.
- **Push `worktree-wi-14`** → origin: executed 2026-09-23; observed `* [new branch]
  worktree-wi-14 -> worktree-wi-14`, upstream `origin/worktree-wi-14` set. Origin now reads
  `782edbf44f668ee2d631c56f59b2aa9e4973f4eb`.
- **PR `worktree-wi-14` → `main`**: executed 2026-09-23; observed
  **https://github.com/manjula25/software-factory-loop/pull/18** — read back as `OPEN`,
  base `main`, head `worktree-wi-14`, `MERGEABLE`, not a draft, **17 commits**, 10 changed
  files, +2118/−14. The file list is exactly the WI-14 surface (2 `src/`, `CLAUDE.md`,
  `docs/agents/workflow.md`, 6 `docs/work/WI-14/`), confirming the `main` push kept the three
  planning commits out of the diff.
- **Push of the post-execution amendment**: executed 2026-09-23; observed
  `782edbf..1feb895  worktree-wi-14 -> worktree-wi-14`. PR #18 then read back as `MERGEABLE` /
  `mergeStateStatus: CLEAN`, 18 commits, 10 files, +2130/−14.
- **Merge of PR #18**: performed by the owner (`manjula25`) in the **GitHub UI**, 2026-09-23
  13:55:05Z — not by the harness (constraint 1). Read back: `MERGED`, merge commit
  `c335fc88f7fe8e183273febaece14635a3e50b6b` with parents `ef8d52e` + `1feb895`, a true merge
  commit matching all 15 prior merges. Local `main` fast-forwarded `ef8d52e → c335fc8` (clean;
  the pre-existing dirty `docs/work/reports/harness-functionality-guide.html` untouched).
- **Post-merge cleanup**: remote branch `worktree-wi-14` deleted (tip verified an ancestor of
  `origin/main` first); worktree `.claude/worktrees/wi-14` removed; local branch deleted.
  `origin` now carries only `main`, and `main` carries `src/loop.ts` = `e51d2f82…` and
  `src/loop.test.ts` = `3a890e34…` — the exact blobs the gates and the T5 runs were proven
  against.
- **T5 fixture-repo activity** (`manjula25/loop-fixtures-py`): authorized separately 2026-09-23
  and executed then, not part of this delivery — recorded verbatim in
  `evidence/escalation-live-run.log` (PR #55 squash-merged as `f22c294`, issue #54 closed).
- **Fixtures `fix/gh-3` pruned**: executed 2026-09-23 — the branch was verified merged into
  fixtures `main` before anything was removed; its sandbox worktree (holding only untracked
  `.loop-harness/.loop-harness/` nesting junk) was removed with `--force` and the branch deleted.

## Pending actions

- **Correction, recorded in this commit:** an earlier revision of this record listed
  "the fixtures-repo cleanup already noted in `implementation-notes.md`" as a WI-14 pending
  action. That attribution was **wrong**. WI-14 left **nothing** in
  `manjula25/loop-fixtures-py`: its fix branches were already deleted by the runs, PR #55 is
  merged (`f22c294`), issue #54 is closed, and no `fix/gh-52` / `fix/gh-54` branch or staging
  directory survives. The artifacts found there belong to **earlier** work items.
- **One fixtures artifact is deliberately left in place:**
  `fix/spec-titlecase-returns-all-caps-instead-of-title-case`, with its sandbox worktree and the
  matching `.loop-harness/` attachment staging, is **NOT merged** into fixtures `main` — it holds
  a real commit `31fc46e` ("fix(titlecase): capitalize first letter of each word, preserve
  rest"). It is not WI-14's, and removing it would destroy unmerged work, so it was left for its
  owner to decide. (`fix/gh-3`, which *was* merged, was pruned as authorized.)
- Human review + merge of this correction's PR (owner; this repo never auto-merges itself).