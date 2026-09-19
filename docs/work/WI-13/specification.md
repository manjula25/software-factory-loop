# Testable Specification — WI-13 (dependency-aware parallel queue)

## Status

Approved 2026-09-19 (owner invoked `/writing-plans` on the presented draft; FR-002 and FR-005
pin-downs accepted as drafted).

## Source artifacts

- `docs/work/WI-13/prd.md` — grilling record, twelve owner decisions (2026-09-19), the
  requirements source of record for this work item.
- `docs/work/WI-13/slices.md` — four slices carved from the record.
- `harness-prd-v2.md` — as amended 2026-09-19 (user story 8; parallelization; budget control;
  2026-09-15 decisions 1/2/4; out-of-scope line on non-independent issues).
- `CLAUDE.md` — hard constraints 1 (extended) and 5 (amended), 2026-09-19.

## Functional requirements

### FR-001: Planner pass — one call, priority plus dependency edges

- **Behavior:** Every queue run begins with exactly one planning model call over the eligible
  issues, producing (a) a priority ordering and (b) for each issue, the set of issue-ids it is
  blocked by. An issue is blocked by another when its fix depends on a decision, API shape, or
  code state the other's fix will establish, or when both touch the same files/modules. When
  every eligible issue is blocked, the plan includes the single highest-priority candidate.
- **Source traceability:** record decision 8; PRD "Budget control" and "Parallelization,
  dependency-aware" as amended 2026-09-19.
- **Slice coverage:** Slice 1.
- **Success criteria:** A run with multiple eligible issues makes exactly one planning call
  before any fix-agent spend; the admitted ordering and edge set match the plan's output.
- **Evidence label:** harness-source (vitest at the queue module's public seam).
- **Boundary and errors:** A failed, unparseable, or self-inconsistent plan (unknown ids,
  self-edges, cycles among mutually-blocked candidates beyond the all-blocked rule) degrades to
  the deterministic fallback — ascending issue order, no edges, a loud warning on the summary —
  and the run continues. Planning failure never drops an issue and never aborts the run.
- **Non-claims:** The planner is a heuristic; it may miss real dependencies or over-block. It
  is a starting point, not a guarantee of true independence.

### FR-002: Blocked-issue semantics differ by merge mode

- **Behavior:** On auto-merge-opted repos, an issue blocked by issue A is not attempted until
  A has MERGED (the re-plan pass re-evaluates after each merge wave). On non-opted repos, a
  blocked issue starts only after A's lane has completed (PR opened), preserving the
  "human merges in order" posture for potentially-conflicting PRs. In neither mode is a blocked
  issue silently dropped: it is either attempted later in the run or reported as not attempted
  with its blocking reason.
- **Source traceability:** record decisions 4, 8, 9; PRD 2026-09-15 decision 2 as amended
  2026-09-19.
- **Slice coverage:** Slice 2.
- **Success criteria:** With issues A (free) and B (blocked-by-A): opted-in run attempts B only
  after A merges; non-opted run attempts B only after A's PR exists; both report B's status
  honestly when it is never attempted.
- **Evidence label:** harness-source (vitest, queue runner public seam).
- **Boundary and errors:** A blocker that fails its lane leaves its blocked issues not-attempted
  with the reason named; the run continues (issue-level failure, not harness-level).
- **Non-claims:** On non-opted repos, serializing B after A's PR does not make B's branch
  contain A's fix — their PRs may still conflict; that remains the human's merge-order call.

### FR-003: Concurrent execution of unblocked issues

- **Behavior:** All unblocked, budget-admitted issues execute concurrently, each through the
  unchanged per-issue loop (own sandbox, own branch, own reproduction test, own fresh-sandbox
  verification, own PR). Lane outcomes are collected per issue. An issue-level failure in one
  lane never aborts the other lanes.
- **Source traceability:** record decisions 1, 10; PRD user story 4.
- **Slice coverage:** Slice 2.
- **Success criteria:** A run with three independent eligible issues produces three per-issue
  outcomes and up to three PRs; a forced failure in one lane leaves the others' outcomes
  intact in the summary.
- **Evidence label:** harness-source (vitest, queue runner seam) + pipeline-integration
  (slice 4's live run).
- **Boundary and errors:** Sandbox-creation or infrastructure failure in one lane is recorded
  for that issue; if the same infrastructure failure would recur for every remaining issue
  (harness-level class), the run aborts with the partial summary.
- **Non-claims:** No guarantee of wall-clock speedup on a single local Docker host (constraint
  6); concurrency is a scheduling property, not a performance claim.

### FR-004: Stop-the-line failure semantics, unchanged

- **Behavior:** A red canary (post-revert), an uncanaried merge, or any existing harness-level
  failure aborts the run exactly as today: the failing issue's record is collected first, the
  summary reports everything earned (open PRs from other lanes stand as deliverables), and the
  process exits non-zero. No further merges occur after a red canary.
- **Source traceability:** record decision 10; PRD decision 3 (2026-09-15 WI-5 record decision 3).
- **Slice coverage:** Slice 2.
- **Success criteria:** A red canary on lane A's merge halts the run; lanes B/C's already-open
  PRs appear in the summary; no B/C merge is attempted afterwards.
- **Evidence label:** harness-source (vitest, queue runner seam).
- **Boundary and errors:** The abort path reuses the existing queue-abort summary contract;
  nothing new is invented here — the requirement pins that parallelism does not weaken it.
- **Non-claims:** Open PRs from halted lanes are not merged by the harness; a human (or a later
  run) merges them.

### FR-005: Admission — all unblocked by default, explicit optional ceiling

- **Behavior:** Absent `--max-issues`, every unblocked issue the plan surfaced is attempted.
  With `--max-issues N` (validated integer ≥ 1), at most N issues are attempted per run,
  highest priority first. The run prints the surfaced plan (issues to be attempted, blocked
  with reasons) before any fix-agent spend. `--max-issues 1` yields fully sequential behavior.
- **Source traceability:** record decisions 6, 7, 11, 12; PRD user story 8 as amended;
  CLAUDE.md constraint 5 as amended.
- **Slice coverage:** Slice 2.
- **Success criteria:** Absent the flag, a five-unblocked-issue queue attempts all five; with
  `--max-issues 2`, attempts two and reports three not-attempted; the plan line precedes any
  agent invocation in the output order.
- **Evidence label:** harness-source (vitest, CLI/queue seam).
- **Boundary and errors:** An invalid `--max-issues` value remains a startup error before any
  acquisition or spend. The cap counts ATTEMPTED issues; a planned-but-never-attempted
  (blocked) issue costs nothing and does not consume the ceiling.
- **Non-claims:** The ceiling does not bound concurrent API streams within a wave — it bounds
  attempts (there is no lanes knob, record decision 6).

### FR-006: Same-run re-plan after merge waves

- **Behavior:** On opted-in repos, after each merge lands (canary green), the planner re-runs
  over the remaining eligible issues; newly unblocked issues are attempted while attempted-
  budget remains under the ceiling. The loop terminates when the budget is spent or no issue
  is unblocked. On non-opted repos there is no merge event to re-plan on; the single wave's
  ordering rule (FR-002) applies instead.
- **Source traceability:** record decision 9.
- **Slice coverage:** Slice 2.
- **Success criteria:** With A free, B blocked-by-A, on an opted-in repo with no ceiling: A is
  attempted in wave 1; after A merges, the planner runs again and B is attempted — all in one
  run, with exactly two fix-agent attempts total.
- **Evidence label:** harness-source (vitest) + pipeline-integration (slice 4's live run).
- **Boundary and errors:** A failed re-plan degrades per FR-001's fallback. Re-plans are
  bounded: one per merge, never per issue; a run with zero merges makes exactly one plan.
- **Non-claims:** This is dependency-driven issue selection within a run — not the confirmed
  tier's plan-approval/replan loop, which stays out of scope.

### FR-007: Merger agent — opted-in repos only

- **Behavior:** On profiles with `autoMerge: true`, when a verified fix's branch conflicts
  with the current main (because an earlier fix in the run already merged), a merger agent
  resolves the conflicts on that branch. On non-opted repos the merger is never invoked —
  conflicting PRs are left for the human, as today.
- **Source traceability:** record decisions 2, 4; CLAUDE.md constraint 1 as extended.
- **Slice coverage:** Slice 3.
- **Success criteria:** An opted-in run whose second fix conflicts with main invokes the merger
  and proceeds only through FR-008's gate; an identical non-opted run opens the conflicting PR
  with no merger invocation.
- **Evidence label:** harness-source (vitest, loop seam).
- **Boundary and errors:** A failed or conflict-unresolvable merger run leaves the PR open for
  a human with the failure recorded (the existing merge-failure posture: loud note, not an
  issue failure, run continues).
- **Non-claims:** The merger may resolve a conflict wrongly; nothing about its output is
  trusted until FR-008 passes.

### FR-008: Verified merger — the merged result is never trusted

- **Behavior:** After any merger-agent conflict resolution, the branch's merged state must
  pass fresh-sandbox verification (reproduction test + full suite versus the recorded
  baseline) in a sandbox the merger never touched, BEFORE the existing chain proceeds
  (pre-merge diff review → squash-merge → canary → revert/halt/notify → issue close). A
  merger resolution that fails verification is treated as a failed fix attempt: no merge, PR
  stays open, recorded loudly, issue not counted fixed.
- **Source traceability:** record decision 3; CLAUDE.md constraints 1 (extended) and 2.
- **Slice coverage:** Slice 3.
- **Success criteria:** A wrong conflict resolution (suite goes red in the independent sandbox)
  produces no merge, an open PR, and a recorded failure; a correct resolution proceeds through
  the unchanged chain and its canary.
- **Evidence label:** harness-source (vitest, loop seam).
- **Boundary and errors:** Verification infrastructure failure during the merger gate is
  harness-level (abort with partial summary), identical to the existing verification posture.
- **Non-claims:** Even a verified merger resolution can be the wrong root cause — the same
  residual risk every verified fix carries; the opt-in and revert net are the compensating
  controls, not a cure.

### FR-009: CLI surface honesty

- **Behavior:** `--triage` is removed: passing it is a startup error with a message naming its
  replacement (the always-on planner). No new flag enables parallelism. `--max-issues`
  semantics change per FR-005 (optional ceiling, no default).
- **Source traceability:** record decisions 7, 8; PRD 2026-09-15 decision 1 as amended.
- **Slice coverage:** Slices 1–2.
- **Success criteria:** A run invoked with `--triage` fails at startup with the explanatory
  error before any acquisition or spend; the flag inventory in `docs/agents/workflow.md` matches
  the implementation.
- **Evidence label:** harness-source (vitest, CLI seam).
- **Boundary and errors:** All startup validation precedes acquisition, cloning, and sandbox
  spend (existing rule, extended to the new error).
- **Non-claims:** None beyond FR-005's.

### FR-010: Documentation honesty in the same change

- **Behavior:** The CLAUDE.md module table and `docs/agents/workflow.md` repository commands
  reflect the planner/wave/merger surfaces in the same PR that adds them.
- **Source traceability:** CLAUDE.md "What is built so far" honesty rule; record mechanical
  consequences.
- **Slice coverage:** Slice 4.
- **Success criteria:** The merged PR's CLAUDE.md rows name the new surfaces; workflow.md's
  command list matches the shipped CLI flags.
- **Evidence label:** inspection (review record).
- **Boundary and errors:** n/a.
- **Non-claims:** n/a.

### FR-011: Live integration validation

- **Behavior:** One live run against the seeded fixtures repo with multiple open seeded issues
  proves the composed flow end-to-end in Docker: planner output → concurrent lanes → per-issue
  PRs → sequential verified merges (opted-in) → re-plan unblocking a blocked issue → honest
  summary.
- **Source traceability:** record mechanical consequences; PRD testing decisions (integration
  against seeded repos).
- **Slice coverage:** Slice 4.
- **Success criteria:** The live run's recorded output shows the wave/merge/re-plan sequence
  with per-issue PRs and merge commits; evidence filed under `docs/work/WI-13/`.
- **Evidence label:** pipeline-integration (live Docker run, recorded).
- **Boundary and errors:** A harness bug found by the live run goes back through
  `diagnosing-bugs` before delivery; the run is not cherry-picked (failures recorded verbatim).
- **Non-claims:** One successful live run on one Python repo does not prove language
  universality beyond what WI-1's fixture already established.

## Non-functional constraints

- Constraints 2, 3, 4, 6 unchanged and fully enforced (fresh-sandbox verification, the
  confidentiality gate, permanent reproduction tests, local Docker only).
- Constraint 1 as extended 2026-09-19: machine conflict resolution only on opted-in repos,
  behind the verified-merger gate.
- Constraint 5 as amended 2026-09-19: no spend beyond the surfaced plan.
- No lint step exists; none is added.
- Every emitted string (prompts, summaries, comments) passes the secrets guard.

## Clarifications

None — all twelve decisions were resolved interactively in the grilling record; no
`[NEEDS CLARIFICATION]` markers remain.

## Traceability matrix

| FR | Record decision(s) | Slice | Evidence surface |
|---|---|---|---|
| FR-001 planner pass | 1, 8 | 1 | harness-source |
| FR-002 blocked semantics | 4, 8, 9 | 2 | harness-source |
| FR-003 concurrent lanes | 1, 10 | 2 | harness-source + integration |
| FR-004 stop-the-line | 10 | 2 | harness-source |
| FR-005 admission/cap | 6, 7, 11, 12 | 2 | harness-source |
| FR-006 same-run re-plan | 9 | 2 | harness-source + integration |
| FR-007 merger opt-in | 2, 4 | 3 | harness-source |
| FR-008 verified merger | 3 | 3 | harness-source |
| FR-009 CLI honesty | 7, 8 | 1–2 | harness-source |
| FR-010 docs honesty | mech. consequences | 4 | inspection |
| FR-011 live validation | mech. consequences | 4 | pipeline-integration |

## Approval

Pending owner approval (2026-09-19). On approval: `/writing-plans` → `/ponytail` → worktree →
`/implement`.
