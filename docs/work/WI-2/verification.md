# WI-2 Verification Record

Refreshed 2026-09-15 after the second review pass (findings 4–7). It supersedes the
record made at `ecbaed8`; the superseded content is in this file's git history.

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
| `--triage` gate moved from `eligible > cap` to `eligible > 1` | **None in run (c)**, which had 2 eligible against cap 1 — triage fired under both gates. But the newly reachable case (triage below the cap) has **no live datapoint at all.** |
| Harness abort now raises `QueueAbortedError` carrying the partial summary | Not exercised — no live run hit a stale baseline. |

The runs therefore remain accurate about acquisition, dedup, capped admission, sequential
execution and PR opening, and are stale as *executions*. The claim below is scoped to
match.

## The claim, stated exactly

WI-2 (queue ingestion) is implemented per `docs/work/WI-2/specification.md` FR-001–FR-006,
and the seven findings from the two review passes are fixed. The unit suite (72 tests) and
typecheck pass fresh at `86c381d`. The end-to-end behavior of acquisition, dedup, capped
admission, sequential runs and PR opening was observed live at `cdc6439`; **no live run
has been executed against this candidate**, and the triage-below-cap path introduced here
is unit-proven only.

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

### Runtime/external — three live runs at `cdc6439`, full logs in `docs/work/WI-2/evidence/`

| Run | Command | Observed (from the log) |
|---|---|---|
| (a) all-duplicates | `npm run loop -- --repo …/loop-fixtures-py --provider claude-via-proxy` | `attempted: 0 … skipped-duplicate: 3`; zero sandboxes; post-run PR (#5–#7) and branch state unchanged |
| (b) cap-forcing deterministic | `… --max-issues 1` | gh-1 admitted (ascending), fixed, PR #8 opened; `NOT ADMITTED gh-2: cap`, `NOT ADMITTED gh-3: cap`; exit 0 |
| (c) cap-forcing triage | `… --max-issues 1 --triage` | triage pass ran live (`loop/triage` branch, log drained); scores `gh-2: 4, gh-3: 2` with disjoint files; top-ranked gh-2 processed to PR #9; gh-1 skipped-duplicate (PR #8); `NOT ADMITTED gh-3: cap`; `loop/triage` deleted afterwards; no degrade warning — output was schema-valid |

External state after (c), checked 2026-09-15: PRs #8 (`fix/gh-1`) and #9 (`fix/gh-2`) were
OPEN awaiting human review and have since been reviewed and merged by the owner; issues
1–3 still open; no leftover `loop/*` branches.

## Outstanding before merge — the recommended live run

One run would close the largest gap in this record: **`--triage` with two eligible issues
below the cap**, expected to fire the scoring pass and defer one issue with
`NOT ADMITTED <id>: file overlap with <id>`. That path is the behavior change in finding 6
and has never executed live. It needs the fixtures repo seeded with two issues whose fixes
touch the same file, and it costs one model call plus one fix run.

Recommendation: run it before merge, or merge with the non-claim below standing and record
it against the next work item. This is the owner's call — it is API spend and it opens a
PR on the fixtures repo.

## Prior unknowns — reconciled

- **T5 fixtures-state decision**: CLOSED as recorded previously — PRs #5/#6/#7 closed
  unmerged and their branches deleted, with owner authorization, before runs (b)/(c).
- **Whether live triage returns schema-valid output through the proxy**: CLOSED — run (c)
  produced a valid `<triage>` block.
- **Dependency-deferral live behavior**: STILL NOT exercised — run (c)'s two eligible
  issues reported disjoint files. Unit-proven in T3/T4 and now below the cap too.

## Remaining risks

- Merge-time conflicts between sequential same-module fixes remain accepted without
  `--triage`: the deterministic default has no file knowledge.
- One live datapoint each for triage validity and cap-forcing; model behavior may vary run
  to run. The degrade path guarantees a safe fallback either way — and now covers a triage
  run that throws, not only one that returns garbage.
- `--triage` now costs a model call at any queue size above one eligible issue, where it
  previously cost nothing below the cap. That is the intended trade (the flag is the
  opt-in) but it is a real spend change; `docs/agents/workflow.md` states it.
- `--issue N` override with a stale fix branch deletes the branch and retries from clean
  main — unit-proven in T2, untested live this work item.

## Non-claims

- No claim that **any live run exercised this candidate.** The runs executed at `cdc6439`;
  the table above states change-by-change why their observations still stand and where
  they do not reach.
- No claim that **triage below the cap works live** — it is unit-proven only, and it is the
  behavior change of finding 6. See "Outstanding before merge".
- No claim that **file-overlap deferral fired live** — unit-proven only, at any queue size.
- No claim that the **degraded triage path fires live**, in either form (unusable output or
  a throwing run) — unit-proven only.
- No claim that the **abort path with a partial summary has run live** — no live run hit a
  stale baseline.
- No claim that the **`--limit 100` PR page has been exercised at scale** — the fixtures
  repo has 3 open PRs. The bound is pinned by a unit test, not by a large-repo run.
- No claim of **triage ranking quality** — the prompt is a cheap heuristic; FR-003
  explicitly disclaims this.
- No claim about **run duration or cost**, and none about parallelism (future work item).
- No client repo was touched (confidentiality gate, constraint 3) — all live evidence is
  against the seeded fixtures repo.
- The harness merged nothing (constraint 1) — PRs #8/#9 were merged by the owner.

## Approval of artifacts

- Specification: approved 2026-09-15 (owner), amended same day for decisions 14–15
  (dependency deferral, Zod validation).
- PRD decision 2 amended again 2026-09-15 (owner, this pass): the `--triage` flag, not the
  cap, is the opt-in for file-overlap deferral.
