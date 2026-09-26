# WI-16 — Cover the CLI entry (the A-2 gap)

**Status: GRILLING COMPLETE 2026-09-25.** All five decisions settled — D1, D2, D3 and D5 by the
owner, D4 by reading the code (no decision was needed). Next stage is `to-spec`, then
`to-tickets` to split the three scenarios. This record is the grilling record, the way
`docs/work/WI-13/prd.md` is.

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

**3. Every subprocess in `main()` resolves its binary through `PATH`.** Recorded because it was
the input to D1; the decision it first supported was superseded, but the fact stands and still
matters — it is also why the *image* is a viable substitution point (D4), since `git`, `gh` and
the agent CLIs are all installed by name inside it:

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

**D2 — It runs as its own command on the pipeline-integration surface; the default gate is
unchanged.** *(owner, 2026-09-25: "split it" — superseding the same-day decision "on every test")*

**This decision previously read: "It runs on every `npm test`. The wiring check is part of the
default gate, not an opt-in command. A gate that skips the wiring is the gate that let A-2
exist."** The owner revisited it later the same day and reversed it. The original reasoning is
kept above rather than deleted, because it is the argument the reversal had to answer.

The three scenarios now run under a dedicated command belonging to the **pipeline-integration
surface** — the row `docs/agents/workflow.md` already gives them — and are required evidence at
the verification stage for any change that touches that surface. `npm test` stays what it is
today: offline, Docker-free, seconds.

Three facts decided the reversal. Each was looked up, not assumed; each is re-runnable.

**1. There is no CI and no hook — `npm test` is the only automated trigger that exists.**

```
$ ls .github                       → No such file or directory
$ git ls-files .github | wc -l     → 0
$ git config --get core.hooksPath  → (unset)
```

**2. `npm test` does not actually force the check, so D2 bought default slowness rather than
guaranteed coverage.** The gate is subsettable by path — `"test": "vitest run"` with
`include: ["src/**/*.test.ts"]` — and a developer iterating on a unit test types exactly that:

```
$ npx vitest run                    → Test Files 10 passed (10); Tests 287 passed (287); 1.42s
$ npx vitest run src/verify.test.ts → Test Files  1 passed  (1); Tests  12 passed  (12); 133ms
```

The second invocation is the same gate, run the way it is actually run while working, and it
starts no integration scenario. The scenarios would therefore have sat inside the default command
without being forced by it.

**3. The command table already splits the two surfaces.** `docs/agents/workflow.md` lists
`npm run typecheck` and `npm test` under *Harness source (`src/`, TypeScript)*, and
`build:image`, `smoke:image` and `npm run loop` under *Pipeline integration (local Docker)*. The
scenarios are that second surface. D2 put them in the first.

### What the reversal resolves

It dissolves a question the original D2 created. "What does `npm test` do when Docker, network or
`gh` auth is missing?" is a hard question only while `npm test` is the thing that needs them — and
both available answers were bad: fail, and the inner loop is red for reasons unrelated to the
change under test; or skip, which is a check that cannot fail. As its own command the answer is
plain: **it fails loudly and names the missing precondition**, no skip and no silent pass. The
specification carries that answer and leaves no clarification marker.

### The cost this accepts, stated plainly

**Nothing runs the scenarios automatically.** In a repository with no CI, the trigger is the
delivery path: `verification-before-completion` requires fresh evidence for the exact candidate,
and a change touching the wiring has no other evidence to offer. That is how WI-13, WI-14 and
WI-15 were actually verified. It is a **process** guarantee, not a mechanical one — a run can
still be skipped, and this record does not pretend otherwise. Making it mechanical means CI, which
does not exist in this repository and is its own work item.

What the split buys: the common case is not taxed, and the integration command never goes red for
a reason unrelated to the change under test — the failure mode that trains people to route around
a gate, which is the same disease as a check that cannot fail wearing a different coat.

## Hazards the design must handle

Verified facts, not speculation. Each was read off the practice repo on 2026-09-25; each must be
answered in the specification before implementation starts.

**H1 — The practice repo has `autoMerge: true`.** Read from
`/home/bitcot/Documents/projects/loop-fixtures-py/.loop-harness/profile.json`:

```json
{ "baselineFailures": [], "expectedDurationSec": 3, "autoMerge": true, "notifyHandle": "manjula25" }
```

So a green run **squash-merges into that repo's `main` and deletes the branch**. Every integration
run would mutate real history, and trigger the post-merge canary on top. Left alone, main
accumulates a junk commit per run.

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

## D3 — Scope: the whole of the PRD's Testing Decisions
→ **All of them.** *(owner, 2026-09-25: "all of them")*

This overrides the recommendation drafted here to keep WI-16 narrow. Recorded with its full
extent below, because "all of them" is only plannable once each one is enumerated — an earlier
draft of this record named onboarding as an example of the drift, and naming an example is not
stating the extent.

### The extent, enumerated (read from the source, 2026-09-25)

Of the six Testing Decisions in `harness-prd-v2.md`: **two are already satisfied, three have
gaps, and one is a judgment call.** A-2 is the seventh item and the reason this work item exists.

| # | What the PRD asks for | Verdict |
|---|---|---|
| TD1 | Normalization across all three sources produces one shape | **Satisfied.** `issues.test.ts` carries all three (`issue normalization`, `spec-doc normalization` WI-3 FR-005, `plain-list normalization` WI-3 FR-006), and `queue.test.ts:188` adds a cross-source parity pin: "the dedup is source-agnostic over a mixed queue" |
| TD2 | Dedup skips an issue with an open PR | **Satisfied, and beyond what was asked.** `queue.test.ts:101` plus ~12 more cases covering merged, reverted, closed-unmerged, and the merged-before-open ordering |
| TD3 | Reproduce-then-fix against seeded buggy repos, ≥1 in a non-Node language | **Unmet.** No test runs the flow. `loop.test.ts` mentions the fixtures repo only inside URL *strings* (`url: "https://github.com/manjula25/loop-fixtures-py/issues/1"`) — fixture data, not a run. The "any target language" claim is asserted, never demonstrated |
| TD4 | Onboarding against two seeded setups (docs / no docs), commands validated by execution | **Unmet.** `onboard-profile.test.ts` tests argv→profile shaping and baseline parsing — pure functions. "commands actually execute" is precisely the untested half |
| TD5 | Profile staleness: test command no longer matches → failed verification, flagged for re-onboarding | **Behavior implemented, integration test unmet.** `src/loop.ts:985–1009` aborts with `project profile is stale — baseline no longer matches a fresh run … Re-run onboarding.` The unit halves are tested (`SuiteDidNotRunError`, empty stdout, no summary token); the seeded-repo scenario is not |
| TD6 | "Test only external behavior … not internal prompt wording" | **Judgment call, to be made in the work item.** `loop.test.ts:326–352` tests `buildFixPrompt` by asserting on prompt text, including prose: `toMatch(/commit only the fix and the reproduction test/i)`. Whether that is a legitimate contract pin or the thing the rule forbids is a call to make explicitly, not to leave implied |
| **A-2** | *(the seventh item — this work item's origin)* | **Unmet.** Nothing executes `main()`; see the facts above |

### The structural fact that falls out of the enumeration

**TD3 and A-2 are the same test.** Running the real reproduce-then-fix flow against a seeded
non-Node repo necessarily executes `main()` — so the one integration test closes both at once.
TD4 and TD5 are two further scenarios driven through that same harness once it exists.

That is what makes "all of them" plannable rather than sprawling: it is **one integration
harness** (disposable repo + scripted-agent image, per D1/D4/D5) **driven by three scenarios**,
plus an explicit call on TD6. The `to-tickets` stage splits it; this record does not.

TD1 and TD2 need nothing — they are recorded here as satisfied so the work item does not
re-litigate them.

**D4 — Does WI-16 permit changing production code?**
→ **Answered by fact: no production change is needed at all.** *(settled 2026-09-25)*

The seam D1 needs already exists, and it was found by reading rather than assumed. The adapter
takes its sandbox image as an input (`src/sandcastle-adapter.ts:82`, `readonly imageName: string`)
and the agent CLIs are installed **inside that image** (`.sandcastle/Dockerfile`: `npm install -g
@anthropic-ai/claude-code@2.1.270 --prefix /home/agent/.local`, plus `codex` and `opencode`). And
`main()` already exposes it:

```
$ grep -n 'imageName = optFlag' src/loop.ts
2605:  const imageName = optFlag("image") ?? "sandcastle-loop";
```

So a **second, test-only image** whose `claude` entry is a script — instead of the real CLI —
substitutes the agent with no change to `src/` whatsoever. Everything else in the image stays
real: `git`, `gh`, `python`, `pytest`, the non-root `agent` user.

Two things follow, both worth recording:

- The change is **purely additive**: a Dockerfile variant, a test, and the fixtures it needs. No
  file under `src/` has to move, which also keeps option (c)/(d) from D1's original list
  genuinely closed rather than quietly taken.
- **`--image` is an undocumented flag.** `docs/agents/workflow.md` lists `--repo`, `--provider`,
  `--model`, `--issue`, `--label`, `--max-issues`, `--spec-doc`, `--plain-list` — not `--image`.
  If the test comes to depend on it, the workflow command table must name it in the same PR, per
  the CLAUDE.md rule that the table is authoritative and changes with the code.

**D5 — Which repository does the test run against?**
→ **Its own disposable repo.** *(owner, 2026-09-25: "its own disposable repo")*

A dedicated scratch repo owned by the test and reset to a known state before each run — branches
deleted, PRs closed, main reset. H1 and H3 stop being hazards because mutation lands in a repo
whose whole purpose is to be mutated, and the pre-run reset removes the vacuous-pass trap. For
H2, the repo's profile omits `notifyHandle`, at the cost of not exercising the escalation path in
the automated test — the rest of the wiring is still covered.

How that repo is created, named, and reset is a specification-stage question, not a decision left
open here. Creating it on GitHub is an outward-facing action and needs the owner's explicit
authority when it happens.

### Consequence of D4 worth stating early

The scripted agent is not "make a trivial edit" — the verification gate is real, so the script
must produce a fix that genuinely turns the reproduction test green in a fresh sandbox. For a
seeded repo with a known bug that is a known patch, which is exactly what makes it deterministic.
It must also answer as the **review** agent (a `<review>approve</review>` verdict) since the
pre-merge review runs on the same path. Whether the test drives queue mode (planner included) or
the `--issue` single-issue override is a specification-stage question; note that the planner runs
only when more than one issue is eligible.

## Constraints touched

- **Constraint 1 (no auto-merge unless opted in)** — untouched, but the new test is the first
  thing that could *prove* the opt-in gate's wiring rather than its logic. Note the disposable
  repo (D5) *is* opted in — `autoMerge: true` in its profile — because the merge path is part of
  what is being tested. That is the constraint working as designed, in a repo whose only purpose
  is to be merged into; it does not touch the rule for real repos.
- **Constraint 2 (never trust the agent's completion signal)** — untouched, and this work item is
  the same posture applied inward: the harness's own wiring becomes verifiable the same way its
  fixes are.
- **Constraint 6 (local Docker only, no cloud spend)** — *satisfied, not strained.* An earlier
  draft of this record called it "the deciding constraint" and implied a sandbox on every run
  would breach it. That was wrong, and worth correcting rather than deleting: the constraint bans
  **cloud** spend, and everything here is local Docker. What D2 actually costs is a Docker daemon
  **when the integration command runs** — not on every `npm test`, and not a constraint breach
  (corrected 2026-09-25 with D2's reversal; this sentence previously read "a Docker daemon on
  every `npm test`"). The scripted agent (D1/D4) is what keeps spend at zero — a live model on
  any run would be the real problem, and it is the thing being avoided.
- **Constraints 3, 4, 5** — untouched. The disposable repo carries no client data (constraint 3),
  and the reproduction test the scripted agent writes stays in that repo's suite (constraint 4).

## Explicit non-goals

- Not a general test-coverage push. The target is exactly the four items D3 enumerates as unmet
  or undecided (TD3, TD4, TD5, TD6) plus A-2. TD1 and TD2 are already satisfied and are **not**
  to be reworked.
- Not a refactor of `main()` (D4) — no file under `src/` should have to move.
- No new agent spend, no cloud sandbox, no scheduled/unattended run.
- **Does not replace the live runs, and does not claim what they claim.** This is the one non-goal
  that changes meaning under D1, so it is stated precisely: because the agent is scripted, a green
  integration test proves the harness's wiring against real GitHub — real flags, real PRs, real
  merges. It proves **nothing** about whether a real model writes a good fix. The live runs
  (`--provider claude-via-proxy`) remain the only evidence on that, and remain manual.

## Scope of this record

This WI-16 record only. Implementation is a separate, later step through the normal chain
(to-spec → to-tickets → writing-plans → ponytail → worktree → implement), carving FRs from the
settled decisions above.

**Corrected 2026-09-25.** This paragraph previously read "No GitHub issue exists for WI-16 yet —
per `docs/agents/issue-tracker.md`, that mutation is prepared and executed only with explicit
owner authority." That was true when written and is now false: the owner authorized the creation
and the issue is filed at
[`manjula25/software-factory-loop#23`](https://github.com/manjula25/software-factory-loop/issues/23)
— `gh issue view 23 --repo manjula25/software-factory-loop` shows it. The prepared draft is kept
as evidence at `docs/work/WI-16/issue-draft.md`. Status lives on the issue; the rationale still
lives here.