# WI-16 — Cover the CLI entry (the A-2 gap)

**Status: GRILLING IN PROGRESS — no decisions taken.** Nothing below the "Verified facts"
heading is a decision. The `## Open decisions` section lists what the owner must rule on, each
with the recommended answer; this record is filled in as those are answered, the way
`docs/work/WI-13/prd.md` was.

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

## Open decisions — NOT YET TAKEN

Each is the owner's to make. A recommendation is given for each, per the grilling convention;
none is in force until answered.

**D1 — What does the automated test actually execute?** *(the decision everything else depends on)*

- **(a) Spawn the real CLI with stub `git` and `gh` on `PATH`.** A temp dir holding executables
  named `git` and `gh` that record their argv and emit canned stdout, prepended to `PATH`.
  Fact 3 says this works: all 26 call sites resolve by name. Executes **all** of `main()`,
  including the entry guard and argv parsing. Deterministic, no Docker, no agent spend, fast.
  Its cost: it proves argument *shape* and control flow, not that GitHub accepts the arguments.
- **(b) Spawn the real CLI end-to-end in Docker with a real provider.** Highest fidelity, and
  the only thing that proves a flag is one `gh` actually accepts. Real spend, slow,
  nondeterministic (an agent is involved) — can never be the default gate.
- **(c) Export `main()` and call it in-process behind injected fakes.** Needs a production-code
  change, and in-process cannot prove the entry guard at `:3015`.
- **(d) Extract the closures out of `main()` into a testable module.** A refactor; tests the
  pieces, not the assembly — which is the A-2 gap restated, not closed.

**Recommended: (a) for the gate, with (b) kept as the manual tier it already is.** (a) is the
only option that executes the real `main()` without spend, and (c) and (d) both shrink what is
being proven toward the very thing A-2 says is missing.

**D2 — Where does it run, and when?**

- In `npm test` — only viable for option (a), and it would then be the first test in the suite
  that executes production code as a subprocess.
- As a separate opt-in command (`npm run test:integration`), keeping the default gate fast.
- Both, split by fidelity.

**Recommended: (a) joins `npm test`** — a gate that skips the wiring is the gate that let A-2
exist. Anything needing Docker or an agent gets its own command and **never** the default gate
(constraint 6: local Docker only, no cloud spend; and the harness must not spend on every test
run).

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