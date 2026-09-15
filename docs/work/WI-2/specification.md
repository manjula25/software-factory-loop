# Testable Specification — WI-2: Queue Ingestion

## Status

Approved — 2026-09-15, owner ("proceed with WI-2 as expected"). Revised earlier the same
day after adversarial review and a grilling pass (decisions recorded in `prd.md`).

## Source artifacts

- Issue #3 (`[WI-2] Queue ingestion: queue + dedup + cap + triage + sequential runs`,
  filed 2026-09-15 after spec approval)
- `docs/work/WI-2/prd.md` (approved carve-out, 2026-09-14; extended 2026-09-15 — thirteen
  owner decisions including the grilling pass against Sandcastle's template code and the
  agent market)
- `docs/work/WI-2/slices.md` (5 slices)
- `harness-prd-v2.md` — User Stories 1, 7, 8, 11; Implementation Decisions (Issue
  ingestion, Dedup, Budget control); Decisions from Grilling items 4–5; Testing Decisions
- `docs/work/WI-1/specification-harness.md` — the per-issue loop this item wraps (its
  constraints are inherited, not restated)
- Sandcastle 0.12.0 template source (installed package, `dist/templates/`) and market
  survey 2026-09-15 — evidence base for grilling decisions 9–13

## Functional requirements

### FR-001: Queue acquisition from GitHub Issues

- **Behavior:** given a target repo, the harness lists its open issues via `gh` — filtered
  by an optional `--label` flag when given (e.g. `--label bug`), all open issues otherwise —
  and normalizes every one through the existing issue normalizer into the internal shape
  `{ id, description, attachedLog?, sourceType }`. The per-issue fix step receives items of
  exactly the shape WI-1 already consumes — it never branches on how the issue was acquired.
- **Source traceability:** PRD L3, L35, User Story 1 (GitHub subset); carve-out §In scope 1,
  scope decision 5.
- **Slice coverage:** Slice 1.
- **Success criteria:** a vitest case feeds a stubbed `gh issue list` payload (multiple
  issues, one with an attached log, one without) and asserts the normalized list has the
  required shape for every entry, with `attachedLog` present iff the source issue carried
  one. A second case asserts the label flag is passed through to `gh` when given and
  omitted when not. A queue-acquisition failure (non-zero `gh` exit) is a named run error,
  distinct from an empty queue, which is a named no-op outcome.
- **Evidence label:** harness source (`src/`, vitest).
- **Boundary and errors:** GitHub Issues is the *only* source in WI-2; spec-doc and
  plain-list sources are WI-3+ and no code path accepts them. Closed issues are not
  acquired. No network call happens outside the `gh` invocation. Acquisition is bounded by
  a single documented `gh issue list` page (its default limit; no pagination in WI-2) —
  this bound is what caps downstream triage cost, so a large backlog cannot produce
  unbounded scoring spend. No claim is made that unlabeled non-bug issues (questions,
  feature requests) are detected or excluded — the label flag is the curation mechanism;
  without it, whatever is open is queued.
- **Non-claims:** no claim that issue bodies are pre-processed beyond what the existing
  normalizer does; attachment *URLs* found in bodies are passed through as text (fetching
  them is WI-3).

### FR-002: Dedup — skip issues already in flight

- **Behavior:** before any spend on an issue, the harness checks whether an **open PR**'s
  head branch is `fix/<id>` or its body references the issue by exact id token — the PRD's
  own in-flight signal. A match marks the issue *skipped-duplicate*; it gets no sandbox, no
  agent run, no branch, no PR. A `fix/<id>` branch that exists *without* an open PR is a
  stale remnant of a failed or interrupted attempt: it is deleted, and the issue stays
  eligible for retry.
- **Source traceability:** PRD L21 (User Story 7), L43, L104; carve-out §In scope 4, scope
  decisions 4 and 11.
- **Slice coverage:** Slice 2.
- **Success criteria:** a vitest case stubs the branch/PR listing so one queued issue has
  an open PR and is skipped, while a second has only a stale branch (no PR) and proceeds to
  normal processing with the stale branch deleted first; skipped issues never reach sandbox
  creation (asserted on the injected-deps recorder). A second case seeds the matching with
  a `gh-1` reference while querying issue `gh-11` and asserts it is **not** matched —
  exact-token identity, no substring.
- **Evidence label:** harness source (`src/`, vitest).
- **Boundary and errors:** identity is existence-based only (head branch name / exact id
  token); two different issues reporting the same underlying bug are **not** detected (no
  content matching — carve-out scope decision 4). A branch/PR listing failure aborts the
  run before any spend rather than guessing. A *merged* PR whose issue remained open is not
  a duplicate — the issue is re-attempted, and since the fix already landed on main, the
  run is expected to fail its reproduction gate (a test that passes immediately proves
  nothing); that outcome surfaces as an ordinary failed issue, not a crash. Two queue runs
  started concurrently on the same repo can race past this check (checked once, at queue
  build) — out of scope, manual trigger assumed single-operator.
- **Non-claims:** no claim the check is authoritative about *what* the open PR contains —
  only that work on the issue already exists and a human has not merged it.

### FR-003: Budget cap, deterministic by default, AI ranking opt-in

- **Behavior:** a queue run admits at most `cap` issues for processing, where `cap` is a
  CLI flag (`--max-issues`, POC default 3, validated ≥ 1). The default admission order is
  **deterministic** — the first `cap` issues in ascending issue-number order, no model
  call involved (Sandcastle's cheap-by-default shape; its templates carry no priority
  scoring at all, only a hard iteration bound). An optional `--triage` flag enables AI
  ranking: when set **and** the deduped queue exceeds the cap, a scoring pass — the run's
  already-resolved provider and model, given a short scoring prompt per issue — returns
  per-issue priority scores **and the files each issue likely touches**, validated with a
  Zod schema (decisions 14–15; Sandcastle's `Output.object` pattern). Admission walks the
  ranked list (score descending, ties by ascending issue number) and **defers** an issue
  whose file set overlaps an already-admitted issue's — the sequential-execution
  translation of Sandcastle's dependency graph. Issues beyond the cap or deferred for
  overlap are reported as not-admitted with the reason named; the harness never silently
  processes more. Triage input is bounded by the FR-001 acquisition limit, so scoring
  spend has a ceiling independent of backlog size.
- **Source traceability:** PRD L22 (User Story 8), L47; carve-out §In scope 2–3, scope
  decisions 3, 7, 9, 14, and 15.
- **Slice coverage:** Slice 3.
- **Success criteria:** vitest cases assert (a) an over-cap queue **without** `--triage`
  admits exactly `cap` issues in ascending issue-number order with **no** scoring call
  invoked; (b) an over-cap queue **with** `--triage` invokes the scoring call, admits
  exactly `cap` issues, and orders them by returned score; (c) an under-cap queue admits
  everything without invoking triage even when the flag is set; (d) nothing beyond the cap
  reaches sandbox creation; (e) triage output that fails Zod validation does not abort —
  the run admits the deterministic order and emits a loud warning naming the fallback;
  (f) a `--max-issues` value below 1 is a startup configuration error; (g) under
  `--triage`, an issue whose reported files overlap an already-admitted issue's files is
  deferred — reported as not-admitted naming the overlap — and never reaches sandbox
  creation, while a *non*-overlapping issue is admitted in its ranked position. The triage
  prompt and its output pass through the existing secrets guard like every other emitted
  string.
- **Evidence label:** harness source (`src/`, vitest).
- **Boundary and errors:** the cap and triage apply to *queue mode* only — an explicit
  `--issue N` run is a single-issue override that skips cap and triage entirely (the user
  named the issue; there is nothing to choose), while dedup still applies (an open PR on it
  is still a real duplicate — scope decision 6). Triage scores choose *between* issues;
  they never gate an individual issue as "not worth fixing" — an issue not admitted is a
  cap or overlap-deferral decision, reported, not a judgment recorded anywhere persistent.
  File-overlap deferral exists only under `--triage` (that is the only pass with file
  knowledge); the deterministic default accepts same-module conflicts per decision 10.
  The deterministic
  fallback on triage failure is a documented degradation with a warning, never a silent
  one.
- **Non-claims:** no claim of triage quality; the ranking is a cheap heuristic prompt,
  same model as the fix agent (scope decision 3). PRD constraint 5's "triaged by priority"
  is satisfied as "capped and ordered — deterministically by default, priority-ranked when
  `--triage` is requested" (scope decision 9). No per-run cost accounting is added in WI-2
  (PRD User Story 11's "cost spent" stays deferred).

### FR-004: Sequential multi-issue execution

- **Behavior:** admitted issues are processed one at a time, in admission order, each
  through the full WI-1 per-issue path (baseline preflight, fix sandbox, fresh-sandbox
  verification, PR). An individual issue that fails — for any reason WI-1 already treats
  as failure — is recorded as failed, its branch cleanup runs per WI-1 behavior, and
  processing continues with the next issue. No issue's failure aborts the queue.
- **Source traceability:** PRD L22; carve-out §In scope 5, scope decision 2.
- **Slice coverage:** Slice 4.
- **Success criteria:** a vitest case at the injected-deps seam drives a three-issue queue
  where the second issue fails verification and asserts: issues 1 and 3 complete their full
  per-issue path, issue 2's fix branch is deleted, and exactly two PRs are opened. Only one
  fix sandbox exists at a time (sequential — asserted by ordering on the recorder).
- **Evidence label:** harness source (`src/`, vitest).
- **Boundary and errors:** a failure that indicates harness-level misconfiguration
  (missing credentials, bad provider) still aborts the whole run at startup — per-issue
  continuation applies to *issue-level* failures only. The WI-1 baseline-staleness abort
  is harness-level (the profile is wrong for every issue) and aborts the queue.
- **Non-claims:** no parallelism, no dependency-aware grouping (deferred; carve-out scope
  decision 2). No claim that sequential processing avoids logical interference between
  issues touching the same module — that risk is exactly what the dependency-grouping item
  will address.

### FR-005: End-of-run summary

- **Behavior:** when the queue is exhausted, the harness prints one summary: issues
  attempted, fixed, failed, skipped-duplicate, not-admitted (each with its reason — the
  cap, or a file-overlap deferral), and the URL of every PR opened by this run.
- **Source traceability:** PRD L25 (User Story 11, minus cost); carve-out §In scope 5.
- **Slice coverage:** Slice 5.
- **Success criteria:** vitest case asserts the summary line counts match a stubbed
  mixed-outcome queue and that every opened-PR URL appears; the summary text passes the
  secrets guard.
- **Evidence label:** harness source (`src/`, vitest).
- **Boundary and errors:** the summary derives from per-issue outcomes only — no new state,
  no persistence. A run that aborts at startup prints its abort reason, not a summary.
- **Non-claims:** no cost figure, no machine-readable report file, no notification — plain
  run output only.

### FR-006: End-to-end queue run against the fixtures repo

- **Behavior:** real invocations of queue mode against `manjula25/loop-fixtures-py` in
  local Docker exercise FR-001–FR-005 as one chain, and must include at least one run
  where the cap is smaller than the deduped queue, so triage and admission fire live —
  not only under unit stubs.
- **Source traceability:** PRD Testing Decisions (integration against seeded repos,
  non-Node target); carve-out §In scope 1–5, scope decision 8.
- **Slice coverage:** Slices 1–5, integrated.
- **Success criteria:** the recorded runs show (a) the queue acquired and issues already
  covered by an open PR skipped as duplicate, with the summary matching observed PR state;
  (b) a cap-forcing run — e.g. `--max-issues 1` against a deduped queue of two or more —
  where deterministic admission visibly selects the first issue, exactly one issue is
  processed, and the not-admitted issues are reported with the cap named; and (c) the same
  cap-forcing shape with `--triage`, where the scoring pass runs and its chosen issue is
  the one processed.
- **Evidence label:** pipeline integration (local Docker, fixtures repo).
- **Boundary and errors:** with fixtures PRs #5/#6/#7 open, a plain queue run's expected
  outcome is an all-duplicates skip — that run proves acquisition, dedup, and summary. The
  cap-forcing run requires at least two issues *without* open PRs; preparing that state
  (closing the unmerged fixtures PRs and deleting their branches — the bugs remain on
  main, so the issues stay valid fix targets — or seeding new issues) is an execution-time
  decision recorded in the verification notes, not a spec requirement.
- **Non-claims:** no claim about run duration, model cost, or triage accuracy from one
  live run.

## Non-functional constraints

- Local Docker only (repo constraint 6). No new sandbox provider, no cloud path.
- All hard constraints 1–6 inherited unchanged; in particular the cap (constraint 5) is now
  *enforced by code*, not just policy.
- Secrets: every newly emitted string (triage prompt, triage output, summary) passes the
  existing secrets guard; error messages name keys, never values.
- Provider selection stays registry-driven; triage introduces no provider name of its own
  (Grilling decision 4).
- TypeScript; vitest at public seams; pipeline integration via local Docker against the
  fixtures repo.

## Clarifications

None open — thirteen decisions are settled and recorded in `prd.md`: the original four
scope questions (2026-09-14), four from the adversarial spec review (2026-09-15), and five
from the grilling pass against Sandcastle's template code and the wider agent market
(2026-09-15: deterministic-default ordering with opt-in `--triage`; accepting merge-time
conflicts; no run-record file with open-PR-primary dedup and stale-branch cleanup; adopting
Sandcastle's practices except machine merge; recording plan-approval-gated auto-merge as a
future direction).

Deferred, recorded not blocked: attachment-URL fetch and spec-doc/plain-list sources (WI-3);
parallelism and dependency grouping (later item, per grilling decision 10); content-matching
dedup (not planned); per-run cost accounting (later, needs provider-side usage data);
pagination beyond one `gh issue list` page (WI-2 takes the default limit; revisit if a real
backlog exceeds it); plan-approval-gated autonomy with machine merge (future direction,
grilling decision 13 — requires its own grilling pass and PRD change).

## Traceability matrix

| FR | Slice | PRD anchor | Carve-out § |
|---|---|---|---|
| FR-001 | 1 | L3, L35, US-1 | In scope 1, decision 5 |
| FR-002 | 2 | L21 (US-7), L43, L104 | In scope 4, 6; decisions 4, 11 |
| FR-003 | 3 | L22 (US-8), L47 | In scope 2–3; decisions 3, 6, 7, 9, 14, 15 |
| FR-004 | 4 | L22 | In scope 5, decision 2 |
| FR-005 | 5 | L25 (US-11) | In scope 5 |
| FR-006 | 1–5 | Testing Decisions | In scope 1–5, decision 8 |

## Approval

- [x] Approved by owner — 2026-09-15 ("proceed with WI-2 as expected"; this approval also
  covers `docs/work/WI-2/prd.md` and `docs/work/WI-2/slices.md`, its source inputs)
