# CLAUDE.md

Guidance for Claude Code and other agents working in `test-harness`.

## What this repository is

A proof of concept for an **issue-driven test & fix loop**: a harness that takes a queue of
already-known issues (GitHub Issues, a spec document, or a plain list — each often with an
attached log or stack trace), writes a regression test that reproduces the reported failure,
fixes the code in an isolated sandbox, independently re-verifies the fix, and opens a PR for
human review — or, on repos explicitly opted in at onboarding, squash-merges the verified PR
itself under a revert net (see hard constraint 1). Built on Sandcastle (`@ai-hero/sandcastle`),
local Docker only for the POC.

The plan of record is **`harness-prd-v2.md`**. Read it before proposing anything that
contradicts it; changes to it go through `grilling` first, not silent edits.

The target project being fixed can be in **any language** — the harness is TypeScript, the
target's language only shapes the sandbox Docker image. The harness never *discovers* issues; it
works through a queue of issues a human already reported.

### What is built so far

The harness is scaffolded and runs. **WI-1** (single-issue loop) and **WI-2** (queue
ingestion) are implemented in `src/`, under vitest, with a committed Docker sandbox image.
**WI-13** layers the dependency-aware parallel queue on top: a planner pass, a concurrent
wave runner, and — on opted-in repos only — a verified merger for conflicting fix branches.

| Module | What it owns |
|---|---|
| `src/loop.ts` | The per-issue loop, the queue runner, and the CLI entry — incl. the opt-in pre-merge diff-review pass → squash-merge → post-merge canary → auto-revert/halt/@-notify → gh-issue closing chain (WI-6); the uncanaried-merge failure surface (sync failure after merge: comment, summary line, halt, no blind revert) and canary-teardown failure recording that never decides/erases the verdict (WI-7); teardown-failure recording extended to the preflight and verification sandboxes with its queue FAILED-line suffix and single-issue report line (the exported `formatSingleIssueResult` builder), and the uncanaried merge's notify-handle @-ping (WI-8); two-origin teardown recording (early vs canary, neither displacing the other) on merged/reverted/uncanaried runs and the fail() outcomes, plus the unified notify-handle vocabulary — absent arm and @-rendered present arm (WI-11, WI-12); the planner wiring (one `runPlan` call whenever >1 issue is eligible, deterministic fallback on a failed/unusable plan) and the concurrent wave runner — `Promise.allSettled` lanes, stop-the-line abort raised as `QueueAbortedError` only after the wave's outcomes are collected, opted-in re-plan after merge waves, dependents of failed blockers left not-attempted with reason `blocked by <ids>` (WI-13); the `--max-issues` optional ceiling, the retired-`--triage` startup error, the shared-git mutex serializing the review→merge→canary chain across concurrent lanes, and the opted-in-only verified-merger gate — read-only `git merge-tree` conflict probe → bounded merger run → fresh-sandbox re-verification of the resolved branch BEFORE the pre-merge review; red → PR open + `mergeFailure` note, queue continues; green → the resolved branch is pushed to origin before `mergePr` (which merges GitHub's PR head) — a failed push takes the same loud open-PR posture (WI-13 T12); the run-level halt signal — set by the first harness-level outcome (red canary, uncanaried merge, early harness failure) and checked at the top of every later lane's serialized merge chain, so no sibling merge is attempted after it (FR-004 merge-granularity, WI-13 T11); and the WI-14 escalation surface on the no-visible-artifact failure family (the `fix-failed` and `preflight-failed` arms — repro, verification, and preflight/sandbox failures) — for gh-sourced issues an inline comment posted the moment the lane fails (never batched, never retried) carrying the `@<notifyHandle>` arm when a handle is configured (absent → no `@` line, the run summary and the single-issue report stating `notify handle not configured` in the unified WI-11/12 vocabulary), the outcome class, the byte-identical failure reason, and a pointer to the operator's console log — plus the `harness-failed` label (created once at run start on GitHub-sourced runs), added by that same trigger and removed on every verified-PR-delivered outcome (the green PR-opened return, the merged + canary-green arm with its gh-issue close, and the PR-left returns — merger-gate non-proceed, review skip, merge throw, halted sibling), while reverted and uncanaried merges keep it; a failed comment post or label write is captured verbatim in the run summary (the FAILED line's suffix, the `LABEL REMOVE FAILED` line, the single-issue report's stderr), never retried and never displacing the verdict it rides beside (WI-14); and the WI-15 repair of that label path — the removal READS the issue's labels (FR-001) and removes the label only when the issue actually wears it, a missing label being success by not calling rather than by forgiving an error (the repo-label-deleted case the old classifier used to forgive), a failed READ recorded verbatim with a `could not read the issue's labels:` prefix on those same lines and skipping the removal, no subprocess error text interpreted in the label read or removal path (the create-time `already exists` check on label creation is the deliberate exception), and the label's name defined once as a shared constant (WI-15) |
| `src/queue.ts` | Acquisition (incl. the acquisition-time remote refresh via the required `refreshRemoteRefs` dep, WI-7), dedup against open and merged PRs (incl. the revert re-queue guard) and stale branches, the planner pass's prompt building and `<plan>` output parsing (priority + `blockedBy` edges, cycle and edge validation, WI-13), plan-based ranking (`orderFromPlan`), review-verdict parsing |
| `src/sandcastle-adapter.ts` | The **only** file permitted to import `@ai-hero/sandcastle` — a boundary test enforces this |
| `src/issues.ts`, `src/verify.ts` | Issue normalization; the verification gate over fresh-sandbox output, incl. the shared suite-summary execution-evidence regex (`SUITE_SUMMARY_RE`) |
| `src/attachments.ts` | Attachment-URL discovery in issue bodies and the `confidentialityCleared` gate (WI-3) |
| `src/onboard-profile.ts` | Onboarding argv parsing + project-profile shaping, incl. the clearance flag and the `--auto-merge` opt-in flag (WI-6), and suite-baseline parsing (`parseSuiteBaseline`) (WI-3, WI-3b) |
| `src/assert-no-secrets.ts`, `src/env.ts` | The confidentiality seam every emitted string passes through |

There is still **no lint step** — do not invent one. The authoritative command list lives in
`docs/agents/workflow.md` (Repository commands); read it rather than guessing, and when a
command changes, change it there. Keep this section honest: if you add a surface, say so here
in the same PR that adds it.

## Hard constraints — each prevents a specific failure

These come from `harness-prd-v2.md` and are invariants every review enforces:

1. **No auto-merge unless the repo opted in; this repo never auto-merges itself.** Every fix
   lands as a PR. On repos without the explicit `autoMerge: true` profile flag (set only via
   `--auto-merge` at onboarding), a human merges every PR — default and unchanged. On opted-in
   repos the harness squash-merges verified PRs, gated by: a pre-merge diff-review pass
   (uncertain → PR stays open for a human), a post-merge fresh-sandbox suite on main (the
   canary), and on red: auto-revert, run halt, immediate @-mention notification. The harness's
   own repository always keeps human merge regardless. Even a verified fix can be the wrong
   root cause — the opt-in flag and revert net are the compensating controls, not a cure.
   *(Amended 2026-09-18, owner — grilling record `docs/work/WI-5/prd.md`.)*
   *(Extended 2026-09-19, owner — grilling record `docs/work/WI-13/prd.md`: on opted-in repos, a
   merger agent may resolve conflicts between parallel fix branches — machine conflict resolution
   joins machine merge behind the same per-repo opt-in, and its output is never trusted: no merge
   counts without fresh-sandbox verification of the merged result (constraint 2) and the existing
   canary + revert net.)
2. **Never trust the agent's own completion signal.** Verification means re-running the
   reproduction test AND the full suite in a fresh sandbox. An agent's "done" is never evidence.
3. **Confidentiality gate.** No client repo, client issue list, or client log is pointed at this
   harness until Bitcot's policy on sending that client's data to a third-party AI API is
   explicitly confirmed. Logs often contain internal paths and data values — treat them as
   sensitive by default.
4. **The reproduction test stays in the suite.** A regression test written for a fixed issue is
   a permanent artifact (proposed home: `tests/fixed-issues/`), not scaffolding to delete.
5. **Budget cap.** A run processes at most the capped number of issues, triaged by priority. No
   silent API spend beyond the cap. *(Amended 2026-09-19, owner — grilling record
   `docs/work/WI-13/prd.md`: the cap is an explicit optional ceiling — `--max-issues N` when
   passed; absent, all unblocked issues the planner surfaced run. The surviving guarantee is "no
   spend beyond what the plan surfaced at run start.")*
6. **Local Docker only.** No cloud sandbox spend before the POC is proven and a team lead signs
   off.

## Repository boundaries — read before any git command

| Path | What it is |
|---|---|
| `/Users/manju/Documents/test-harness` | **This repository.** Its own git root. |
| `/Users/manju/Documents/port-poc` | A separate, unrelated POC repo. Reference only — never run commands against it from here. |
| `/Users/manju` | The **home directory**, which is itself an unrelated git repository. |

**Never run repo-wide git commands from `/Users/manju`** — `git add -A`, `git commit -a`, or a
bare `git status` there operate on the home repository. Scope every git command to the folder
you mean.

## Skills — use the project-local copies

This repository ships its own Agentic Development Skills at **`.claude/skills/`**, committed to
git so every team member and every agent (Claude Code, or anything else pointed at this repo) has
the same set — do not rely on a personal `~/.claude/skills/` copy, which can drift or be missing
entirely for a teammate. Invoke one with `/<skill-name>` (e.g. `/grilling`), or let Claude
pick it up automatically where its `description` matches the task.

Most of these skills end with a **`## Next recommended skill`** line naming what to run next.
Follow it — that is how Claude autosuggests the next step, and how a team member new to the repo
can walk the same path without memorising it.

**The requirements chain starts at the PRD.** `harness-prd-v2.md` is the product-level
requirements of record (goals, users, success criteria, out-of-scope). There is no build plan
yet: until one exists, work items are carved from the PRD by section, and the PRD wins on any
disagreement about product purpose.

## The lifecycle

A work item moves through four stages. Pick your entry point — most work doesn't start at
stage 1.

**1. Definition** — before any code changes
`grilling` stress-tests an approach or a PRD change against evidence before it is accepted.
`domain-modeling` only when terminology or a boundary is genuinely unclear.

**2. Planning** — turn an approved work item into an executable plan
`to-spec` (measurable FRs traced to the PRD section) → `to-tickets` (dependency-aware tickets)
→ `writing-plans` → `ponytail` (strip accidental complexity before anyone builds it).

**3. Implementation**
`using-git-worktrees` (isolate the branch) → `implement`, which orchestrates each approved slice:
one leaf implementer works through `tdd`, which tests at the public seam of the surface being
changed — harness source (`src/`, vitest) or pipeline integration (actually running the flow
against a seeded buggy repo in Docker). Never a source-text assertion. The controller runs a
read-only specification review before a read-only code-quality review, rerunning both if the
candidate changed. `diagnosing-bugs` handles defects found along the way.

**4. Verification and delivery**
`verification-before-completion` → `code-review` → (blocking findings send you back to stage 3;
otherwise) → `finishing-a-development-branch`, which requires explicit authorization before any
delivery action and is a terminal step. Delivery is a PR; the harness itself never merges. Use
`handoff` whenever a task pauses mid-flight for another session or agent to pick up.

```
grilling* → domain-modeling*
  → to-spec → to-tickets → writing-plans → ponytail
  → using-git-worktrees → implement (tdd per slice, ± diagnosing-bugs)
  → verification-before-completion → code-review → finishing-a-development-branch | handoff
```

Plans, verification records, review notes and delivery summaries are written to
`docs/work/{WORK_ITEM}/`. That directory holds **evidence, never requirements**, and is created
when a work item actually starts, not before. One exception: the planning-chain inputs
(`prd.md` carve-outs and `slices.md`) also live there — they are traceability artifacts
derived from `harness-prd-v2.md`, not new product requirements, and the PRD still wins on
any disagreement.

**Correcting a record already written.** Two behaviors, chosen by the artifact rather than by taste.
A **standing claim** — `delivery.md`, `review.md`, `verification.md`, and anything else a reader
treats as current — is **corrected in place**, because a wrong claim left standing is a wrong answer,
not a historical one. A **chronological ledger** — `implementation-notes.md` — gets an **appended
note**, because its job is to record what was believed at each checkpoint, and rewriting it would
erase when the error happened, which is the one thing it is for. Either way the correction states
what the record previously claimed and carries the command that proves the new figure: a correction
no one can re-run is just a second claim.

## Self-learning

When corrected, or on catching a mistake, add the lesson as a one-line rule under `## Lessons`
before continuing. Project-specific lessons belong here; lessons that apply everywhere belong in
`~/.claude/CLAUDE.md`.

## Lessons

- Before `git remote add` / `git push` in a directory that has never had its own `git init`, run `git rev-parse --show-toplevel` first — an un-initialized project directory silently belongs to the `/Users/manju` home repo, and remote/push commands run there operate on the whole home directory (2026-09-11: `software-factory-loop` was nearly pushed with the entire home repo).
- A live-validation "unfixable" seed must put the contradiction on the **same no-argument call**, both sides pinned by permanent artifacts — a conflict stated *across two call sites* is satisfiable by adding a parameter, which the fix agent will do honestly and the run will succeed (2026-09-23: WI-14 T5's first seed paired `"J.P"` and `"J.L.P"` for two callers of `initials`, and the agent added `split_hyphens`; the re-seed pinned `word_count("state-of-the-art")` against its own protected regression test and the lane failed as designed).
- A live run from a git worktree needs the untracked `.env` copied in first — a worktree carries only tracked files, and `main()` calls `loadEnv(process.cwd())` (2026-09-23: WI-14 T5; the credentials were genuinely absent from `wi-14`).
- A subprocess classifier's reachability must be probed across **all** its cases before it is called dead code: probing the label-absent case alone looked like proof the classifier was unreachable, but the label-not-in-the-repo case is the one that fires it (2026-09-23, WI-15).
- A check that cannot fail is not evidence: `grep "a|b"` without `-E` is a **literal** search in basic regex, so an implementer's "no matches" was guaranteed rather than informative — the deletion it claimed to prove was real, but the evidence for it was vacuous (2026-09-23, WI-15).
- A stale file's rot is re-measured against the interface it imports today, never read off the record that last described it: an object literal carrying a property that no longer exists makes TypeScript report *that* error and **hide every missing property behind it**, so WI-15's recorded "two deps missing, uncompilable since WI-14" was really eight deps missing, broken since WI-13 (2026-09-24, `docs/work/WI-6/evidence/canary-red-driver.ts`).
- A compiler's own count is not the whole set when the type is an intersection: TypeScript reports a missing-member failure through **one constituent only** and truncates the list ("…and 2 more"), so `QueueLoopDeps`'s real shortfall was 6 from `LoopDeps` + `refreshRemoteRefs` + `runPlan` = 8, while the error message — and every record that quoted it — said six, and a reviewer who added only the constituent they thought of said seven (2026-09-24, WI-15).
- Pin a commit range to the commit the claim is *about*, never to `HEAD` or to whichever commit you happen to be standing on: WI-15's PR figures were measured at `aa1d2ca` while the PR's head was `cd6e547`, so a correct-looking `+2527` looked like a disagreement with GitHub's `+2581` — the 54 lines were the commit nobody had named (2026-09-24).
- A correction that prints a command must re-run it: copying a command's output out of the text being corrected reproduces the stale figure *inside the correction*, which is how `git branch -r --contains` came to claim a branch that had already been deleted on merge (2026-09-24, WI-15 §Branch and base).
- A record that names *examples* of a drift is not stating its extent — enumerate the whole set before quoting the sample: WI-15's pending list said two skills drifted between `~/.claude/skills/` and the committed `.claude/skills/`, and every one of the 16 shared skills did (2026-09-24, `.claude/skills/code-review`).
- A numeral written beside the list it counts must be checked against that list, not composed from memory: WI-15's commit-sweep note said "the remaining five commits" in the same sentence that named four, and it said "nine commits sit on the branch" about a branch whose own note commit made ten — a count that disagrees with its own enumeration passes every reader who trusts the number and fails every reader who counts (2026-09-24, `docs/work/WI-15/implementation-notes.md` item 8; **recurred three times in one plan** on 2026-09-25, WI-16 T1 — "eight files" beside a list of seven, in two places, and "the four `.gitignore` decisions" beside a parenthetical saying "nothing else" — so the check applies to plans and specifications, not only to ledgers).
- A recorded exit code must be captured with `rc=$?` on the line immediately after the command — an intervening `echo` resets `$?` to 0, so the first capture of a genuinely red run read `exit=0`, measuring the `echo` rather than the command it claimed to measure (2026-09-25, WI-16 T1.2, `docs/work/WI-16/evidence/t1-guard-absent-fixture.log`).
- A test that shells out to `docker` and `gh` must be given a timeout rather than inherit vitest's 5s default: WI-16 T1.2's third test measured ~14s for a cold clone plus a container run, so the first run against the real fixture failed on the clock rather than on its subject, and no number of re-runs would have changed it (2026-09-25, WI-16 T1.3, `vitest.integration.config.ts`).
- A plain-language guide is a set of claims, and each one is read off the source, never off the prose describing the feature: drafting the casebook row for a leftover `fix/<id>` branch as "already handled, skipped" would have shipped a falsehood, because `classifyQueue` deletes the branch and keeps the issue **eligible** — narrative sections say what a feature is *for*, and only the code says what it *does* (2026-09-25, `docs/work/reports/harness-functionality-guide.html`).
