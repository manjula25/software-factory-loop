# WI-16 Verification — T1: the fixture repository and its seed

**Standing claim.** Corrected in place if wrong; the history of what was believed
belongs in `implementation-notes.md`.

- **Source identity verified:** `40dee59` — `test(WI-16): record the fixture guard's
  planted-defect pair`. Docs-only commits follow it.
- **Verified:** 2026-09-25.
- **Surface:** pipeline integration (`tests/integration/`, Docker + `gh`) and the
  default harness-source gate (`npm test`).
- **Base:** `8ea62f7` (the WI-16 specification/ticket commit T1 branched from).

## The claim, exactly

T1 delivers a disposable integration fixture and proves it is a valid subject:
the fixture is reachable, green, opted in, and carries exactly one symptom-only
issue; an integration command exists that fails when it finds no tests and cannot
be mistaken for the default gate; and the guard that detects a missing fixture is
demonstrably able to fail and to stop failing.

## Proving commands, run fresh at `40dee59`

```
$ npm test
exit=0
 Test Files  10 passed (10)
      Tests  287 passed (287)
```

```
$ npm run typecheck
exit=0
```

```
$ npm run test:integration
exit=0
 Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  15.88s (tests 100%)
```

The first two are the claim that **the default gate is unchanged**: 10 files and
287 tests is the same figure the plan recorded at the baseline `8ea62f7`, and the
integration surface is additive and lives in a second vitest config.

## Claims → evidence

| # | Claim | Proved by | Output |
|---|---|---|---|
| 1 | The integration surface refuses to pass on an empty selection | `evidence/t1-surface-no-tests.log` | `No test files found, exiting with code 1`, `exit=1` |
| 2 | An absent fixture fails all three tests, each carrying the setup instruction | `evidence/t1-guard-absent-fixture.log` | `Tests 3 failed (3)`, `exit=1` |
| 3 | The fixture exists, is public, on `main`, and is not empty | read-back quoted in `evidence/t1-fixture-green.log` §2 | `visibility: PUBLIC`, `defaultBranchRef: main`, `isEmpty: false`, remote `HEAD` = `a4348daf` |
| 4 | The seed is born green **with** the latent defect present | `evidence/t1-fixture-green.log` §1 | `3 passed`, `PYTEST_EXIT=0` in `sandcastle-loop` |
| 5 | The defect is real and the issue's stated expected value is right | `evidence/t1-fixture-green.log` §1 | `truncate("abcdefghij", 5)` → `'abcde…'`, `len=6` |
| 6 | The fixture carries exactly one open issue, symptom-only | `evidence/t1-fixture-green.log` §3 | one issue, `#1`, `labels: []`, no attachment URL, no cause |
| 7 | The issue normalizes to `gh-1` and therefore to `tests/fixed-issues/test_gh_1.py` | `src/issues.ts:38`, `src/loop.ts:438–440`; practice repo carries `tests/fixed-issues/test_gh_1.py` | `id: \`gh-${issue.number}\``; `test_${id.replace(/-/g,"_")}.py` |
| 8 | The guard is what fails the suite, and it can return to green | `evidence/t1-guard-planted-defect.log` | planted slug → `Tests 3 failed (3)`, `exit=1`; constant restored (empty `git diff`) → `Tests 3 passed (3)`, `exit=0` |
| 9 | The default gate is unchanged by all of the above | this record, run at `40dee59` | 10 files / 287 tests, `exit=0`; typecheck `exit=0` |

Claims 1, 2 and 8's first half are **contingent observations**: their commands
cannot be re-run as printed now (1 predates the test file; 2 and 8 require altering
source). Each log says so and states what re-running it today would show. They are
records of a run, not re-runnable scripts — which is why the exit codes were
captured with `rc=$?` immediately after each command.

## Evidence boundary

- The three integration tests assert **about the fixture**, not about the harness.
  Nothing here exercises the loop, the queue, the planner, the sandbox adapter, the
  review pass, the canary, the revert net, or the escalation path.
- The green run proves the suite passes. It does **not** prove the suite is strong:
  a test that passed because it asserted nothing would look identical. The
  planted-defect pair is a check on the guard's firing, not on assertion strength.
- The born-green check ran `pip install -e ".[test]"` inside the production image
  and depended on the network to resolve build requirements. It passed; the
  fixture's `README.md` claim of being fully offline refers to the library, not to
  first-time dependency resolution.
- Durations in the logs are environment-bound and are not performance claims.

## Non-claims

1. **Nothing about the harness's wiring.** No scenario runs in T1. The queue path,
   the fix pass, the reproduction test and the verification gate are T4's.
2. **Nothing about the reset.** `FIXTURE_CLONE_DIR` and a clone-if-absent step
   exist, but nothing resets the fixture to its seed. That is T3.
3. **Nothing about the confirmation gate or the escalation path.** Deliberately
   unexercised here (FR-009), and T1 says so rather than implying coverage.
4. **Nothing about a scripted agent or a test-only image.** The fixture is checked
   in the production image; the agent substitution is T2.
5. **Nothing about onboarding.** Scenario 2 is T5.
6. **Nothing about the fixture's permanence.** The token has no `delete_repo`
   scope, so the fixture is fixed forward rather than deleted. That is a
   consequence of T1.3, not a verified property of it.

## Unknowns closed or deferred

| Unknown | Status |
|---|---|
| Does the fixture's slug collide with an existing repo? | **Closed** — `gh repo create` succeeded; the slug was free. |
| Is the practice repo's born-green convention reproducible here? | **Closed** — `3 passed` with the defect present. |
| Can the issue number be predicted before filing? | **Closed** — it is `1`, the fixture's first issue, read back from `gh issue list`. |
| Will a full scenario fit inside the integration timeout? | **Deferred to T4** — `testTimeout` is 300_000 and is a bound, not a budget. T4 raises it with its own evidence if a scenario needs longer. |
| Does the fixture survive being reset, rewritten and merged into? | **Deferred to T3/T4** — T1 only provisions it. |

## Remaining risks

- **The fixture is shared, mutable state.** Any test run may leave it dirty; T3 owns
  the reset. Until then, a dirty fixture would make T1's green run fail for a reason
  unrelated to T1.
- **The guard is one `gh repo view` call.** A transient network or auth failure would
  report `FixtureMissingError` for a fixture that exists. No retry is implemented,
  and this is a deliberate one-call design rather than an oversight — but it means
  a flaky green is possible.

## Not verified here

Anything not listed in the claims table above. In particular, no claim is made that
T1 closes adversarial-review finding A-2; that is WI-16 as a whole, and this record
covers T1 only.