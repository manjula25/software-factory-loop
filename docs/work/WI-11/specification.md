# Testable Specification — WI-11 (cleanup & docs batch)

## Status

Draft

## Source artifacts

- `docs/work/WI-11/prd.md` — approved carve-out (items 1–6, non-goals, decisions)
- `docs/work/WI-11/slices.md` — slices 1–6, dependency-ordered
- Originating findings: `docs/work/WI-8/implementation-notes.md` (adjacent),
  `docs/work/WI-8/verification.md` (deferred), `docs/work/WI-9/review.md`,
  `docs/work/WI-10/review.md`
- Approved decisions (owner, this session): **(d1)** co-occurring teardown
  failures are carried as two distinct, origin-labeled facts — not a joined
  string; **(d2)** a fail()-path teardown failure rides the existing FAILED
  summary line as a suffix, matching the WI-8 teardown-line precedent;
  **(d3)** branch deletions execute only at delivery under explicit
  authorization naming the branch set, with read-back.

## Functional requirements

### FR-001: Both teardown-failure origins recorded on a merged run

- **Behavior:** When a run that ends in a merge has a teardown failure from
  an early sandbox (baseline preflight or fresh verification) AND a teardown
  failure from the canary teardown, the outcome record carries both reasons
  as distinct origin-labeled facts; neither displaces the other. Every
  rendering surface that names a teardown failure on a merged outcome (queue
  MERGED line, single-issue report lines, the merged-record tuple) names
  each failed origin's reason. When only one origin failed, output is
  unchanged from today's single-failure rendering.
- **Source traceability:** prd item 1 (WI-8 adjacent finding); decision d1.
- **Slice coverage:** Slice 1.
- **Success criteria:** A public-seam test constructs a green auto-merged run
  where both the verification sandbox close and the canary teardown throw
  distinct messages; the observed outcome names both messages, and the
  rendered MERGED summary line names both. Existing tests that pinned the
  overwrite are updated in the same commit.
- **Evidence label:** focused vitest (harness source, `src/loop.test.ts`),
  plus full suite.
- **Boundary and errors:** Recording is bookkeeping only — the merge verdict,
  the revert decision, failure-kind classification, queue-halt behavior, and
  exit codes are byte-identical to today for the same inputs. No new failure
  mode: if teardowns succeed nothing changes at all.
- **Non-claims:** No pipeline (Docker) run is required — this is
  record-shape and rendering precision over already-unit-tested paths.

### FR-002: fail()-path teardown failure recorded on the FAILED line

- **Behavior:** When the verification sandbox's teardown fails on a path
  that ends in a failed issue outcome (verification rejected, install
  failed, or suite output rejected), the teardown failure is recorded beside
  the failure: the queue FAILED line and the single-issue report carry the
  existing failure reason plus a teardown suffix in the established
  `(teardown: <reason>)` shape. The failure reason itself and the
  failure-kind are unchanged.
- **Source traceability:** prd item 2 (WI-8 brief-sanctioned gap); decision d2.
- **Slice coverage:** Slice 2.
- **Success criteria:** A public-seam test constructs a verification-failed
  run whose sandbox close also throws; the observed FAILED line ends with
  the teardown suffix naming the close error. Paths with clean teardowns
  render exactly as today.
- **Evidence label:** focused vitest (harness source), plus full suite.
- **Boundary and errors:** Teardown recording never converts a failure into
  a different failure kind and never affects the exit code beyond what the
  failure itself already causes. The preflight-stale-abort path already
  records its teardown failure and is unchanged.
- **Non-claims:** No change to any green-path or merged-path rendering (that
  is FR-001's territory).

### FR-003: Unified notify vocabulary on the reverted surface

- **Behavior:** On the canary-reverted surface, when no notify handle is
  configured the summary line reads `notify handle not configured` — the
  same vocabulary the uncanaried-merge detail and the queue's reverted line
  already use. When a handle is configured, the rendering (`notify: @handle`
  / `notify: <handle>` per existing surface) is unchanged.
- **Source traceability:** prd item 3 (WI-8 T3 review finding).
- **Slice coverage:** Slice 3.
- **Success criteria:** A public-seam test constructs a reverted outcome
  with no configured handle and pins the unified string; the
  handle-configured rendering (live-observed in WI-10, PR #27 comment +
  summary line) is pinned unchanged in the same commit.
- **Evidence label:** focused vitest (harness source), plus full suite.
- **Boundary and errors:** String-level change only. The @-ping comment
  itself, the halt, and the exit code are untouched.
- **Non-claims:** No behavioral or ordering change on the reverted path.

### FR-004: Code-comment and record hygiene

- **Behavior:** (a) The stale comment in the per-issue loop claiming an
  emission is guarded at its emission site is corrected to reflect that
  guarding happens at the CLI entry. (b) Dated, append-only addenda are
  added to the WI-9 and WI-10 evidence records: citing the RED/GREEN PR
  bodies as durable evidence, and correcting the WI-10 record's
  chain-observation wording plus the WI-9 probe-attribution wording.
- **Source traceability:** prd items 4–5 (WI-8 adjacent; WI-9 review A5,
  cosmetic; WI-10 review A1, M1).
- **Slice coverage:** Slice 4.
- **Success criteria:** Diff shows comment correction (no code change) and
  addendum sections dated 2026-09-19 appended; no existing record text is
  rewritten or deleted.
- **Evidence label:** diff inspection (docs/comment only).
- **Boundary and errors:** None — no executable surface.
- **Non-claims:** Rewriting history or editing past evidence; the addenda
  correct the record by addition only.

### FR-005: CLAUDE.md module-table honesty check

- **Behavior:** After FR-001–FR-003 land, the `src/loop.ts` module row (and
  only if inaccurate, other rows) is checked against the delivered behavior;
  wording is adjusted only where a row became inaccurate. If every row
  remains accurate, this FR is satisfied by recording that check with no
  change.
- **Source traceability:** CLAUDE.md standing rule ("keep this section
  honest … in the same PR that adds a surface").
- **Slice coverage:** Slice 5.
- **Success criteria:** The PR either contains the adjusted row or the
  verification record states the check was performed and no row changed.
- **Evidence label:** diff inspection / verification-record statement.
- **Boundary and errors:** None.
- **Non-claims:** No module-table rewrite beyond accuracy.

### FR-006: Stale-branch cleanup under delivery-time authority

- **Behavior:** The stale fixtures branches (`fix/gh-1`, `fix/gh-2`,
  `fix/gh-3`, `fix/gh-10` on the fixtures origin) and the local
  `worktree-wi-2-trial` branch are deleted, each read back after deletion.
  Deletion happens only during delivery, only after the owner explicitly
  authorizes that exact branch set in this work item's delivery step.
- **Source traceability:** prd item 6; decision d3.
- **Slice coverage:** Slice 6.
- **Success criteria:** Post-deletion `git ls-remote` / branch listing shows
  none of the named branches; the delivery record lists each command,
  result, and read-back.
- **Evidence label:** external read-back (fixtures remote + local branches).
- **Boundary and errors:** If authorization is not given, the branches stay
  and the delivery record marks FR-006 pending — it never blocks the PR.
  No other branch is touched.
- **Non-claims:** No deletion of any live `fix/gh-*` branch the stale-branch
  pass would still tolerate for in-flight work; the named set was chosen
  from the current listing and is re-verified immediately before deletion.

## Non-functional constraints

- No new module, no new dependency, no lint step (none exists — do not
  invent one). All behavior tests at the public seam of `src/loop.ts`;
  never a source-text assertion.
- Hard constraints 1–6 unchanged and untouched by this batch; recording
  precision serves constraint 2's posture (failures loud, never dropped).
- Existing pinned-string tests that pin the old single-field precedence or
  the old vocabulary are updated in the same commit as the behavior change —
  the pin update is sanctioned by this specification, not silent.

## Clarifications

None — the three design decisions (d1 two-origin recording, d2 FAILED-line
suffix, d3 delivery-time branch authority) were approved by the owner this
session.

## Traceability matrix

| FR | prd item | Slice | Originating finding |
|---|---|---|---|
| FR-001 | 1 | 1 | WI-8 implementation-notes (canary-wins precedence) |
| FR-002 | 2 | 2 | WI-8 implementation-notes (fail()-path drop) |
| FR-003 | 3 | 3 | WI-8 T3 review (vocabulary mismatch) |
| FR-004 | 4, 5 | 4 | WI-8 adjacent + WI-9 review A5/cosmetic + WI-10 review A1/M1 |
| FR-005 | — (CLAUDE.md rule) | 5 | Standing module-table honesty rule |
| FR-006 | 6 | 6 | Stale-branch inventory (WI-8 verification deferred list) |

## Approval

Pending owner approval. On approval: `/writing-plans` (skipping
`/to-tickets` per the WI-9/WI-10 precedent — six small slices, one
implementable plan).
