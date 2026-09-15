# T5 — Live evidence runs against the fixtures repo

## What to build

Real invocations of queue mode against `manjula25/loop-fixtures-py` in local Docker,
exercising T1–T4 as one chain, recorded for the verification pass: (a) an all-duplicates
run proving live acquisition, dedup against the actually-open PRs, and the summary;
(b) a cap-forcing run (`--max-issues 1` against a deduped queue of ≥ 2) proving
deterministic admission and not-admitted reporting; (c) the same cap-forcing shape with
`--triage`, proving the scoring pass runs live and its chosen issue is the one processed.
Preparing the fixtures state (closing unmerged fixtures PRs and deleting their branches —
the bugs remain on main, so the issues stay valid targets — or seeding new issues) is an
execution-time decision, recorded in the verification notes when made.

## Blocked by

T4 — requires the full queue mode working end to end.

## Requirement coverage

FR-006; slice 5's integration clause; grilling decision 8 (cap-forcing live evidence);
PRD Testing Decisions (integration against seeded repos, non-Node target).

## Acceptance criteria

- [ ] Run (a) recorded: queue acquired, every issue covered by an open PR skipped as
      duplicate, summary matches observed PR state.
- [ ] Run (b) recorded: exactly one issue processed under `--max-issues 1`; the
      not-admitted issues reported with the cap named; deterministic admission visible.
- [ ] Run (c) recorded: scoring pass ran live; the processed issue is the one it ranked
      first.
- [ ] Any fix carried through keeps WI-1's evidence rules intact (RED/GREEN in the PR
      body, fresh-sandbox verification, no auto-merge).
- [ ] Outcomes and full output captured in `docs/work/WI-2/verification.md` territory at
      verification time (this ticket produces the runs; the verification skill records
      them).

## Evidence boundary

Proves the integrated queue loop works against a real repo, real PRs, and the live proxy
model. Does not claim triage ranking *quality*, run duration, or cost from these runs
(FR-006 non-claims), and does not touch any client repo (confidentiality gate stands).

## Status

Ready for planning
