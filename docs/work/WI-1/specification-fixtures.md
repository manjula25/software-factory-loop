# Testable Specification — WI-1b: Seeded Target Repo (`loop-fixtures-py`)

## Status

Approved — 2026-09-11, owner. Clarification resolved: all three issues filed at seeding (dormant until WI-2; the dedup check needs real open issues to see).

## Source artifacts

- Issue #1 (`[WI-1] Scaffold harness and prove one bug fixed end-to-end`)
- `harness-prd-v2.md` — Testing Decisions, Decisions from Grilling (2026-09-11) items 6, 8, 9
- `docs/work/WI-1/specification-harness.md` (the harness this repo exercises)

## Functional requirements

### FR-101: A small, real-looking Python project on GitHub

- **Behavior:** `manjula25/loop-fixtures-py` exists on GitHub: a Python package of a few modules (e.g. a small library with a public API — string/text utilities are enough), a pytest suite that runs green on a clean checkout **except** where a seeded bug makes a test fail, installable with `pip install -e .` or equivalent, with its own git history and `main` branch.
- **Source traceability:** Grilling decisions 8–9.
- **Sub-step coverage:** WI-1 checklist item 5.
- **Success criteria:** a clean clone on the WI-1 host machine runs `pip install -e . && pytest` and exits with the expected seeded failures only (see FR-104).
- **Evidence label:** pipeline integration (local Docker; the onboarding pass runs exactly this).
- **Boundary and errors:** no external services, databases, or network dependencies in tests — the fixture must run offline inside a container.
- **Non-claims:** no claim of being a realistic large codebase; smallness is the point (walking skeleton).

### FR-102: Three seeded bugs, three flavors, each with a filed issue

- **Behavior:** three deliberately planted defects, one per flavor:
  - **BUG-1 (simple):** a wrong return value or off-by-one in a pure function; issue = one-paragraph description, no log.
  - **BUG-2 (log-flavored):** a defect whose observable symptom is a crash with a stack trace; its issue attaches that trace as a raw log file (opaque blob, per the PRD's log-handling decision).
  - **BUG-3 (module-sharing):** a defect in the **same module as BUG-1** — exercising the dependency-grouping heuristic's sequential path in a later work item.
  Each bug has a matching issue filed on `loop-fixtures-py`'s GitHub Issues (description, and the log for BUG-2), written as a real user would file them: symptom, expectation, and nothing about the cause.
- **Source traceability:** PRD Testing Decisions (seeded known-buggy repos; non-Node requirement); Grilling decision 9.
- **Sub-step coverage:** WI-1 checklist item 5.
- **Success criteria:** three open issues exist on the repo, one per bug; each bug is reproducible from its issue text alone by a human who has not read the source (spot-check); no issue reveals the fix or the faulty line.
- **Evidence label:** document-level (issue list) + pipeline integration (each bug's failing test).
- **Boundary and errors:** the bugs are independent of each other at the *symptom* level (BUG-1 and BUG-3 share a module but fail different tests); fixing any one must not incidentally fix another.
- **Non-claims:** issues are seeded by us, not by a real reporter — the WI-1 run report and any demo say so explicitly.

### FR-103: WI-1 exercises BUG-1 only, end-to-end

- **Behavior:** the WI-1 harness run processes BUG-1's issue through the full loop: normalization to the internal issue shape → project-profile onboarding (if not already done) → reproduction test written and observed failing (RED) → fix applied in a sandbox on branch `fix/<issue-id>` → fresh-sandbox verification (reproduction test passes AND baseline-diff on the full suite) → PR open on `loop-fixtures-py` with verbatim RED output, GREEN output, and one line mapping the failure to the issue's reported symptom.
- **Source traceability:** PRD Solution, Implementation Decisions (Reproduce-then-fix; Verification; Review and merge gate); Grilling decisions 2, 6, 9.
- **Sub-step coverage:** WI-1 checklist items 6–7 (the exit gate).
- **Success criteria:** at gate time: a PR exists on `loop-fixtures-py`, open and unmerged, whose body contains the RED/GREEN evidence and symptom-mapping line, whose commits carry the FR-005 identity, and whose diff contains both the fix and the reproduction test placed under the target repo's `tests/fixed-issues/` (constraint 4). BUG-2's and BUG-3's issues remain open and untouched.
- **Evidence label:** pipeline integration (local Docker; the PR itself).
- **Boundary and errors:** any verification failure (reproduction test not passing, or new failures vs baseline) means no PR is opened and the run report records the failure — a failed run is a valid WI-1 outcome for the *machinery* diagnosis but does not satisfy the gate.
- **Non-claims:** no claim the fix is *correct* in the human sense — gate is the loop completing with evidence; judging the fix is the human reviewer's act (constraint 1, Grilling 2). No parallel processing, dedup, or budget-cap behavior is exercised (WI-2+).

### FR-104: Baseline recorded in the project profile at onboarding

- **Behavior:** the onboarding pass's project profile, committed to `loop-fixtures-py`, records: language/Python, install command, full-suite command, run-one-test command, the suite's baseline failures (the test names failing on a clean checkout — the seeded bugs' tests), and expected suite duration.
- **Source traceability:** PRD Implementation Decisions (Project understanding); Grilling decision 6.
- **Sub-step coverage:** WI-1 checklist item 6.
- **Success criteria:** the profile file exists in the target repo's history before the fix run; its baseline list matches the actual failing tests on a clean checkout (verifiable by running the suite).
- **Evidence label:** pipeline integration (local Docker).
- **Boundary and errors:** a profile whose baseline does not match a fresh run is stale by definition (PRD's staleness rule): the run aborts and flags re-onboarding rather than computing a wrong diff.
- **Non-claims:** the profile records facts validated by execution only; doc claims that fail execution never enter it (PRD onboarding rule).

## Non-functional constraints

- Python + pytest (satisfies the PRD's non-Node requirement for seeded repos).
- The fixture repo is public-infrastructure only: no secrets, no client-adjacent content (constraint 3 holds trivially here).

## Clarifications

None. Resolved 2026-09-11: all three bug issues are filed on `loop-fixtures-py` at seeding time and stay dormant until WI-2.

Resolved 2026-09-11 (post-seeding): FR-102's "attaches that trace as a raw log file" is
implemented for BUG-2 as an **inline fenced block** in issue #2's body, not a web-UI file
attachment — `gh` cannot upload issue attachments (GitHub exposes no API for it; it is a
web-UI-only feature). The harness normalizer treats the largest fenced block as `attachedLog`,
so the pipeline behavior is identical. True web-UI attachment support (detect a
`user-attachments/assets/...` URL in the body, fetch it — plain GET on public repos, gh-token
GET on private ones — use the content as `attachedLog`) lands in WI-2's normalizer work beside
multi-source ingestion.

## Traceability matrix

| FR | WI-1 checklist item | PRD section |
|---|---|---|
| FR-101 | 5 | Grilling 8–9 |
| FR-102 | 5 | Testing Decisions; Grilling 9 |
| FR-103 | 6–7 | Solution; Reproduce-then-fix; Verification; Grilling 2, 6, 9 |
| FR-104 | 6 | Project understanding; Grilling 6 |

## Approval

- [x] Approved by owner — 2026-09-11 (all three issues filed at seeding)
