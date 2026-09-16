# WI-2 Verification Record

> 2026-09-16: the magvation real-project trial (live queue loop against a real client repo,
> issues gh-1/gh-2/gh-3 → PRs #4/#5/#6 on the fork) is recorded separately in
> `magvation-trial-2026-09-16.md`. This file remains the verification record for the WI-2
> code itself.

Refreshed 2026-09-15 after the second review pass (findings 4–7), then again the same day
with a fourth live run closing the one gap that pass left open (triage below the cap). It
supersedes the record made at `ecbaed8`; the superseded content is in this file's git
history.

## Candidate identity

- Branch: `worktree-wi-2` (worktree `.claude/worktrees/wi-2`)
- HEAD: `86c381d7ba48c67014e7c21f96e59ea16f38d266` (`86c381d`)
- Commit range vs `main`: 14 commits (`44f9d10`…`86c381d`), ancestry verified
  (`git merge-base --is-ancestor main HEAD`, exit 0)
- Working tree: clean at verification time apart from this file
- Source commits since the previous record: `c29bb06` (review findings 4–7 + triage
  coverage) and `86c381d` (CLAUDE.md / workflow.md staleness, documentation only)

### Post-evidence source change — disclosed, and larger than last time

The three live runs in `docs/work/WI-2/evidence/` were gathered at `cdc6439` and **have
not been repeated against this candidate.** Last time that gap was defensible because the
intervening commit only added a typed field. It is a bigger gap now: `c29bb06` changes
four behaviors the live runs touch or could touch.

| Change | Effect on what the runs observed |
|---|---|
| `gh pr list` now passes `--limit 100` (was gh's silent 30) | None observable — the fixtures repo has 3 open PRs, well inside both bounds. The defect this fixes cannot appear at that scale. |
| Dedup token match is now case-insensitive and fully escaped | None observable — every fixtures PR body writes the id lowercase as `gh-N`, which matched before and matches now. |
| `--triage` gate moved from `eligible > cap` to `eligible > 1` | **None in run (c)**, which had 2 eligible against cap 1 — triage fired under both gates. The newly reachable case (triage below the cap) is now covered live — see run (d) below. |
| Harness abort now raises `QueueAbortedError` carrying the partial summary | Not exercised — no live run hit a stale baseline. |

The runs therefore remain accurate about acquisition, dedup, capped admission, sequential
execution and PR opening, and are stale as *executions*. The claim below is scoped to
match.

## The claim, stated exactly

WI-2 (queue ingestion) is implemented per `docs/work/WI-2/specification.md` FR-001–FR-006,
and the seven findings from the two review passes are fixed. The unit suite (72 tests) and
typecheck pass fresh at `86c381d`. The end-to-end behavior of acquisition, dedup, capped
admission, sequential runs and PR opening was observed live at `cdc6439`, and the
triage-below-cap path (finding 6) — the one gap that record left open — was observed live
at `86c381d` in run (d): two eligible issues sharing a file, triage scored and ranked them,
one was deferred with the file-overlap reason, the other fixed and PR'd. No live run has
exercised the harness-abort-carries-partial-summary path (finding 5) or a triage run that
throws (the try/finally cleanup).

## Evidence

### Broad (unit) — `npm test`, fresh at `86c381d`, exit 0 (2026-09-15 15:05)

```
 Test Files  8 passed (8)
      Tests  72 passed (72)
   Duration  1.19s
```

Exit code confirmed separately (`npm test >/dev/null; echo $?` → `0`). 59 → 72: thirteen
new cases covering the second review pass —

- open-PR page bound is explicit and never narrower than the issue page (finding 4)
- abort mid-queue carries the PR already earned, and its summary is printable (finding 5)
- file-overlap deferral below the cap; single eligible issue buys no model call; no model
  call without the flag (finding 6)
- case-insensitive id match; regex metacharacter in an id treated as literal (finding 7)
- triage run that throws degrades and still cleans `loop/triage`; its degrade warning is
  blocked when it would leak an env value
- `buildTriagePrompt`: first-line-only listing, no attached log reaching the prompt, block
  shape, and a round-trip against `parseTriageOutput` (this function previously had **no
  test at all**)
- `triageRunOptions()`: `maxIterations: 1` and a branch that is never a `fix/*` branch

Each of these was confirmed to **fail against the pre-fix code** before being accepted —
the escaping pair, the abort-carries-PR case, and the triage-degrade pair were each re-run
against a temporarily reverted source and observed red. No skips, no warnings.

### Static — `npm run typecheck`, fresh at `86c381d`, exit 0

`tsc --noEmit`, no output.

### Secrets guard over emitted artifacts — scripted scan, exit 0, re-run at `86c381d`

Both values in `.env` checked against all three evidence logs: none present. (The summary,
the degrade warning — newly guarded in `c29bb06` — and PR bodies also pass
`assertNoSecrets` in code; this scan covers the artifacts on disk.)

### Runtime/external — four live runs, full logs in `docs/work/WI-2/evidence/`

| Run | Command | Candidate | Observed (from the log) |
|---|---|---|---|
| (a) all-duplicates | `npm run loop -- --repo …/loop-fixtures-py --provider claude-via-proxy` | `cdc6439` | `attempted: 0 … skipped-duplicate: 3`; zero sandboxes; post-run PR (#5–#7) and branch state unchanged |
| (b) cap-forcing deterministic | `… --max-issues 1` | `cdc6439` | gh-1 admitted (ascending), fixed, PR #8 opened; `NOT ADMITTED gh-2: cap`, `NOT ADMITTED gh-3: cap`; exit 0 |
| (c) cap-forcing triage | `… --max-issues 1 --triage` | `cdc6439` | triage pass ran live (`loop/triage` branch, log drained); scores `gh-2: 4, gh-3: 2` with disjoint files; top-ranked gh-2 processed to PR #9; gh-1 skipped-duplicate (PR #8); `NOT ADMITTED gh-3: cap`; `loop/triage` deleted afterwards; no degrade warning — output was schema-valid |
| (d) below-cap triage, file-overlap deferral | `npm run loop -- --repo …/loop-fixtures-py --provider claude-via-proxy --triage` (default cap 3) | `86c381d` | 2 eligible issues, no `--max-issues` given — the cap forces no choice; triage fired anyway (finding 6). Raw model output (`.sandcastle/logs/loop-triage-triage.log`): `{"scores":{"gh-10":4,"gh-3":3},"files":{"gh-10":["src/loopfix/textops.py","tests/test_textops.py"],"gh-3":["src/loopfix/textops.py","tests/test_textops.py"]}}` — both issues name the same two files. gh-10 (higher score) admitted, fixed, PR #11 opened; `NOT ADMITTED gh-3: file overlap with gh-10`; exit 0 |

Run (d) setup, so the deferral had a real file to fire on: `word_count` in
`src/loopfix/textops.py` was seeded with a second, independent defect (`text.split(" ")`
instead of `text.split()`) as issue gh-10, alongside the still-open gh-3 (`titlecase`,
same file). The onboarding profile was stale after PRs #8/#9 merged — it still listed
their two fixed tests as expected failures — and was refreshed via `scripts/onboard.ts`
against the sandbox before the run; a stale profile would have aborted the run as a
harness-level failure before ever reaching triage.

Post-run verification, not assumed: `gh pr view 11` confirms the PR body carries verbatim
RED (2 failing, "assert 1 == 0" / "assert 8 == 2") and GREEN ("3 passed") evidence and the
independent fresh-sandbox verification statement; `gh pr diff 11` confirms the fix is
`text.split(" ")` → `text.split()`, nothing else, plus the retained reproduction test at
`tests/fixed-issues/test_gh_10.py`. `git branch --list 'fix/*'` locally and
`git ls-remote --heads` on the fixtures repo confirm no `fix/gh-3` branch exists anywhere
(the deferred issue was never given a sandbox) and `loop/triage` was deleted, not leaked.

External state after (d), checked 2026-09-15: PR #11 (`fix/gh-10`) OPEN awaiting human
review; issue gh-3 still open, unchanged; PRs #8/#9 merged (unrelated to this run, prior
state). The two `word_count` defects and the profile refresh are committed to the fixtures
repo's `main` as their own commits, not folded into a run log.

## Prior unknowns — reconciled

- **T5 fixtures-state decision**: CLOSED as recorded previously — PRs #5/#6/#7 closed
  unmerged and their branches deleted, with owner authorization, before runs (b)/(c).
- **Whether live triage returns schema-valid output through the proxy**: CLOSED — runs (c)
  and (d) both produced a valid `<triage>` block.
- **Dependency-deferral live behavior**: CLOSED — run (d): two eligible issues reporting
  overlapping files, one deferred with the file-overlap reason, live. Also still
  unit-proven in T3/T4.
- **Triage firing below the cap (finding 6)**: CLOSED — run (d), no `--max-issues` given,
  2 eligible against the default cap of 3.

## Remaining risks

- Merge-time conflicts between sequential same-module fixes remain accepted without
  `--triage`: the deterministic default has no file knowledge.
- Two live datapoints for triage validity and file-naming (runs (c), (d)), one for
  cap-forcing (run (b)); model behavior may vary run to run. The degrade path guarantees a
  safe fallback either way — and now covers a triage run that throws, not only one that
  returns garbage (unit-proven only, not exercised live).
- `--triage` now costs a model call at any queue size above one eligible issue, where it
  previously cost nothing below the cap. That is the intended trade (the flag is the
  opt-in) and run (d) shows the actual cost: one triage pass plus one fix run for two
  eligible issues. `docs/agents/workflow.md` states it.
- `--issue N` override with a stale fix branch deletes the branch and retries from clean
  main — unit-proven in T2, untested live this work item.
- The harness-abort-carries-partial-summary path (finding 5) has no live datapoint — no
  live run has hit a stale baseline mid-queue.

## Non-claims

- No claim that **runs (a)/(b)/(c) exercised this candidate.** They executed at `cdc6439`;
  the change-by-change table above states why their observations still stand. Run (d) did
  exercise `86c381d` directly.
- No claim that the **degraded triage path fires live**, in either form (unusable output or
  a throwing run) — both remain unit-proven only; neither triage pass observed live (c, d)
  returned unusable output or threw.
- No claim that the **abort path with a partial summary has run live** — no live run has
  hit a stale baseline mid-queue.
- No claim that the **`--limit 100` PR page has been exercised at scale** — the fixtures
  repo has at most 3 open PRs at any point observed. The bound is pinned by a unit test,
  not by a large-repo run.
- No claim of **triage ranking quality** beyond what was observed: run (d)'s model gave the
  newer, more specific-sounding issue (gh-10, two failing assertions named) a score of 4
  against gh-3's 3 — a plausible but not verified ranking judgment. FR-003 explicitly
  disclaims ranking-quality guarantees.
- No claim about **run duration or cost** in aggregate (PRD User Story 11's "cost spent"
  stays deferred) beyond what run (d) shows for one below-cap triage pass, and none about
  parallelism (future work item).
- No client repo was touched (confidentiality gate, constraint 3) — all live evidence,
  including the two seeded defects and the profile refresh for run (d), is against the
  seeded fixtures repo.
- The harness merged nothing (constraint 1) — PRs #8/#9 were merged by the owner; PR #11
  (run (d)) is open, awaiting the same review.

## Approval of artifacts

- Specification: approved 2026-09-15 (owner), amended same day for decisions 14–15
  (dependency deferral, Zod validation).
- PRD decision 2 amended again 2026-09-15 (owner, this pass): the `--triage` flag, not the
  cap, is the opt-in for file-overlap deferral.
