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
