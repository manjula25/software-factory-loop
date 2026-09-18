# WI-6 Specification — auto-merge implementation

**Status:** Approved 2026-09-18 (owner).

## Source artifacts

- `harness-prd-v2.md` — user story 6 (amended), "Review and merge gate" (amended),
  decision records 2 (amended) and 5 (amended), wrong-test guard amendment,
  confirmed-architecture note, out-of-scope note — all as amended by PR #9 (2026-09-18).
- `docs/work/WI-5/prd.md` — the grilling record: eight owner decisions (2026-09-18).
- `docs/work/WI-6/prd.md` — the carve-out (8-row scope table; row 8 partially descopes
  merger-agent conflict resolution by design).
- `docs/work/WI-6/slices.md` — slices 1–7 (dependency-ordered, public-seam verification).
- Hard constraints (CLAUDE.md / PRD), constraint 1 as amended: auto-merge exists **only**
  behind the opt-in flag; the harness's own repository always keeps human merge. All other
  constraints (verification, confidentiality, cap, local Docker, permanent repro tests)
  inherited unchanged and still binding on the auto-merge path.

## Functional requirements

### FR-001 — Opt-in flag and profile field

**Behavior.** Onboarding accepts an `--auto-merge` flag. Passed, the written project
profile records `autoMerge: true`; absent, the field is omitted entirely (never written
false). The field is hand-editable in the profile afterwards — a human can turn a repo
on or off without re-onboarding — and every consumer of the profile reads the field,
never re-deriving it from argv. Default for every repo, including previously onboarded
ones (field absent): auto-merge off, behavior byte-identical to today.

**Source traceability.** PRD user story 6 (amended); WI-5 decision 4; WI-6 prd.md scope
row 1.

**Slice coverage.** Slice 1.

**Success criteria.** Onboarding argv with the flag yields a profile containing
`autoMerge: true`; without it, the serialized profile contains no `autoMerge` key. An
existing profile with the field absent behaves exactly as today wherever the profile is
read. *Evidence: `unit` (vitest at the profile-shaping seam).*

**Boundary and errors.** The flag is accepted only at onboarding; no run-time or
environment override exists in this work item. A hand-set value other than `true`
(e.g. `false`) means off — same behavior as absent.

**Non-claims.** No per-run override, no multiple merge modes, no policy beyond the
single boolean.

### FR-002 — Merged-PR dedup

**Behavior.** Acquisition/dedup treats a **merged** fix PR (token-matched to the issue
id) as "issue done", exactly as an open PR means "issue in flight" today — the issue is
not re-admitted in later runs. The stale-branch rule (a `fix/<id>` branch with no open
PR gets deleted and retried) is re-checked against merged state: a branch whose PR
**merged** must never be deleted-and-retried; a branch whose PR was closed unmerged
keeps today's retry semantics.

**Source traceability.** PRD user story 7; WI-5 mechanical consequences; WI-6 prd.md
scope row 6.

**Slice coverage.** Slice 2.

**Success criteria.** Given issue states (a) open PR exists, (b) merged PR exists,
(c) stale branch + merged PR, (d) stale branch + closed-unmerged PR: (a) skips as
in-flight (unchanged), (b) skips as done, (c) skips — no branch deletion, no retry,
(d) deletes and retries (unchanged). *Evidence: `unit` (vitest at the acquisition/dedup
seam).*

**Boundary and errors.** Token matching uses the same issue-id match as the existing
open-PR dedup — no new matching semantics. This FR is source-agnostic: it applies to
every issue source because fix PRs are always GitHub PRs.

**Non-claims.** No content-based "already fixed" detection; no un-merging; no dedup
against PRs from other tools.

### FR-003 — Mode-conditional PR body

**Behavior.** The generated fix-PR body states the review path that will actually be
taken. On a non-opted repo (auto-merge off): today's wording — a human reviews and
merges — unchanged. On an opted-in repo: the body states the machine gate chain
(pre-merge diff review, automatic squash-merge, post-merge canary with auto-revert),
so a human reading the PR knows merge may already have happened and where the safety
net lives.

**Source traceability.** WI-5 mechanical consequences; WI-6 prd.md scope row 7.

**Slice coverage.** Slice 3.

**Success criteria.** With `autoMerge: true` the PR body contains the gate-chain
wording and not the "a human reviews and merges this" sentence; with the flag off, the
body is unchanged from today. *Evidence: `unit` (vitest asserting both bodies at the
PR-creation seam).*

**Boundary and errors.** Body text is generated at PR creation from the profile mode
in effect for that run; a mid-run profile edit does not rewrite already-open PRs.

**Non-claims.** No templating engine, no localization, no per-issue body variation.

### FR-004 — Squash-merge after gates; safe fallback on failure

**Behavior.** On an opted-in repo, after the existing verification gate passes
(fresh-sandbox repro + full suite, constraint 2 — unchanged) and the FR-009 review
pass approves, the harness squash-merges the fix PR onto the base branch. Merge
failure of any kind — merge conflict, base moved, API error — falls back safely:
**no auto-merge, the PR stays open, the run continues to the next issue**, and the
failure is recorded loudly in the run summary (named error, never silent).

**Source traceability.** PRD "Review and merge gate" (amended); WI-5 decisions 2, 5;
WI-6 prd.md scope rows 2, 8.

**Slice coverage.** Slice 3 (machinery + wiring); review pass supplied by FR-009.

**Success criteria.** On an opted-in repo with verification green and review pass
green: a squash merge commit lands on the base branch referencing the PR. With a
stubbed merge that fails (conflict or error): no merge occurs, the PR remains open,
subsequent queue items still run, and the summary names the failure. On a non-opted
repo the merge machinery is never invoked. *Evidence: `unit` (vitest with a stubbed
merge seam asserting invocation conditions, order relative to verification and review,
and both outcomes).*

**Boundary and errors.** Merge ordering is strictly: verification green → review pass
green → merge → canary (FR-005). Any skipped or failed gate before merge means no
merge. One merged-PR conflict does not abort the run.

**Non-claims.** **Merger-agent conflict resolution is explicitly out of this first
cut** (WI-6 prd.md scope row 8): a conflicted merge is treated as merge failure with
the safe fallback above; agent-side resolution is a named follow-up work item.
Non-opted repos are completely untouched by this FR.

### FR-005 — Post-merge canary

**Behavior.** After every successful auto-merge, the harness runs the full suite —
reproduction tests **and** the complete suite, including all previously-landed
regression tests — against the merged base branch in a **fresh sandbox** (same
freshness discipline as constraint 2). Green: the run proceeds. Red: FR-006.

**Source traceability.** PRD "Review and merge gate" (amended); WI-5 decision 3;
WI-6 prd.md scope row 3.

**Slice coverage.** Slice 4.

**Success criteria.** A merge is followed by a fresh-sandbox full-suite run on the
merged base; the canary result is recorded in the run summary. With a stubbed
fresh-sandbox runner: canary green proceeds to the next issue; canary red triggers
FR-006 behavior exactly. *Evidence: `unit` (vitest asserting the canary runs after
merge, on the merged base, and both outcome wirings); live red/green observation at
FR-010.*

**Boundary and errors.** The canary runs even when the pre-merge verification was
green — the merge itself (conflict resolution semantics of squash, base movement) is
what it guards. A canary that cannot start (sandbox failure) is treated as red.

**Non-claims.** The canary does not bisect, does not diagnose, does not retry; it
judges and reports.

### FR-006 — Canary-red: auto-revert and run halt

**Behavior.** On canary red, the harness reverts the merge commit on the base branch,
**halts the entire queue run** (no further issues are processed — a red main is a
stop-the-line event), and leaves the reverted issue **queued** for a future run (it
is not marked done; FR-002's merged-dedup must not swallow it — reverting restores
the issue to todo state, and the reopened-instrument state must reflect that).

**Source traceability.** PRD "Review and merge gate" (amended); WI-5 decision 3;
WI-6 prd.md scope row 3.

**Slice coverage.** Slice 4.

**Success criteria.** With a stubbed canary returning red: the revert is invoked for
exactly the merge commit just landed, no further queue item is admitted after the
halt, the reverted issue remains eligible for a later run (not deduped away), and the
run exits non-zero. *Evidence: `unit` (vitest on the halt/revert wiring); live
observation at FR-010.*

**Boundary and errors.** Revert failure (conflict reverting, API error) is recorded
loudly and the run still halts and exits non-zero — halt is unconditional on red,
revert is best-effort with a named error if it fails. The halting run's already-open
PRs stay open.

**Non-claims.** No automatic re-attempt of the reverted issue within the same run; no
root-cause analysis of why the canary went red.

### FR-007 — Revert notification

**Behavior.** When FR-006 reverts, the affected audience is notified immediately and
in-band: an @-mention comment is posted on the merged PR naming the person(s) who
need to know, and the run summary carries a loud `⚠️ REVERTED` section identifying
the issue, the merge commit, the revert commit, and the canary failure evidence. The
run's exit code is failing (per FR-006).

**Source traceability.** WI-5 decision 6; WI-6 prd.md scope row 4.

**Slice coverage.** Slice 4.

**Success criteria.** On the red path: exactly one @-mention comment lands on the
merged PR, the summary contains the `⚠️ REVERTED` section with the named identifiers,
and the process exits non-zero. On every non-reverting path: no such comment, no such
section, exit per existing rules. *Evidence: `unit` (stubbed comment seam) + live
observation at FR-010.*

**Boundary and errors.** Comment-posting failure is recorded loudly but does not
un-halt or extend the run — the summary section and exit code still carry the signal.
The mention target is a configured identity, not a hard-coded person.

**Non-claims.** No email/chat channels; no notification on green merges beyond
existing summary lines.

### FR-008 — Issue closing on merge

**Behavior.** Only after the canary is green (FR-005), a **gh-sourced** issue whose
fix PR auto-merged is closed with an evidence comment linking the PR and the canary
result. Spec-doc and plain-list sources are a no-op (nothing external to close).
Canary-red issues are never closed — they were reverted and stay queued (FR-006).

**Source traceability.** WI-5 decision 7; WI-6 prd.md scope row 5.

**Slice coverage.** Slice 5.

**Success criteria.** Green path on a gh-sourced issue: the issue is closed with a
comment naming the merged PR and canary evidence. Green path on a file-sourced issue:
no close action, no error. Red path: no close action even for gh issues. *Evidence:
`unit` (vitest at the close seam, all three cases).*

**Boundary and errors.** Close/comment failure is recorded loudly and does not revert
or halt — the fix is merged and canary-green; closing is bookkeeping. Ordering is
strictly merge → canary green → close; never before the canary.

**Non-claims.** No issue reopening logic, no cross-links beyond the evidence comment,
no closing of issues whose PRs a human merged (human flow unchanged, out of scope).

### FR-009 — Pre-merge diff-review pass

**Behavior.** On opted-in repos only, between verification-green and merge, a
cheap-model review of the PR diff judges the change against the reported issue. The
pass is **blocking**: merge happens only on an explicit approving verdict. Verdict
uncertain, wrong-fix, or reviewer unavailable (API down, budget refusal) → **no
auto-merge, PR stays open for a human, run continues**, with a PR comment recording
why auto-merge was skipped. Non-opted repos: the review pass never runs (no spend).

**Source traceability.** PRD wrong-test guard (amended — "review pass + canary judge"
on opted repos); WI-5 decision 8; WI-6 prd.md scope row 2.

**Slice coverage.** Slice 6.

**Success criteria.** Approving verdict → merge proceeds (FR-004 ordering holds).
Each non-approving verdict (uncertain / wrong / unavailable) → no merge call is made,
the PR remains open, a skip-reason comment is posted, the run continues to the next
issue, and the summary records the skip. *Evidence: `unit` (vitest with a stubbed
reviewer covering all verdict classes) + one `pipeline-integration` live exercise with
the real cheap model, cost recorded.*

**Boundary and errors.** The reviewer sees the diff and issue context only; it cannot
merge, push, or branch. Spend is bounded by one review call per candidate merge. A
verdict that fails to parse counts as uncertain.

**Non-claims.** Not a security review, not a style review, not a replacement for the
fresh-sandbox verification gate; it judges wrong-root-cause / wrong-test risk only.

### FR-010 — End-to-end pipeline integration

**Behavior.** The whole chain, live: seeded buggy fixtures repo onboarded with
`--auto-merge` → issue admitted → fix → verification green → review pass → squash
merge → canary green on main → issue closed with evidence. Plus an observed
canary-red scenario: a merge whose canary fails → revert lands on main → run halts →
@-mention comment posted → `⚠️ REVERTED` summary → non-zero exit → issue stays
queued.

**Source traceability.** WI-6 prd.md evidence expectations; slices 7.

**Slice coverage.** Slice 7.

**Success criteria.** Both scenarios observed end-to-end against the seeded fixtures
repo in local Docker, recorded with commands, outputs, and exit codes in
`docs/work/WI-6/verification.md`. LLM spend limited to at most the one real
cheap-model review exercise (FR-009); the canary-red scenario is constructed without
LLM spend where feasible. *Evidence: `pipeline-integration`.*

**Boundary and errors.** The fixtures repo is the only live target; the harness's own
repository is never auto-merged (constraint 1) and no test may merge into it.

**Non-claims.** No performance claims, no multi-issue throughput claims beyond the
existing cap.

## Non-functional constraints

- **Opt-in is the only door.** Every auto-merge surface in this work item is
  unreachable without `autoMerge: true` in the profile; default repos are
  behavior-identical to today (asserted, not assumed). The harness's own repository
  is never onboarded with the flag and never auto-merges.
- **Constraint 2 unchanged on the auto-merge path:** verification is still the
  fresh-sandbox repro + full suite; the canary is an *additional* fresh-sandbox gate
  after merge, not a substitute.
- **Loud over silent:** every fallback (merge failure, review skip, revert failure,
  close failure) produces a named, recorded outcome — never silent degradation.
- **Spend:** the only new API spend is the per-candidate review call (FR-009) on
  opted repos; cap behavior is unchanged.
- **Local Docker only**; no cloud sandbox.
- **Implementation-neutral:** requirements are stated at public seams (profile field,
  acquisition behavior, PR body content, merge/canary/revert/close ordering and
  observables), not as named modules, classes, or CLI tools.

## Clarifications

None — all eight open decisions were resolved by the owner in grilling (2026-09-18)
and are recorded in `docs/work/WI-5/prd.md`; the one deliberate descope
(merger-agent conflict resolution) is recorded in `docs/work/WI-6/prd.md` scope row 8
and restated in FR-004's non-claims.

## Traceability matrix

| FR | PRD anchor | WI-5 decision | WI-6 prd row | Slice | Evidence label |
|---|---|---|---|---|---|
| FR-001 | US6 (amended) | 4 | 1 | 1 | unit |
| FR-002 | US7 | — (mechanical) | 6 | 2 | unit |
| FR-003 | — (mechanical) | — (mechanical) | 7 | 3 | unit |
| FR-004 | Review-and-merge gate (amended) | 2, 5 | 2, 8 | 3 | unit |
| FR-005 | Review-and-merge gate (amended) | 3 | 3 | 4 | unit + pipeline-integration (FR-010) |
| FR-006 | Review-and-merge gate (amended) | 3 | 3 | 4 | unit + pipeline-integration (FR-010) |
| FR-007 | — (notification) | 6 | 4 | 4 | unit + pipeline-integration (FR-010) |
| FR-008 | — (issue closing) | 7 | 5 | 5 | unit |
| FR-009 | Wrong-test guard (amended) | 8 | 2 | 6 | unit + one live exercise |
| FR-010 | Evidence expectations | — | — | 7 | pipeline-integration |

## Approval

- [x] Owner approved this specification (2026-09-18)
