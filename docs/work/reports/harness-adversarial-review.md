# Adversarial review — is the harness honestly implemented?

**Question put:** review each feature individually and decide whether it is honestly implemented,
or faked / hardcoded to close the implementation. Report any serious issues.

**Candidate:** branch `harness-audit-followups` (then named `docs/harness-guide-casebook`), commit
`3c5772a`. At that commit the harness source was byte-identical to `origin/main` (`56636ed`) — the
branch was docs only:

```
$ git diff --stat origin/main..3c5772a -- src/
(no output)
```

Every figure and quotation below describes **that** commit, not the branch as it stands now. The
branch has since moved: A-3 and A-4 were fixed in `14d0978` and `d8aad2f`, so the source now
differs from `origin/main` by exactly those two changes and the suite count has risen from 285 to
287. The findings themselves are unrevised — only their status changed, each marked inline with
the command that closes it.

**Date:** 2026-09-25. **Method:** read the implementation behind each claim, not the record that
describes it, then try to break it. Stance adversarial: the object was to find the feature that
looks implemented and isn't.

---

## Ground truth

```
$ npm run typecheck   → exit 0
$ npm test            → Test Files 10 passed (10); Tests 285 passed (285); Duration 1.87s
```

Two things this does **not** establish, stated up front: it says nothing about the CLI wiring
(finding A-2), and it says nothing about anything requiring Docker.

---

## Verdict: no faking, no hardcoding, no stubs

The blunt answer to the question asked is **no — the features are real**. Specifically:

- **No stub markers anywhere.** `grep -n "TODO\|FIXME\|XXX\|HACK\|not implemented\|unimplemented" src/*.ts`
  (excluding tests) returns nothing.
- **No fail-open gate.** The one gate that could quietly do damage — the pre-merge review that
  authorises an automatic merge — fails *closed*:
  ```ts
  export function parseReviewOutput(stdout: string): ReviewVerdict {
    const match = stdout.match(/<review>\s*(approve|wrong|uncertain)\s*<\/review>/);
    return match === null ? "uncertain" : (match[1] as ReviewVerdict);
  }
  ```
  Unparseable → `uncertain` → blocks the merge. The regex is a closed alternation of the three
  contract literals, so the cast on the next line cannot lie to the type system.
- **No hardcoded outcomes.** `formatSummary` interpolates real arrays; every outcome field is
  carried from the decision that produced it, not composed to read well.

### Feature-by-feature

Each row was checked against the implementation, not against prose about it.

| Feature | Where | Verdict |
|---|---|---|
| Queue acquisition from a reported list | `queue.ts` `splitQueue` | Honest — real dedup pass, three real outcomes |
| Duplicate detection | `queue.ts` `classifyQueue` | Honest — and the subtle case is right: a stale `fix/<id>` branch is **deleted** and the issue stays eligible; only an open PR skips it, and a merged PR skips it *unless main reverted that merge*, in which case the issue returns |
| Spending cap | `loop.ts` `parseCap` | Honest — validated at startup, and there is genuinely no default |
| Attachments travel with the issue | `attachments.ts` | Honest |
| Clearance gate | `attachments.ts:57` | Honest — a hard throw, not a warning: `if (urls.length > 0 && profile.confidentialityCleared !== true)` |
| Prove it first, then fix it | `loop.ts` repro path | Honest |
| Isolated copy per fix | `sandcastle-adapter.ts` | Honest — the only file importing the sandbox package |
| Planner + parallel waves | `queue.ts` `orderFromPlan`, `loop.ts` `runQueue` | Honest — plan rejected on cycles, loud deterministic fallback |
| **Fresh-sandbox re-verification (constraint 2)** | `loop.ts` `verifyInFreshSandbox` | Honest — builds a sandbox, runs the real `installCmd`, the repro, and the full suite, then diffs failures against the onboarding baseline. The load-bearing feature is not simulated |
| Canary after landing | `loop.ts` `runCanary` | Honest — syncs main, fresh sandbox on merged main, baseline-compared, real `git revert` on red |
| Every fix becomes a review request by default | `loop.ts` `createPr` wiring | Honest |
| Auto-landing under the undo net | `loop.ts` `runCanary` + revert arms | Honest |
| Conflict referee, also graded | `loop.ts` `runVerifiedMergerGate` | Honest — real conflict probe, bounded merger, then the **same** fresh-sandbox verification before anything downstream may spend on it |
| Failures loud, recorded, never retried | `loop.ts` escalation arms | Honest — comment and label writes are each individually caught and recorded verbatim |
| Label read before removal (WI-15) | `loop.ts` `clearHarnessFailedLabel` | Honest — reads first; a failed read is recorded and the removal is skipped, not forgiven; a missing label returns success by *not calling* |
| Run-level halt | `loop.ts` `createRunHaltSignal` | Honest — real shared signal, first halt wins |
| Honest summary | `loop.ts` `formatSummary` | Honest |
| Adapter boundary | `sandcastle-adapter.boundary.test.ts` | Real — **and was narrower than the absolute it enforced; fixed**, see A-3 |

The 10 assertions that look weak (`toBeDefined`, `toBeTruthy`) were each checked in context: all
are secondary guards standing next to a stronger assertion, not tests that pass on nothing.

The suite also drives **real git repositories** in `/tmp` rather than only fakes — including a
real divergent-main case that produces a genuine `fatal: Not possible to fast-forward`.

---

## Findings

### A-1 — SERIOUS (accuracy): the secrets screen was overclaimed

**Was:** the functionality guide said *"Every piece of text the harness sends out — to the AI
service, to GitHub, into a report — passes a screen that blocks credentials, keys, and tokens."*

**Is:** `src/assert-no-secrets.ts` is 31 lines and does one thing — it blocks a string only if
that string literally contains a value from the harness's **own configured environment**, of
length ≥ 8:

```ts
const secrets = Object.entries(env).filter(([, value]) => value.length >= MIN_SENSITIVE_LENGTH);
```

It does not detect keys, tokens, or credentials in general.

**Concrete exposure:** a client's error log attached to an issue, containing a password or key
that is not present in the harness's own `.env`, is sent to the third-party AI API with nothing
screening it. The `confidentialityCleared` gate does not cover this either — it is a per-client
*permission* flag checked at acquisition, not a content screen.

**Corrected in place** in `docs/work/reports/harness-functionality-guide.html`, per the repo's
standing-claim rule, to state what the screen actually is and to name the clearance rule as the
thing that covers the other case. The corrected wording also no longer implies the harness
reviews client material for secrets — it does not, and that is a human decision.

### A-2 — SIGNIFICANT (coverage): the CLI entry is executed by no test

`main()` is `loop.ts:2587–2947` — roughly 360 lines — and it holds every **real** dependency
closure: `git push` / `git revert` / `git rev-parse`, `gh pr create` / `pr merge` / `pr comment` /
`issue close` / `issue comment` / `label create`, plus the sandbox, review and merger seams.

No test calls it:

```
$ grep -rn "\bmain(" src/*.test.ts          → (no output)
$ grep -rn "npm run loop\|spawn" src/*.test.ts → (no output)
```

The loop *logic* is thoroughly tested behind injected fakes. The *implementations injected into
it* are not tested at all. A wrong `gh` flag or a bad `git` invocation passes all 285 tests;
TypeScript catches shapes, not subprocess argument semantics.

**This is an accepted posture, not a blind spot** — and the compensating control demonstrably
works. Pipeline integration is proven by live runs, and the logs are committed: four merger runs
and one queue run under `docs/work/WI-13/evidence/`, one escalation run under
`docs/work/WI-14/evidence/`. The control has already earned its keep: the push-before-merge
defect is cited in-code from `merger-live-run-3.log` — a bug no unit test would have caught.

**What it means for the evidence page:** "285 tests pass" is not evidence about the CLI's wiring,
and every edit inside `main()` since the last live run is unproven. The guide's closing section,
"How far the proof goes today", did not say this.

**Half-fixed** in the same commit as this edit: the guide now states the boundary in plain words
— the automated checks cover each piece on its own, the assembled command-line path is proved by
the live runs, and a change to that wiring is uncovered until the next one. **The underlying gap
is not closed and is not closable by a docs edit.** Closing it means an automated integration test
that executes the CLI against a seeded repo, which is a work item with the repo's full lifecycle
(grilling → spec → tickets → plan → implement), not a patch. It remains the largest honest gap in
the harness, and the compensating control — logged live runs — is real and has already caught a
defect no unit test would have (`merger-live-run-3.log`).

### A-3 — MODERATE: the boundary rule is stated as absolute, enforced as partial

`CLAUDE.md` says `sandcastle-adapter.ts` is *"the **only** file permitted to import
`@ai-hero/sandcastle` — a boundary test enforces this."* The test is genuinely built — it
recurses, it has a non-vacuity guard (`expect(files.length).toBeGreaterThan(0)`), and its import
pattern covers static, type-only, dynamic and `require` forms. But it scans only:

- two roots: `src/` and `.sandcastle/`;
- one extension: `.ts`.

A new file at the repo root, under `scripts/`, or named `.mts` / `.cts` / `.tsx` could import the
package and the suite would stay green. Low likelihood; the rule is simply weaker than the
absolute it is recorded as.

**Fixed** in `14d0978`. The scan root is now the whole repository (skipping `node_modules`,
`.git`, `.claude`, `.loop-work`, `dist`, `coverage`) and the extension list covers
`.ts`/`.mts`/`.cts`/`.tsx`. Both halves of the gap were observed closing, not assumed:

```
$ cat > boundary-probe.ts   # imports @ai-hero/sandcastle, at the repo root
before: Test Files 1 passed (1); Tests 5 passed (5)         ← offender missed
after:  Test Files 1 failed (1); Tests 1 failed | 4 passed   ← offender named
$ rm boundary-probe.ts
after:  Test Files 1 passed (1); Tests 5 passed (5)
```

The `.claude` skip is a deliberate trade-off, stated in the test: sibling worktrees are full
copies of this repo whose own adapter would report as an offender, so an offender inside an
uncommitted sibling worktree is not caught. Everything in the tracked tree is.

### A-4 — MINOR: a zero count counts as execution evidence

`SUITE_SUMMARY_RE = /\b\d+ (?:passed|failed|error|errors|skipped|xfailed|xpassed)\b/` matches
`0 passed`. The rule's intent is "a counted outcome proves the suite executed"; pytest prints
`no tests ran` in the zero case, so the practical exposure needs a different runner that prints a
zero count.

**Fixed** in `d8aad2f` — the exposure is small but the regex is the one definition of "the suite
executed" shared by the verification gate, onboarding and the preflight script, and "0 passed" is
the same non-evidence as "no tests ran" wearing a numeral. A negative lookahead now keys on the
count's value rather than on a digit being present:

```ts
export const SUITE_SUMMARY_RE = /\b(?!0\b)\d+ (?:passed|failed|error|errors|skipped|xfailed|xpassed)\b/;
```

`10 passed` and `20 skipped` still read; `0 passed` and `0 failed, 0 passed` do not. RED
(`Tests 1 failed | 11 passed`) → GREEN (`Tests 12 passed`); full suite 287 passed, typecheck 0.

---

## Explicit non-claims

What this review did **not** establish:

- No live run was executed; the CLI was never run and no sandbox was started.
- `runCanary` (~327 lines) was read in part, not in full; `runSingleIssueLane` (~380) and
  `runQueue` (~440) were read at the call sites that matter to these findings, not line by line.
- The live-run logs were confirmed to **exist** and to be cited correctly; their contents were not
  re-read to confirm each describes what it is cited for.
- Nothing here is evidence about Docker behaviour, other AI providers, or target repositories
  other than the fixtures.
- This is a point-in-time reading of one commit. It is not a substitute for `code-review` on a
  work item's diff, which reviews a range rather than a tree.