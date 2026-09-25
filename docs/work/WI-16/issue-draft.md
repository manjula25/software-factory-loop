# Proposed GitHub issue for WI-16 — NOT YET CREATED

Per `docs/agents/issue-tracker.md`, the tracker is read-only by default and this mutation
executes only with explicit owner authority for the exact change. This file is the prepared
draft; it is not itself an issue.

**Target:** `manjula25/software-factory-loop`
**Title:** `[WI-16] Integration tests: run the harness for real, with a scripted agent`

---

## Body

### Summary

Make the harness's own CLI verifiable by automated test. `main()` in `src/loop.ts` holds every
real `git` and `gh` call the harness makes, and no test executes it — so a wrong subprocess
argument passes the entire suite, because TypeScript checks shapes, not flag semantics. This work
item adds an integration test that runs the harness for real against a real GitHub repository,
substituting only the AI agent for a script.

### Scope (grilling record: `docs/work/WI-16/prd.md` — complete 2026-09-25; specification pending)

1. **An integration harness.** A disposable GitHub repo, reset to a known state before each run
   (branches deleted, PRs closed, main reset), driven through a test-only sandbox image whose
   agent CLI is a script rather than a live model. Real `git`, real `gh`, real PRs, real merges.
2. **Scenario: the reproduce-then-fix flow, end to end.** Closes both this work item's origin
   (nothing executes `main()`) and PRD Testing Decision 3 (seeded repos, at least one in a
   non-Node language) — they are the same test.
3. **Scenario: onboarding**, against two seeded setups, one with docs and one without,
   confirming the recorded commands actually execute (PRD Testing Decision 4).
4. **Scenario: profile staleness** (PRD Testing Decision 5) — a profile whose test command no
   longer matches the code records a failed verification and flags re-onboarding.
5. **It runs in the default gate.** `npm test` will require Docker, network access and GitHub
   auth on every invocation, and will write to the disposable repo. Recorded as a consequence,
   not a surprise.
6. **A recorded decision on PRD Testing Decision 6** — "test external behavior, not internal
   prompt wording" — against the existing prompt-text assertions in `loop.test.ts`.

### Out of scope

Testing Decisions 1 and 2 are already satisfied and are not reworked. No refactor of `main()`; no
file under `src/` should have to move. No agent spend — the scripted agent is what keeps it at
zero. This does **not** replace the live runs and does not claim what they claim: a green
integration test proves the harness's wiring against real GitHub, not that a real model writes a
good fix.

### Decisions

Five recorded in `docs/work/WI-16/prd.md` — four by the owner on 2026-09-25 (real end to end with
only the agent swapped; on every `npm test`; its own disposable repo; the whole Testing Decisions
list in scope), one answered by reading the code rather than deciding (the `--image` seam already
exists, so no production change is needed).

---

## Command to create it, when authorized

```
gh issue create --repo manjula25/software-factory-loop \
  --title '[WI-16] Integration tests: run the harness for real, with a scripted agent' \
  --body-file <path>
```

No labels are applied: the repo's label set carries no work-item taxonomy, and WI-1/WI-2 were
filed without labels.