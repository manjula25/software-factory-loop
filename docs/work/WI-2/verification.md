# WI-2 Verification Record

## Candidate identity

- Branch: `worktree-wi-2` (worktree `.claude/worktrees/wi-2`)
- HEAD: `cdc643982a281b8f40963e795058046a06e0aed8` (`cdc6439`)
- Commit range vs `main`: 7 commits (`44f9d10`…`cdc6439`), ancestry verified (`git merge-base --is-ancestor main HEAD`, exit 0)
- Working tree: clean (`git status --porcelain` empty) at verification time
- Source identity of the live runs: `git diff --stat 9356865..cdc6439` touches only the three evidence logs — the code exercised by live runs (a)/(b)/(c) is byte-identical to HEAD.

## The claim, stated exactly

WI-2 (queue ingestion) is implemented per `docs/work/WI-2/specification.md` FR-001–FR-006:
open issues are acquired (bounded, label-filterable), deduplicated against open PRs and
stale branches, admitted under a validated cap (deterministic by default, `--triage`
opt-in with Zod-validated output and file-overlap deferral), run sequentially through the
WI-1 per-issue path, and summarized honestly at end of run. The unit suite and typecheck
pass, and three live runs against `manjula25/loop-fixtures-py` exhibit the specified
behavior end to end.

## Evidence

### Broad (unit) — `npm test`, fresh, exit 0 (2026-09-15 14:19)

```
 Test Files  8 passed (8)
      Tests  59 passed (59)
   Duration  2.77s
```

38 pre-existing WI-1 tests + 21 new (T1: 3, T2: 3, T3: 6, T4: 9, including the
sequential-ordering, harness-abort, deferral, degrade, override-dedup, and cap-validation
cases). No skips, no warnings.

### Static — `npm run typecheck`, fresh, exit 0

`tsc --noEmit`, no output.

### Runtime/external — three live runs, full logs in `docs/work/WI-2/evidence/`

| Run | Command | Observed (from the log) |
|---|---|---|
| (a) all-duplicates | `npm run loop -- --repo …/loop-fixtures-py --provider claude-via-proxy` | `attempted: 0 … skipped-duplicate: 3`; zero sandboxes; post-run PR (#5–#7) and branch state unchanged |
| (b) cap-forcing deterministic | `… --max-issues 1` | gh-1 admitted (ascending), fixed, PR #8 opened; `NOT ADMITTED gh-2: cap`, `NOT ADMITTED gh-3: cap`; exit 0 |
| (c) cap-forcing triage | `… --max-issues 1 --triage` | triage pass ran live (`loop/triage` branch, log drained); scores `gh-2: 4, gh-3: 2` with disjoint files; top-ranked gh-2 processed to PR #9; gh-1 skipped-duplicate (PR #8); `NOT ADMITTED gh-3: cap`; `loop/triage` deleted afterwards; no degrade warning — output was schema-valid |

External state after (c), checked 2026-09-15: PRs #8 (`fix/gh-1`) and #9 (`fix/gh-2`) OPEN
awaiting human review; issues 1–3 still open; no leftover `loop/*` branches; local
branches `fix/gh-1`, `fix/gh-2` correspond to the open PRs (in-flight, correctly kept).

### Secrets guard over emitted artifacts — scripted scan, exit 0

Every value in `.env` checked against all three evidence logs: none present. (The summary
and PR bodies also pass `assertNoSecrets` in code; this scan covers the artifacts on disk.)

## Prior unknowns — reconciled

- **T5 fixtures-state decision** (deferred to execution in the ticket): CLOSED — chose
  "close PRs #5/#6/#7 unmerged + delete their `fix/gh-*` branches" (bugs stay on `main`,
  issues stay valid); executed with owner authorization 2026-09-15, before runs (b)/(c).
- **Whether live triage returns schema-valid output through the proxy**: CLOSED — run (c)
  produced a valid `<triage>` block (scores + files); the degrade path remains
  unit-proven only (see non-claims).
- **Dependency-deferral live behavior**: NOT exercised — the two eligible issues in run
  (c) reported disjoint files, so no deferral fired live (see non-claims). Unit-proven in
  T3/T4 tests.

## Remaining risks

- Merge-time conflicts between sequential same-module fixes remain accepted without
  `--triage` (decision 10, amended): the deterministic default has no file knowledge.
- One live datapoint each for triage validity and cap-forcing; model behavior may vary
  run to run. The degrade path guarantees a safe fallback either way.
- `--issue N` override with a stale fix branch deletes the branch and retries from clean
  main — correct per decision 11, but untested live this work item (unit-proven in T2).

## Non-claims

- No claim of **triage ranking quality** — the prompt is a cheap heuristic; FR-003
  explicitly disclaims this.
- No claim that the **degraded triage path fires live** — it is proven under unit stubs
  only; run (c) received valid output.
- No claim that **file-overlap deferral fired live** — run (c)'s issues were disjoint;
  deferral is unit-proven only.
- No claim about **run duration or cost** (PRD User Story 11's "cost spent" stays
  deferred), and none about parallelism (future work item).
- No client repo was touched (confidentiality gate, constraint 3) — all live evidence is
  against the seeded fixtures repo.
- PRs #8/#9 are open, not merged — human merge is out of the harness's authority
  (constraint 1).

## Approval of artifacts

- Specification: approved 2026-09-15 (owner), amended same day for decisions 14–15
  (dependency deferral, Zod validation) with the owner's direction recorded in
  `harness-prd-v2.md` and the carve-out PRD.
