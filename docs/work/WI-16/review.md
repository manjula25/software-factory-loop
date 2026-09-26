# WI-16 Review — T2: the scripted-agent image

**Standing claim.** Corrected in place if wrong. This review covers the exact
candidate below; if the candidate changes, the verdict is discarded and the new
range re-reviewed.

- **Fixed point:** `9915ef5` (T1 complete on `main`)
- **Candidate:** `83fd204` — `docs(WI-16): name the code identity, not a self-referential hash`
  (range `9915ef5..83fd204`, 6 commits, 14 files, +686/−18; ancestry verified).
- **Reviewed:** 2026-09-26, read-only, in worktree `wi-16-t2`. First verdict was
  issued at `7cb640e` and **discarded** when the candidate changed (E1 fix);
  this is the re-review of the new range. The delta `7cb640e..83fd204` touches
  exactly three files — the two re-captured vitest evidence logs and
  `verification.md` — no code.
- **Authoritative artifacts read:** `specification.md` (FR-002, FR-003), `tickets/t2-scripted-agent-image.md`,
  `implementation-plan-t2.md` (with its in-place corrections), `verification.md`, `implementation-notes.md`,
  all three T2 evidence logs, every changed file at `83fd204`.

## Changed-path accounting (all 14 files)

| Path | Change | Accounted |
|---|---|---|
| `.sandcastle/Dockerfile.test` | new — 3-line image layer | FR-002 artifact (reviewed as file) |
| `.sandcastle/scripted-agent/claude` | new — the scripted agent | FR-002 artifact |
| `tests/integration/fixture.ts` | +TEST_IMAGE, assertImageBuilt, ensureFixtureClone | shared test config |
| `tests/integration/fixture.test.ts` | private clone-if-absent → exported helper | dedup, no behavior change |
| `tests/integration/scripted-agent.test.ts` | new — the two T2 tests | the ticket's tests |
| `package.json` | +`build:image:test` | command surface |
| `docs/agents/workflow.md` | +integration-tests row (incl. T1's unrecorded command) | standards requirement |
| `CLAUDE.md` | +integration-surface paragraph | standards requirement |
| `docs/work/WI-16/evidence/t2-image-missing-red.log` | new | T2.1 RED |
| `docs/work/WI-16/evidence/t2-adapter-green.log` | new | T2.2 GREEN |
| `docs/work/WI-16/evidence/t2-planted-defects.log` | new | T2.3 pairs |
| `docs/work/WI-16/implementation-notes.md` | +entries 6–9 | ledger |
| `docs/work/WI-16/implementation-plan-t2.md` | stdout fact + D7 corrected in place | correction record |
| `docs/work/WI-16/verification.md` | +T2 section | standing claim |

**No file under `src/`** — FR-003 satisfied by enumeration, not assertion.

## Axis verdicts

### 1. Repository standards — PASS

- `workflow.md` gained the new commands in the same PR that adds them, including
  T1's debt (`test:integration` was added without recording it — caught and paid here).
- CLAUDE.md's "What is built so far" gained the integration-surface paragraph, same PR.
- No lint surface invented; evidence lives under `docs/work/WI-16/`; commit messages
  follow the repo's `type(WI-16):` convention with accurate bodies.
- Ledger corrections follow the two-behavior rule: plan facts corrected in place with
  what-was-previously-claimed and the proof; `implementation-notes.md` appended.

### 2. Specification fidelity — PASS

- **FR-002:** the image differs from production only in the agent entry point —
  `Dockerfile.test` is `FROM sandcastle-loop` + one `COPY`; the shadow was verified live
  (`which claude` → `/home/agent/.local/bin/claude`, script shebang). The scripts answer the
  real contracts (result-event stdout with evidence blocks; `<review>` verdict through
  `parseReviewOutput`) rather than bypassing them. No network call exists in the script —
  structural, and stated as such.
- **FR-003:** no `src/` change; the `--image`/adapter seam sufficed. The stop condition
  never fired, and the three plan-vs-runner defects were all absorbed test-side.
- All four ticket acceptance criteria are met (image diff by review; fix-pass integration
  run; review-pass parser satisfaction; changed-path accounting — this document).

### 3. Evidence and risk integrity — **PASS (E1 resolved)**

- **E1 (was blocking, resolved at `c89c588`):** the two vitest logs now carry
  their exit codes — `exit=1` in `t2-image-missing-red.log` (re-captured after
  `docker rmi sandcastle-loop-test`, which is that log's own precondition, stated in the
  log's exit line) and `exit=0` in `t2-adapter-green.log` (re-captured after a rebuild;
  5 passed / 152.90s). Each exit line records that it was captured immediately after the
  command. `verification.md`'s figures were corrected in place to the fresh capture, with
  the pre-correction figure (149.68s) named rather than erased. The claim and its artifacts
  now agree.
- `t2-planted-defects.log` is clean on this axis: `rc=1`/`rc=0` on the line after each
  command (7 `rc=` lines), byte-identity proven before each green re-run.
- The plan's two corrected facts each state what they previously claimed and carry the
  proof pointer (`implementation-notes.md` §7) — re-checkable against
  `node_modules/@ai-hero/sandcastle/dist/index.js:262–305, 513`.

### 4. Unnecessary complexity — PASS (two non-blocking observations)

- **O1:** `ImageNotBuiltError` takes the image name as a parameter but its message
  hardcodes `npm run build:image:test` — correct for the only current caller
  (`TEST_IMAGE`), misleading if the guard is ever reused for another image. Acceptable
  now; if reused, derive the command or split the guard.
- **O2:** the script checks the commit's return code but not `git config`/`git add`'s —
  a failure there surfaces at the commit, which is checked. Acceptable for a fixture actor.
- The per-test guard triple (`assertFixtureReady` + `assertImageBuilt` +
  `ensureFixtureClone`) duplicates across the two tests — this mirrors T1's deliberate
  per-test-guard convention (documented in `fixture.test.ts`), so it is justified, not a smell.

## Findings summary

| ID | Severity | Class | Finding | Status |
|---|---|---|---|---|
| E1 | was blocking | evidence integrity | two T2 evidence logs lacked recorded exit codes, contradicting verification.md's claim and the repo's T1.2 lesson | **resolved** at `c89c588`, re-verified at `83fd204` |
| O1 | minor | complexity | `ImageNotBuiltError` message hardcodes the test-image build command | open, accepted (single caller) |
| O2 | minor | complexity | script does not check `git config`/`git add` return codes (commit check covers the failure) | open, accepted |

## Unverified evidence

- Nothing on the specification axis is unverified: the spec is approved and traced
  (FR-002 ← prd D1, FR-003 ← prd D4), and both were checked against the artifact.
- Claim 5 of `verification.md` (no API spend) is structural-by-reading, honestly labeled —
  verified as a property of the script's source at `83fd204` (no urllib/requests/curl; the
  only subprocesses are pip, pytest, git).

## Verdict

**All four axes PASS at `83fd204`.** No blocking findings remain; the two open observations
are minor and accepted with reasons. Verification is fresh (integration gates re-run at the
E1 re-capture; unit gate and typecheck unchanged at the same code identity, `2499b90`).
`finishing-a-development-branch` is the recommended next skill — delivery still requires
the owner's explicit authorization.

---

# WI-16 Review — T3: the scenarios command, the reset, the guard

## Candidate identities

- Fixed point: `4701f21d59c8c5e2b9b3281d4f69a3ea92c3c27c` (the T3 plan)
- Candidate (last code identity): `5393e1af0f205570e38fcaf61ebbdb90c614af71`
- Docs-only commits follow on the branch (`afd326c` at review time); range reviewed:
  `4701f21..5393e1a`, 4 commits, 11 files, +948/−9, ancestry verified (`git
  merge-base --is-ancestor`, rc 0).
- Authoritative requirement: `tickets/t3-integration-command.md` +
  `implementation-plan-t3.md` (commit `4701f21`), tracing to `specification.md`
  FR-004/FR-005/FR-010/FR-011/FR-013.

## Changed-path accounting (all 11 files)

`tests/scenarios/fixture-reset.ts`, `tests/scenarios/command.test.ts`,
`vitest.scenarios.config.ts`, `package.json` (the surface); `CLAUDE.md`,
`docs/agents/workflow.md` (the honesty catch-ups FR-011/FR-013 require);
`implementation-plan-t3.md` + 4 evidence logs (records). None under `src/`
(FR-003 — checked `git diff --name-only`, zero hits). Every file read in full
at the candidate, not from the commit messages.

## Axis verdicts

**Repository standards — PASS.** Exit codes captured with `rc=$?` on the
immediately following line in all four logs; the three plan corrections are
in-place strikethroughs naming the evidence that falsified them (none silent);
CLAUDE.md and the authoritative command table gained the surface in the same
change; numerals-beside-lists verified by recount (11 files named in both
`verification.md` claim 8 and `implementation-notes.md` §10; the enumeration
counts 11).

**Specification fidelity — PASS.** All five acceptance criteria mapped: command
isolation + unchanged default gate (`t3-surface-red.log` context, `npm test`
287 rc=0, `test:integration` 5/5 rc=0); hand-mutation → clean
(`t3-command-green.log`, both captures); guard refusal naming the holder +
dead-holder steal (guard test); precondition RED at test and command level
(`t3-precondition-red.log`, 4/4 naming docker); no `src/` change (accounting
above). The ticket's own posture is honored precisely: the empty-queue
assertion is about fixture state, not exit code, and the killed-run →
clean-run pair and guard-under-real-work are left to T4 exactly as the ticket's
Evidence boundary requires. Deviations from the plan are all recorded and
corrected in place (born-red mechanism, the uncatchable `gh pr close` defect,
the force-push defect needing a main advance, PATH → DOCKER_HOST).

**Evidence and risk integrity — FAIL (finding E1, blocking).** The T3 section's
contingency paragraph is wrong twice about its own evidence: it classes claim
5's red as "cannot be re-run as printed now", but
`DOCKER_HOST=unix:///nonexistent-t3.sock npm run test:scenarios` is verbatim
re-runnable and reproduces the red — only claim 1's red is contingent (the
born-red stub was replaced in `0e10076`; re-running that command now yields
green); and it asserts "Each log says so", but neither log's footer states any
contingency — a reader re-running `t3-surface-red.log`'s command against the
current tree gets a pass with no explanation in the log. Same class as T2's E1:
a standing record claiming more than its evidence says.

**Unnecessary complexity — PASS, one local smell (A1).** No speculative surface:
every export is used by the tests or the machinery. `releaseFixtureGuard`'s
throw-into-its-own-catch with a string-marker rethrow works and is tested, but
the plain shape (parse to a variable, decide, remove) says the same thing
without the marker.

## Findings

**Blocking**

- **E1** — `verification.md` T3 §"Claims → evidence" trailing paragraph: claim 5
  misclassified as non-re-runnable, and "Each log says so" is false of both
  logs. Fix: correct the paragraph in place (contingency is claim 1's alone)
  and append a marked contingency note to `t3-surface-red.log` so the log
  itself tells the re-runner why they see green.

**Adjacent observations (non-blocking)**

- **A1** — `fixture-reset.ts` `releaseFixtureGuard`: string-marker rethrow
  control flow; simpler equivalent available.
- **A2** — `command.test.ts` passes the literal `"scenarios-empty-queue"` to
  the loop while `EMPTY_QUEUE_LABEL` is exported for exactly that name — a
  rename would drift the test from the machinery silently.
- **A3** — `t3-planted-defects.log` footer: "(4/4 suite green re-verified
  after)" — at that point only the filtered single test had been re-run; the
  full 4/4 arrived later as the T3.5 re-capture (it exists, header-dated, in
  `t3-command-green.log`). The footer reads as if within the pair.
- **A4** — the 111s standalone measurement justifying the 480s timeouts has no
  verbatim capture under `docs/work/WI-16/evidence/` (it is quoted in the green
  log's editorial footer and a test comment); the durable proof of sufficiency
  is the two full-suite greens containing the test (578.38s, 690.47s).

## Unverified evidence

- The guard against two genuinely concurrent processes (proven here against a
  planted holder only; ticket defers real-work concurrency to T4).
- The reset against a real run's mess (hand-made only; killed-run pair is T4's).
- The 16s-per-gh-POST and 111s figures (A4 — editorial citations, not captures).

## Verdict

Specification and code quality pass; evidence integrity fails on E1. Back to
stage 3 for the E1 fix, then re-review the corrected records. A1–A4 may be
taken or left with the record as-is; none is load-bearing for the ticket's
claims.

---

# WI-16 Re-review — T3 at `0dd9ed3` (E1 resolution)

## Candidate identities

- Fixed point unchanged: `4701f21`. Code identity unchanged: `5393e1a` — the
  delta since the first review is docs only (`afd326c` records, `6f2ea2e` the
  E1 fix, `0dd9ed3` the re-runnability proof), so the specification,
  code-quality and standards verdicts carry over unchanged; only the evidence
  axis re-verdicts.

## E1 resolution, checked

1. The wrong paragraph is corrected **in place** in `verification.md`, names
   what it previously claimed, and restricts contingency to claim 1's red —
   verified by re-reading; no surviving copy of "cannot be re-run as printed"
   or "Each log says so" in T3's section (the remaining hits are T1's and T2's
   own reviewed sections, and this file's quotations of the finding).
2. `t3-surface-red.log` carries the appended, clearly-marked contingency note:
   a re-runner seeing green is told why.
3. Beyond the fix: the corrected record's re-runnability claim for claim 5 is
   now **proved, not asserted** — the exact command re-run at `0dd9ed3`'s
   tree: 4/4 failed naming docker, `exit=1`, appended verbatim to
   `t3-precondition-red.log` with its exit line.

## Verdict

**Evidence and risk integrity — PASS.** All four axes now pass; no blocking
findings. A1–A4 remain recorded as adjacent observations, none load-bearing;
the candidate for delivery is the code at `5393e1a` with records through
`0dd9ed3`.

## Next recommended skill

`finishing-a-development-branch` — with the owner's explicit authorization for
push/PR (the branch is stacked on `wi-16-t2` / PR #25, which is still awaiting
human merge).
