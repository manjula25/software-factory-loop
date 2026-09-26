# WI-16 GitHub issue — the draft, the filing, and the applied amendment

**Filed:** 2026-09-25 as [`manjula25/software-factory-loop#23`](https://github.com/manjula25/software-factory-loop/issues/23),
under explicit owner authority, from the draft below. Verify with:

```
gh issue view 23 --repo manjula25/software-factory-loop
```

**Target:** `manjula25/software-factory-loop`
**Title:** `[WI-16] Integration tests: run the harness for real, with a scripted agent`

---

## Amendment — applied 2026-09-25, under owner authority

D2 was reversed after #23 was filed ("split it" — see `prd.md`). Three parts of the filed body
went stale, and a wrong claim left standing on the tracker is a wrong answer, not a historical
one:

- **Scope item 5** says *"It runs in the default gate. `npm test` will require Docker, network
  access and GitHub auth on every invocation, and will write to the disposable repo."* Under the
  reversal that is false: `npm test` is unchanged and offline, and the scenarios have their own
  command. This is the substantive correction.
- **The Scope heading** says *"specification pending"*; the specification now exists as a draft,
  `docs/work/WI-16/specification.md`, FR-001…FR-013.
- **The Decisions section** repeats *"on every `npm test`"* in its list of owner decisions.
- *(Found while writing this section, not at the outset — the first draft of this amendment named
  only two, and the third is the one a reader would hit first.)*

Per `docs/agents/issue-tracker.md` the tracker is read-only by default, so the corrected body was
prepared first and applied only on the owner's explicit authority for this exact change:

```
$ gh issue edit 23 --repo manjula25/software-factory-loop --body-file /tmp/wi-16-issue-body-v2.md
https://github.com/manjula25/software-factory-loop/issues/23
```

**Read back, not assumed** — the policy requires the write be verified rather than trusted:

```
$ gh issue view 23 --repo manjula25/software-factory-loop --json body -q .body | grep -nE "^5\.|on every"
11:5. **It runs as its own command.** … **Nothing runs the scenarios automatically** — this
    repository has no CI and no hook** — so the trigger is the verification stage, and that limit
    is recorded as a non-claim rather than papered over.
20:Five recorded in `docs/work/WI-16/prd.md` — four by the owner on 2026-09-25 (… **its own
    command, not the default gate** — decided "on every `npm test`" and reversed the same day; …)
```

No clause claiming the scenarios run in the default gate survives. The text below is kept as the
record of what was filed and what each replacement said.

The replacement text applied for item 5:

> 5. **It runs as its own command.** The scenarios get a dedicated command on the pipeline-
>    integration surface, listed in `docs/agents/workflow.md`; `npm test` stays fast, offline and
>    unchanged. **Nothing runs the scenarios automatically** — this repository has no CI and no
>    hook — so the trigger is the verification stage, and that limit is recorded as a non-claim
>    rather than papered over.

The replacement text applied for the Scope heading:

> ### Scope (grilling record: `docs/work/WI-16/prd.md` — complete 2026-09-25; specification:
> `docs/work/WI-16/specification.md` — draft, FR-001…FR-013)

---

## The body as filed

### Summary

Make the harness's own CLI verifiable by automated test. `main()` in `src/loop.ts` holds every real `git` and `gh` call the harness makes, and no test executes it — so a wrong subprocess argument passes the entire suite, because TypeScript checks shapes, not flag semantics. This work item adds an integration test that runs the harness for real against a real GitHub repository, substituting only the AI agent for a script.

### Scope (grilling record: `docs/work/WI-16/prd.md` — complete 2026-09-25; specification pending)

1. **An integration harness.** A disposable GitHub repo, reset to a known state before each run (branches deleted, PRs closed, main reset), driven through a test-only sandbox image whose agent CLI is a script rather than a live model. Real `git`, real `gh`, real PRs, real merges.
2. **Scenario: the reproduce-then-fix flow, end to end.** Closes both this work item's origin (nothing executes `main()`) and PRD Testing Decision 3 (seeded repos, at least one in a non-Node language) — they are the same test.
3. **Scenario: onboarding**, against two seeded setups, one with docs and one without, confirming the recorded commands actually execute (PRD Testing Decision 4).
4. **Scenario: profile staleness** (PRD Testing Decision 5) — a profile whose test command no longer matches the code records a failed verification and flags re-onboarding.
5. **It runs in the default gate.** `npm test` will require Docker, network access and GitHub auth on every invocation, and will write to the disposable repo. Recorded as a consequence, not a surprise.
6. **A recorded decision on PRD Testing Decision 6** — "test external behavior, not internal prompt wording" — against the existing prompt-text assertions in `loop.test.ts`.

### Out of scope

Testing Decisions 1 and 2 are already satisfied and are not reworked. No refactor of `main()`; no file under `src/` should have to move. No agent spend — the scripted agent is what keeps it at zero. This does **not** replace the live runs and does not claim what they claim: a green integration test proves the harness's wiring against real GitHub, not that a real model writes a good fix.

### Decisions

Five recorded in `docs/work/WI-16/prd.md` — four by the owner on 2026-09-25 (real end to end with only the agent swapped; on every `npm test`; its own disposable repo; the whole Testing Decisions list in scope), one answered by reading the code rather than deciding (the `--image` seam already exists, so no production change is needed).

### The Decisions section, as it was corrected in the same edit

Stale in one clause: *"on every `npm test`"* became *"as its own command, with the default gate
unchanged"*. The replacement text applied:

> ### Decisions
>
> Five recorded in `docs/work/WI-16/prd.md` — four by the owner on 2026-09-25 (real end to end with
> only the agent swapped; **its own command, not the default gate** — decided "on every `npm test`"
> and reversed the same day; its own disposable repo; the whole Testing Decisions list in scope),
> one answered by reading the code rather than deciding (the `--image` seam already exists, so no
> production change is needed).

---

## Why no labels

The repo's label set (`bug`, `documentation`, `enhancement`, …) carries no work-item taxonomy, and
WI-1/WI-2 were filed without labels.