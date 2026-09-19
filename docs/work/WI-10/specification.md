# Testable Specification — WI-10 (red-canary/revert live proof)

## Status

Approved (owner, 2026-09-19 — including all three flagged design decisions:
one re-drive on a mistimed push; single-issue override mode; stop at the
revert)

## Source artifacts

- `docs/work/WI-10/prd.md` (carve-out; PRD of record `harness-prd-v2.md`
  wins on any disagreement — user story 6 amendment, "Review and merge
  gate", implementation decision 5)
- `docs/work/WI-10/slices.md` (3 dependency-ordered slices)
- Evidence base: `docs/work/WI-9/verification.md` (happy path + deferral
  live on the delivered tree; its remaining-risks section names exactly
  this gap), `docs/work/WI-6/verification.md` T7 (the opt-in chain's
  red-canary path live with the LLM stubbed — the boundary this work item
  removes)

## Functional requirements

### FR-001: One dormant bug, its issue, and a prepared conflicting test

- **Behavior:** One new buggy function lands in
  `manjula25/loop-fixtures-py`'s `main` with one open self-authored issue
  in the WI-1 style; the committed suite stays green and the profile
  baseline matches a fresh run. Separately, a conflicting-test commit is
  prepared locally (not pushed): a new test file pinning the current
  buggy behavior, so a correct fix makes it fail on merged main while the
  fix branch (which does not contain it) stays green.
- **Source traceability:** Carve-out scope 1; slice 1.
- **Slice coverage:** 1.
- **Success criteria:** Issue open and the only eligible issue; fresh
  clean clone of `main` runs the committed suite green at the profile
  baseline count; the defect is hand-reproducible and uncovered by any
  committed test; the prepared conflicting-test commit exists locally,
  is shown to pass against the buggy `main`, and is absent from origin.
- **Evidence label:** Runtime/external evidence (fixtures repo state via
  gh/git, fresh-clone suite run, preflight MATCH).
- **Boundary and errors:** Zero LLM spend except one ledgered agent probe
  (environment precondition). No client data (constraint 3).
- **Non-claims:** The seed is not a language-coverage claim; the repo
  stays the existing Python/pytest fixtures project.

### FR-002: One live run drives the red-canary compensating controls

- **Behavior:** The harness runs live against the fixtures repo on the
  delivered tree with a real fix run (no stubs) on the seeded issue. The
  orchestrator pushes the conflicting test to fixtures `main` inside the
  fix-agent window — after the fix branch's base is pinned, before the
  merge. The observable chain: acquisition/dedup → real fix run writing a
  born-red reproduction test and a fix → fresh-sandbox verification green
  (the conflicting test is not on the branch) → PR with RED/GREEN
  evidence → pre-merge diff review approval → squash merge (clean: the
  conflicting test is a new file) → canary suite on merged main **red**
  → auto-revert of the merge on `main` → run halt → @-mention
  notification on the merged PR.
- **Source traceability:** Hard constraints 1, 2, 6; PRD user story 6
  amendment and "Review and merge gate" (red → auto-revert, run halt,
  immediate @-mention); carve-out scope 2; slices 2–3.
- **Slice coverage:** 2 (the run), 3 (the record).
- **Success criteria:** The run log (captured verbatim) shows the
  verification-green merge followed by a red canary, the revert, the
  halt, and the notification; fresh gh read-backs confirm a revert commit
  on fixtures `main` whose tree contains the conflicting test but not the
  fix; the merged PR carries the @-notify comment; the issue remains
  open; the push's timing relative to the run phases is recorded. On a
  mistimed push, Clarification 1's budget governs the re-drive.
- **Evidence label:** Runtime/external evidence (live Docker + gh run;
  the verbatim log is the primary artifact).
- **Boundary and errors:** Local Docker only (constraint 6). If the run
  fails inexplicably, the PRD's strong-model re-run rule applies and is
  recorded. The harness repository itself is never the run target
  (constraint 1). A mistimed push is recorded with its observable
  symptom, never silently retried past the approved budget.
- **Non-claims:** The uncanaried-merge and teardown-failure surfaces are
  not exercised (unit evidence from WI-7/WI-8 stands). The red canary is
  induced by a real race manufactured deterministically — not a naturally
  occurring developer mistake — and the record says so.

### FR-003: Spend is exactly the planned budget, visibly

- **Behavior:** Total agent spend equals one probe plus the fix runs
  actually driven (one on success; up to the Clarification-1 cap on a
  mistimed push). No triage pass is spent (single-issue mode per
  Clarification 2). Any strong-model retry under the PRD rule is named
  with its reason.
- **Source traceability:** Hard constraint 5; PRD implementation decision
  3; carve-out scope 2; slice 2.
- **Slice coverage:** 2, 3.
- **Success criteria:** The verification record accounts every
  agent-bearing invocation with its trigger; the count matches the
  approved budget with zero unaccounted invocations.
- **Evidence label:** Runtime evidence (run-log accounting cross-checked
  against the record).
- **Boundary and errors:** The capped-admission machinery enforces the
  per-run cap; no re-drive beyond the approved budget without owner
  approval.
- **Non-claims:** Invocation counts, not cost figures.

### FR-004: Defects and the record

- **Behavior:** Any harness defect the live run exposes is fixed in-loop
  via the normal TDD path and recorded with its live symptom (WI-9
  FR-004 precedent); a fix beyond repair scope goes back through the
  lifecycle. The verification record states exactly what the reverted
  surface now claims live on the current tree and what remains
  unit-evidence-only.
- **Source traceability:** Carve-out scope 3; WI-1 precedent; hard
  constraint 2; slice 3.
- **Slice coverage:** 2 (defect fixes), 3 (the record).
- **Success criteria:** Each surfaced defect has a committed
  failing-test-first fix with fresh gates green at the delivered
  candidate; `verification.md` records the reverted-surface live claim
  with run evidence, the end-state read-backs, and honest non-claims.
- **Evidence label:** Harness-source unit tests at the public seam
  (defect fixes) + runtime/external evidence (the run and read-backs).
- **Boundary and errors:** No silent scope expansion; post-revert
  fixtures-repo state is recorded, not tidied.
- **Non-claims:** "No defects exist" is not claimed — only that none
  remain unrecorded.

## Non-functional constraints

- Hard constraints 1–6 (CLAUDE.md) unchanged and actively exercised where
  named: constraint 1 (opt-in chain on the fixtures repo only; this repo
  never auto-merges itself), constraint 2 (fresh-sandbox gates live),
  constraint 3 (self-authored synthetic data), constraint 5 (FR-003's
  budget), constraint 6 (local Docker).
- No lint surface exists; none is added. `docs/agents/workflow.md`'s
  command list stays authoritative.
- No public-seam signature changes are planned; any defect fix that needs
  one goes back through the lifecycle per FR-004's boundary.

## Clarifications

Three design forks, all decided by the owner 2026-09-19:

(a) **One re-drive on a mistimed push; total cap 1 probe + up to 2 fix
runs.** If the conflicting-test push lands too early (the branch
verification sees it → fix fails) or too late (the merge already canaried
green → the window was missed), the orchestrator re-prepares and re-runs
once. A second mistiming ends the work item with the honest failure
recorded — no third attempt (mirrors WI-9 decision (b)'s bounded-runs
posture).

(b) **Single-issue override mode (`--issue <n>`).** Deterministic target,
no triage spend, minimal timing window. Queue mode and triage are already
live-proven by WI-9 and add nothing here.

(c) **Stop at the revert.** The revert is the success evidence: the issue
stays open, the conflicting test stays on reverted `main`, and no
follow-up fix invocation runs in this work item — that is explicitly
future work, not claimed here (WI-9 Clarification (a) posture: the work
item does not re-drive past a legitimately red canary).

## Traceability matrix

| FR | Slice | Carve-out section | Key traced source |
|---|---|---|---|
| FR-001 | 1 | 1 | PRD seeded-repo decision; WI-1 issue style |
| FR-002 | 2, 3 | 2 | Hard constraints 1/2/6; PRD user story 6 amendment |
| FR-003 | 2, 3 | 2 | Hard constraint 5; PRD decision 3 |
| FR-004 | 2, 3 | 3 | WI-1 live-defect precedent; constraint 2 |

## Approval

Approved by the owner, 2026-09-19 (all three design decisions above
included). Next per the lifecycle: `writing-plans`.
