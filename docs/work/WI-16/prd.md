# WI-16 — Cover the CLI entry (the A-2 gap)

**Status: GRILLING IN PROGRESS.** D1 and D2 are settled by the owner (2026-09-25); D3–D5 are
open and listed under `## Open decisions`, each with a recommendation. This record is filled in
as they are answered, the way `docs/work/WI-13/prd.md` was.

## Origin

Finding **A-2** from the adversarial review kept as evidence at
`docs/work/reports/harness-adversarial-review.md`, raised by the owner 2026-09-25 with the
direction to "write A-2 up as a work item".

A-2 in one sentence: **`main()` in `src/loop.ts` holds every real `git` and `gh` closure the
harness runs, and no automated test executes it** — so a wrong subprocess argument passes the
whole suite, because TypeScript checks shapes, not `gh` flag semantics.

A-2 is recorded there as SIGNIFICANT and explicitly *not* closable by a docs edit. This work
item is the closure. The review's own words: "Closing it means an automated integration test
that executes the CLI against a seeded repo, which is a work item with the repo's full
lifecycle (grilling → spec → tickets → plan → implement), not a patch."

**Traceability.** The requirement is already in the plan of record — this is not new product
scope. `harness-prd-v2.md` § Testing Decisions asks for integration testing against "a small
number of seeded, known-buggy example repos", and asks to "Test only external behavior (does
the right test get written, does the right branch get created, does verification actually
re-run rather than trusting cached state), not internal prompt wording." WI-16 is the piece of
that decision that is currently unmet for the CLI entry specifically.

## Verified facts (commands run 2026-09-25, at `ab58d5d`)

Facts only — looked up, not assumed. Each is re-runnable.

**1. `main()` is 358 lines and is the only place the real subprocess closures live.**

```
$ grep -n "async function main" src/loop.ts     → 2587
$ awk 'NR>=2587 && /^}/ {print NR; exit}' src/loop.ts  → 2944
$ sed -n '3015p' src/loop.ts
const isDirectRun = process.argv[1] && resolve(process.argv[1]).endsWith("src/loop.ts");
```

`main()` is **not exported**. The entry guard at `src/loop.ts:3015–3025` is what runs it, so it
executes only when the file is *run*, never when it is imported.

**2. No test calls it.** The loop *logic* is thoroughly tested behind injected fakes; the
implementations injected into it are not tested at all.

```
$ grep -rn "main(" src/*.test.ts   → (no matches for the harness's own entry)
```

Tests do use `execFileSync` — `queue.test.ts:280,318` and `loop.test.ts:1492` — but only to
build **real git repositories in `/tmp` as fixtures**. That is a genuine strength worth naming:
the suite is not fakes-only. It is simply not a test of the harness's own git/gh wiring.

**3. Every subprocess in `main()` resolves its binary through `PATH`.** This is the fact that
makes a cheap test possible, and it is the single most important input to decision D1:

```
$ awk 'NR>=2587 && NR<=3030' src/loop.ts | grep -c "execFileSync("
26
$ awk 'NR>=2587 && NR<=3030' src/loop.ts | grep "execFileSync" | head -3
    ghRepo = execFileSync(
      execFileSync("gh", ["repo", "clone", repoArg, repoDir], { stdio: "inherit" });
        execFileSync("git", ["branch", "-D", branchToDelete], { cwd: repoDir, stdio: "pipe" });
```

**26 call sites**, invoking exactly two binaries — `git` (14) and `gh` (4) on single-line calls,
the remaining 8 multi-line with the name on the following line:

```
$ awk 'NR>=2587 && NR<=3030' src/loop.ts | grep -o 'execFileSync("[a-z]*"' | sort | uniq -c
       4 execFileSync("gh"
      14 execFileSync("git"
```

Every call is `execFileSync("git", […])` or `execFileSync("gh", […])` — a bare name, no absolute
path, no `which`, no shell:

```
$ grep -n 'execFileSync("/' src/loop.ts   → (no matches)
```

Nothing in the wiring pins an interpreter location. *(27 lines in this range contain the string
`execFileSync`, one more than the call count: the 27th is a comment at `src/loop.ts:2775`
explaining that `inherit` makes `execFileSync` return null. An earlier draft of this record said
28 — an eye-count, corrected against the command.)*

**4. The three existing tiers, and exactly what each proves.** A-2 is the gap between them.

| Tier | Command | What it actually exercises | Automated? |
|---|---|---|---|
| 1 | `npm test` (vitest, 287 tests, ~2s) | `src/` module logic behind **injected fakes**; real git repos in `/tmp` as fixtures | Yes — the default gate |
| 2 | `npm run smoke:image` (9 checks) | the **sandbox image's runtimes** — `docker run --rm --entrypoint bash sandcastle-loop -lc 'python --version'` | No — manual, no agent spend |
| 3 | `scripts/*.ts` (`onboard`, `preflight-check`, `red-check`, `probe-agent`, `inspect-issue`) | real component seams against the real fixtures repo, each **hand-wiring its own deps** | No — manual, some need Docker |
| 4 | `npm run loop -- --repo … --provider …` | **`main()` and every git/gh closure** | No — manual, needs Docker + provider + spend |

Tier 2 is worth stating precisely because its name invites the opposite reading: it never touches
harness code. It proves the *image* has `python`, `pytest`, `git`, `gh`, `claude`, `codex`,
`opencode` and a non-root `agent` user. It would stay green if `main()` were deleted.

**5. Tier 4 is real, and is the only thing that has ever proven the wiring.** Five logs are
committed — `docs/work/WI-13/evidence/live-run.log` and `merger-live-run{,2,3,4}.log`, plus
`docs/work/WI-14/evidence/escalation-live-run.log` — each opening with the real invocation:

```
> tsx src/loop.ts --repo /home/bitcot/Documents/projects/loop-fixtures-py --provider claude-via-proxy
```

The control has already earned its keep: the push-before-merge defect is cited in-code from
`merger-live-run-3.log` — a bug no unit test would have caught.

**6. Docker is available in this environment** (`docker info` → daemon reachable), so a
Docker-dependent tier is not blocked by tooling.

**7. The gap is wider than the CLI entry alone.** `onboard-profile.test.ts` tests argv parsing
and profile shaping — pure functions. It does not run onboarding against a seeded repo, so the
PRD's "Test the onboarding pass against seeded repos in at least two different setups" bullet is
unmet by test too. Whether WI-16 absorbs that family or leaves it to its own work item is
decision **D3**.

## Decisions taken

**D1 — The test runs the harness for real, end to end, with only the AI swapped out.**
*(owner, 2026-09-25: "run it real")*

Real git, real `gh`, real GitHub, real branch, real PR, real merge. The **only** substitution is
the agent: a script that makes a trivial edit in place of a live model. The reasoning, in the
owner's terms: the AI is the slow, costly, unpredictable part, and it is the part we least need
to test — the harness never trusts the agent's output anyway (constraint 2). Everything the A-2
gap is about stays real.

This supersedes the recommendation originally drafted here (stub `git`/`gh` on `PATH`), which was
weaker for a reason worth recording: faking `gh` fakes the exact thing under test. The distinction
that decides it is **which** component is faked — the agent, not the integration.

The decisive argument against running the *live model* in the loop is **not primarily cost but
ambiguity**: a red result would not distinguish "the harness's wiring broke" from "the agent had a
bad day." A test that fails for two different reasons is not a test. `harness-prd-v2.md` already
records this trade-off ("a failed run is ambiguous between pipeline and model", grilling
2026-09-11, decision 3).

**D2 — It runs on every `npm test`.** *(owner, 2026-09-25: "on every test")*

The wiring check is part of the default gate, not an opt-in command. A gate that skips the wiring
is the gate that let A-2 exist.

### Consequence: the default gate changes character

Stated plainly because it is a real cost of D2, not an objection to it. Today `npm test` is
offline, Docker-free, and runs in ~2s. After this it will require, on every invocation:

- a running Docker daemon (constraint 6 keeps this local — no cloud spend);
- network access and working GitHub auth;
- several minutes, not seconds;
- **writes to a real GitHub repository** — branches, commits, PRs, merges.

## Hazards the design must handle

Verified facts, not speculation. Each was read off the practice repo on 2026-09-25; each must be
answered in the specification before implementation starts.

**H1 — The practice repo has `autoMerge: true`.** Read from
`/home/bitcot/Documents/projects/loop-fixtures-py/.loop-harness/profile.json`:

```json
{ "baselineFailures": [], "expectedDurationSec": 3, "autoMerge": true, "notifyHandle": "manjula25" }
```

So a green run **squash-merges into that repo's `main` and deletes the branch**. Every `npm test`
would mutate real history, and trigger the post-merge canary on top. Left alone, main accumulates
a junk commit per test run.

**H2 — The same profile carries `notifyHandle: "manjula25"`.** A failing lane posts an inline
`@manjula25` comment on the GitHub issue. So a red test run would **@-mention the owner on
GitHub**. This is outward-facing and would fire automatically on every failing run.

**H3 — Leftovers can make a later run pass vacuously.** This is the most dangerous one, and it is
the exact class the repo's lessons already warn about. A run that dies midway leaves a branch
and/or an open PR. The next run's dedup then finds an open PR for that issue and **skips** it; if
every issue is skipped, the queue is empty and the harness exits cleanly. A test asserting only
"exit 0" would then pass **without having executed the wiring at all** — a check that cannot fail
wearing the shape of a passing test. The suite already contains live evidence that leftovers
accumulate: the practice repo currently carries a stale branch,
`fix/spec-titlecase-returns-all-caps-instead-of-title-case`, with no PR.

**H4 — Concurrent runs collide.** `docs/agents/workflow.md` already notes that worktrees share
one Docker daemon. They would also share one target repo: two simultaneous runs would push
competing branches and each would see the other's PRs during dedup.

## Open decisions — NOT YET TAKEN

**D3 — Scope: the CLI entry only, or the PRD's whole Testing Decisions list?**

A-2 is specifically about `main()`. Fact 7 shows the seeded-repo integration family is unmet more
broadly.

**Recommended: WI-16 stays on the CLI entry**, and the wider family is recorded as candidate
work rather than absorbed. The repo's process exists to stop exactly this expansion, and a work
item that means "make all six testing decisions real" is not one that can be planned or verified
as a unit.

**D4 — Does WI-16 permit changing production code?**

**Recommended: additive only.** D1 requires a way to substitute the agent, and no such provider
exists today (`src/providers.ts` registers `claude-via-proxy`, `codex`, `opencode` — 87 lines, no
scripted entry, and the `LOOP_BYPASS_PLAN` hook seen in `merger-live-run-3.log` is a scratch edit
that is **not** in the current source). Adding a scripted provider is an addition to the registry,
not a refactor of `main()`.

**D5 — Which repository does the test run against?**

This is the question H1–H4 turn on, and it is the one decision that must be settled before the
specification can be written.

- **(a) A dedicated disposable scratch repo** owned by the test, reset to a known state before
  each run (branches deleted, PRs closed, main reset). H1 and H3 stop being hazards because
  mutations land in a repo whose entire purpose is to be mutated, and a known-state reset before
  every run removes the vacuous-pass trap. H2 is handled by omitting `notifyHandle` from that
  repo's profile — at the cost of not exercising the escalation path in the automated test.
- **(b) `manjula25/loop-fixtures-py` as it stands.** Fewest moving parts, but every `npm test`
  merges into its main and can @-mention the owner, and H3's vacuous pass stays live.

**Recommended: (a).** It is what makes "real, on every test" survivable rather than noisy — real
GitHub, real merges, real PRs, but in a repo built to absorb them.

**D3 — Scope: the CLI entry only, or the PRD's whole Testing Decisions list?**

A-2 is specifically about `main()`. Fact 7 shows the seeded-repo integration family is unmet more
broadly.

**Recommended: WI-16 stays on the CLI entry**, and the wider family is recorded as candidate
work rather than absorbed. The repo's process exists to stop exactly this expansion, and a work
item that means "make all six testing decisions real" is not one that can be planned or verified
as a unit.

**D4 — Does WI-16 permit changing production code?**

**Recommended: no refactor; the change is additive.** If D1 is (a), nothing in `src/` needs to
move — the test drives the CLI from outside. This keeps the diff reviewable and keeps the option
of (c)/(d) genuinely closed rather than quietly taken.

**D5 — Does the test get a seeded repo of its own, or use the real fixtures repo?**

The PRD names `manjula25/loop-fixtures-py` (grilling decision 8, 2026-09-11). For a stub-`PATH`
test the "repo" need only be a directory shaped enough for `main()` to start — no network, no
GitHub.

**Recommended: a throwaway directory built by the test itself**, with the real fixtures repo
staying the tier-4 manual target. A test that reaches GitHub is a test that fails on a plane.

## Constraints touched

- **Constraint 1 (no auto-merge unless opted in)** — untouched, but the new test is the first
  thing that could *prove* the opt-in gate's wiring rather than its logic.
- **Constraint 2 (never trust the agent's completion signal)** — untouched; this work item makes
  the harness's own wiring verifiable, which is the same posture applied inward.
- **Constraint 6 (local Docker only)** — the deciding constraint for D1/D2. An automated test
  that starts sandboxes or calls a provider would breach it on every run.
- **Constraints 3, 4, 5** — untouched.

## Explicit non-goals

- Not a general test-coverage improvement; the target is the wiring A-2 names.
- Not a refactor of `main()` (D4).
- No new agent spend, no cloud sandbox, no scheduled/unattended run.
- Does not replace the live-run tier. Tier 4 stays the high-fidelity manual control; this work
  item adds a deterministic tier beneath it, it does not promote a stub test into proof that
  GitHub accepts the arguments.

## Scope of this record

This WI-16 record only. Implementation is a separate, later step through the normal chain
(to-spec → to-tickets → writing-plans → ponytail → worktree → implement), carving FRs from the
settled decisions above. No GitHub issue exists for WI-16 yet — per
`docs/agents/issue-tracker.md`, that mutation is prepared and executed only with explicit owner
authority.