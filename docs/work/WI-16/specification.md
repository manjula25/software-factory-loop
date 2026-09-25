# WI-16 — Testable Specification

## Status

**Draft — presented for owner approval.** D2 was reversed by the owner on 2026-09-25 (see
`prd.md`); this document reflects the reversal, and the clarification marker it previously carried
is resolved and removed. No implementation may start from this document until it is approved.

## Source artifacts

- `docs/work/WI-16/prd.md` — the grilling record; decisions D1–D5 and hazards H1–H4 govern. Also
  the source of the verified facts (F1–F7) this specification relies on rather than restates.
- `docs/work/WI-16/slices.md` — six slices; Slice A blocks B, C and D.
- `harness-prd-v2.md` § Testing Decisions — the product-level requirement for TD3, TD4, TD5 and
  TD6. Unchanged by this work item; WI-16 is the part of it currently unmet.
- `docs/work/reports/harness-adversarial-review.md` — finding A-2, this work item's origin.
- `docs/agents/workflow.md` — the authoritative command list, which FR-013 amends.

## Functional requirements

### FR-001: The CLI entry is executed by an automated test

- **Behavior:** At least one automated test invokes the harness's real command-line entry as a
  **process**, against a real target repository, and asserts on the run's real outcome. It does
  not import a function and call it, and it does not re-wire the entry's dependencies itself —
  both of which are how the existing suite tests the loop today, and both of which leave the
  wiring unexecuted.
- **Source traceability:** A-2; prd.md D1.
- **Slice coverage:** A, B.
- **Success criteria:** the entry's subprocess wiring is observationally covered — a deliberately
  wrong argument passed to a real `git` or `gh` call inside the entry path turns the test red, and
  reverting that argument turns it green (the planted-defect demonstration in FR-005's evidence
  class).
- **Evidence label:** Focused integration run, plus a recorded RED→GREEN planted-defect pair.
- **Boundary and errors:** Covers the branches the three scenarios drive and no others. The real
  `git` and `gh` invocations are made by the harness itself, under the operator's own CLI auth.
- **Non-claims:** Does not claim the entry path is covered as a whole. The branches no scenario
  reaches — the planner pass, the concurrent wave runner, the merger/conflict path, the
  auto-revert net, the escalation comment/label writes — remain unproven by test, and are named
  as non-claims in the verification record. A-2 is **narrowed, not closed**: it moves from "no
  test executes the entry" to "the scenarios' branches of the entry are executed by test".

### FR-002: The agent is the only substituted component

- **Behavior:** Within the integration test, the target repository, real `git`, the real GitHub
  CLI against a real GitHub repository, Docker, the verification sandbox, the fixture's history
  and the profile's commands are all genuine. The **only** substituted component is the agent
  executable: a script in place of a live model.
- **Source traceability:** prd.md D1 ("run it real", 2026-09-25) and its recorded reasoning — the
  distinction that decides the design is *which* component is faked; faking the GitHub CLI would
  fake the exact integration under test.
- **Slice coverage:** A.
- **Success criteria:** the test-only sandbox image differs from the production image only in its
  agent entry points; the integration run reaches its outcomes through the real PR, merge and
  canary paths, not through a stubbed one.
- **Evidence label:** Review of the delivered diff (the image diff is the artifact).
- **Boundary and errors:** "The agent" means every agent pass the driven scenarios invoke — the
  fix pass, and the pre-merge review pass on the merged path. The planning and merger passes are
  not invoked by any scenario (FR-006's boundary).
- **Non-claims:** The scripted agent's output is not evidence about any real model. A green
  integration run says nothing about whether a live model writes a *good* fix — the live runs
  remain the only evidence on that, and remain manual (prd.md non-goals).

### FR-003: The substitution requires no change to the harness source

- **Behavior:** The agent substitution is achieved entirely through the sandbox image, which the
  harness already accepts as an input. No file under the harness's source tree changes in order
  to make the integration test possible.
- **Source traceability:** prd.md D4, answered by fact: the adapter takes its image as an input
  and the entry already exposes it as an option; the image itself installs the agent binaries on
  a `PATH` entry the test image can shadow.
- **Slice coverage:** A.
- **Success criteria:** the delivered diff adds fixtures, an image definition and tests, and
  changes no production source file. If any scenario needs a production-source change, that is a
  **stop condition** for this specification, not a silent scope expansion.
- **Evidence label:** Review of the delivered diff, with the changed-path list accounted for.
- **Boundary and errors:** `vitest.config.ts` and `package.json` are test configuration, not
  production source; amending them is in scope (FR-011 depends on it).
- **Non-claims:** This constrains *how* the test is wired. It is not a claim that the production
  source is correct — it is the opposite: an unchanged source is what makes the test's evidence
  about that source meaningful.

### FR-004: The fixture repository is test-owned and reset before every run

- **Behavior:** The integration test runs against a dedicated GitHub repository that exists to be
  mutated. Before each run it is returned to a known state — remote branches other than the base
  branch deleted, open pull requests closed, the base branch reset to the seed commit, and the
  local clone made to match. The reset covers both the remote and the local clone.
- **Source traceability:** prd.md D5 ("its own disposable repo", 2026-09-25); hazards H1 and H3.
- **Slice coverage:** A.
- **Success criteria:** two consecutive runs from the same starting state produce the same
  outcome; a run killed mid-flight (leaving a branch and an open PR) does not change the next
  run's outcome. The reset is proven effective by exactly that killed-run scenario, not by
  inspecting the reset code.
- **Evidence label:** Focused integration run, including a recorded killed-run → clean-run pair.
- **Boundary and errors:** The reset happens **before** a run. What a successful run leaves behind
  is asserted only where a scenario asserts it (FR-006). A failed reset aborts the test loudly; it
  never proceeds against an unknown starting state.
- **Non-claims:** Does not touch, reset, or otherwise mutate the practice fixture repository or
  any other repository. Does not claim the fixture repository is a good test subject for anything
  beyond these three scenarios.

### FR-005: A run that did no work cannot pass

- **Behavior:** The pass condition of every scenario is **positive evidence that the intended work
  happened** — the reproduction test exists and the seeded bug is fixed, or the profile was
  written, or the staleness was recorded. The process exit code is not a pass condition, and
  neither is the absence of an error.
- **Source traceability:** hazard H3; prd.md's statement that a run which skips every issue "exits
  cleanly" and would let a test pass "without having executed the wiring at all — a check that
  cannot fail wearing the shape of a passing test". This is the repository's standing lesson about
  vacuous evidence applied to the new gate.
- **Slice coverage:** A, B, C, D.
- **Success criteria:** when the harness is prevented from doing its work while still exiting
  successfully — the queue finds nothing eligible and the harness exits clean — the scenario
  **fails**. This is shown, not asserted: the demonstration is a recorded RED run under that
  condition.
- **Evidence label:** Focused integration run, with the recorded induced-skip RED demonstration.
- **Boundary and errors:** Applies to all three scenarios. A scenario may not be satisfied by
  asserting that the harness printed something.
- **Non-claims:** Does not make the scenarios exhaustive — it makes them non-vacuous. A scenario
  that asserts one real artifact is covered for that artifact and no further.

### FR-006: Scenario 1 — reproduce-then-fix, end to end

- **Behavior:** Driving the real CLI against the seeded fixture, from an open GitHub issue
  describing a seeded bug in a **non-Node** target, the harness produces: a reproduction test that
  fails before the fix, a fix, an independent re-verification of that fix in a fresh sandbox
  against the full suite, a real pull request on GitHub, and — the fixture being opted in — the
  merge chain through the pre-merge review, the squash-merge to the base branch, and the
  post-merge canary.
- **Source traceability:** TD3 ("Integration test the reproduce-then-fix flow against a small
  number of seeded, known-buggy example repos … At least one of these seeded repos must be in a
  non-Node language"); A-2; prd.md D3's structural finding that TD3 and A-2 are the same test.
- **Slice coverage:** B.
- **Success criteria:** the seeded bug is fixed on the fixture's base branch, by a commit the
  harness created; the reproduction test the fix carries is committed with it (hard constraint 4);
  the pull request is merged; the canary ran against the merged base branch; and FR-005's positive
  evidence holds throughout.
- **Evidence label:** Focused integration run.
- **Boundary and errors:** The run is driven through the **queue path** with exactly one issue
  eligible — which exercises acquisition, dedup, classification and the single-lane wave runner —
  and deliberately **not** through the single-issue override, so that more of the entry's wiring
  is executed. With one eligible issue the planner does not run (its trigger is more than one
  eligible issue), which is what keeps the scenario deterministic.
- **Non-claims:** Does not cover the planner pass, the multi-lane wave runner, the
  dependency-aware re-plan, the merger/conflict path, the auto-revert net, or the escalation
  comment and label writes. Does not cover the live-model path. Does not claim the harness's
  behaviour on a repository whose profile differs from the fixture's.

### FR-007: Scenario 2 — onboarding against two seeded setups

- **Behavior:** Onboarding is run against two seeded setups — one with thorough documentation, one
  with none (config files only) — and both must produce a project profile whose commands
  **actually execute**. A documentation claim that fails execution must never reach the profile.
- **Source traceability:** TD4 ("Test the onboarding pass against seeded repos in at least two
  different setups — one with thorough docs, one with no docs at all (config files only) —
  confirming both produce a profile whose commands actually execute, and that docs claims which
  fail execution never make it into the profile"); prd.md fact 7.
- **Slice coverage:** C.
- **Success criteria:** each of the two setups yields a profile; each recorded command is executed
  and observed to work; and for the documented setup, a deliberately false documentation claim is
  observed **not** to reach the profile.
- **Evidence label:** Focused integration run.
- **Boundary and errors:** "Commands actually execute" is the requirement — a profile that merely
  parses is not a pass. The two setups are new fixtures; the documented one must be seeded so that
  at least one documentation claim is false, otherwise the second half of the success criterion is
  untestable.
- **Non-claims:** Does not cover onboarding against a repository in a third language, nor
  onboarding's interactive or human-approval paths.

### FR-008: Scenario 3 — profile staleness

- **Behavior:** Against a fixture whose profile's test command no longer matches the code, the
  harness records a **failed verification** and flags the profile for re-onboarding, rather than
  treating an errored or zero-test command run as a pass.
- **Source traceability:** TD5 ("Test profile staleness handling: given a seeded repo whose
  profile's test command no longer matches the code …, confirm the harness records a failed
  verification and flags the profile for re-onboarding, rather than treating an errored or
  zero-test command run as a pass"); prd.md fact 7's note that the behavior is already implemented
  and only the scenario is missing.
- **Slice coverage:** D.
- **Success criteria:** the run records a failed verification with the re-onboarding instruction,
  and does **not** proceed to spend on a fix; a zero-test command run is not read as a pass.
- **Evidence label:** Focused integration run.
- **Boundary and errors:** This slice adds a scenario, not behavior — no production source change
  is expected (FR-003). If the scenario reveals the implemented behavior is wrong, that is a
  finding to record, not a licence to fix it inside this work item.
- **Non-claims:** Does not cover every way a profile can go stale; covers the test-command case the
  PRD names.

### FR-009: No outward notification can fire from the test

- **Behavior:** A failing or red integration run must not be able to @-mention a person on GitHub,
  and must not post an escalation comment or apply a label to any repository other than the
  fixture.
- **Source traceability:** hazard H2 — the practice repository's profile carries a notify handle,
  so a red run there would @-mention the owner, outward-facing, automatically, on every failing
  test; prd.md D5's answer (the fixture's profile omits the handle).
- **Slice coverage:** A.
- **Success criteria:** the fixture repository's profile carries no notify handle; no scenario's
  expected output contains an @-mention of a real account; and a deliberately red run is observed
  to produce no notification.
- **Evidence label:** Focused integration run plus review of the fixture profile.
- **Boundary and errors:** This is a boundary, not a feature: the escalation path is deliberately
  **not** exercised by the automated test, which is the cost D5 recorded. The escalation behavior
  keeps its existing unit coverage and its live-run evidence.
- **Non-claims:** Does not claim the escalation path is tested. It is not — by design.

### FR-010: Concurrent runs do not collide

- **Behavior:** Two integration runs started at the same time must not interleave against the
  fixture repository. Either the second waits for the first, or it refuses to start with a clear
  message. Silently running both is not permitted.
- **Source traceability:** hazard H4 — worktrees share one Docker daemon, and would share one
  target repository; two simultaneous runs would push competing branches and each would see the
  other's pull requests during dedup.
- **Slice coverage:** A.
- **Success criteria:** the guard is a real serialization or refusal, demonstrable by starting two
  runs and observing that they do not interleave; the refusal message names what is holding the
  fixture.
- **Evidence label:** Focused integration run.
- **Boundary and errors:** The guard protects the fixture repository. It does not attempt to
  serialize anything else, and it does not become a general-purpose lock for the harness.
- **Non-claims:** Does not make the harness safe to run twice against *the same real repository* —
  that is a pre-existing property, unchanged here.

### FR-011: The scenarios are their own command, and the default gate is unchanged

- **Behavior:** The three scenarios run under a **dedicated command** belonging to the
  pipeline-integration surface of the authoritative command list. They are not part of the default
  test command, which keeps its present character: offline, Docker-free, seconds. For any change
  that touches the pipeline surface, running that command and recording its evidence is required
  before delivery — the obligation the repository's verification stage already carries for every
  other claim.
- **Source traceability:** prd.md D2 **as reversed 2026-09-25** ("split it"), which supersedes the
  same-day "on every test". The three facts the reversal rests on — no CI or hook exists; the
  default gate is subsettable, so it never forced the check; and the command table already splits
  the two surfaces — are recorded there with their commands.
- **Slice coverage:** A, F.
- **Success criteria:** the default test command runs no scenario, needs no Docker, no network and
  no GitHub auth, and is unchanged in character and duration; the dedicated command runs all three
  scenarios; and the authoritative command list names it under the pipeline-integration surface
  (FR-013).
- **Evidence label:** Focused integration run, invoked exactly as the dedicated command invokes it,
  plus a default-gate run demonstrating it is unaffected.
- **Boundary and errors:** The dedicated command requires a running Docker daemon (local only —
  hard constraint 6), network access, a working GitHub CLI auth, and it writes to the fixture
  repository. When a precondition is absent it **fails**, naming the precondition that is missing.
  It does not skip, and it does not report a pass. This is the question the original D2 made hard
  and the reversal made plain.
- **Non-claims:** **Does not claim the scenarios are run automatically.** Nothing triggers them:
  this repository has no CI and no hook, and this requirement adds neither. The guarantee is a
  process one — the delivery path requires fresh evidence for the exact candidate, and a change to
  the wiring has no other evidence to offer — and a run can still be skipped by someone who
  chooses to skip it. Making it mechanical is a separate work item.

### FR-012: TD6 — the prompt-text assertions are narrowed to the interface

- **Behavior:** The assertions in the suite that pin the text of the prompt sent to the fix agent
  are reduced to the tokens the harness itself produces or parses — the reproduction-test path,
  the profile's pinned commands, the commit identity, and the evidence wrapper tags the harness
  reads back out. Assertions that pin a **sentence** the model is asked to read are removed.
- **Source traceability:** TD6 ("Test only external behavior … not internal prompt wording");
  prd.md D3's verdict that this is "a judgment call, to be made in the work item".
- **Slice coverage:** E.
- **Success criteria:** every remaining assertion on the prompt names a token the harness depends
  on at a seam of its own — produced by the harness and consumed by it, or by the agent under a
  contract the harness then parses; no assertion remains that matches prose with an
  ordinary-language regular expression.
- **Evidence label:** Review of the delivered diff.
- **Boundary and errors:** **This is the specification's own call, made explicitly** because the
  grilling record required it be made rather than left implied. The rule applied is: an assertion
  on the prompt is legitimate exactly when it pins the **interface** between the harness and the
  agent, and illegitimate when it pins the **phrasing** of an instruction. A token the harness
  parses back (`<red-evidence>`, `<green-evidence>`), a path the harness constructs, or a command
  the harness pinned in the profile are interface; a case-insensitive prose match is phrasing.
  Removing a phrasing assertion removes no behavioral coverage, because the behavior it stood for
  is asserted where that behavior actually lives.
- **Non-claims:** Does not make the prompt free of contract — the harness still depends on every
  retained token, and a change to one is still a red test. Does not claim the remaining
  assertions are behavioral tests; they are interface pins, and this requirement says so rather
  than pretending otherwise.

### FR-013: Docs honesty in the same delivery

- **Behavior:** The authoritative command list gains **two** things it does not currently carry:
  the dedicated integration command, placed in its pipeline-integration row, and the option the
  scenarios pass to the harness, which today is undocumented. The module table and the
  testing-tiers description stay honest about what the new command does and does not prove —
  including that **nothing runs it automatically** — in the same delivery as the code, which is
  the table's own standing rule. The grilling lesson, if any, lands as one line under
  `## Lessons`.
- **Source traceability:** prd.md D4's second consequence ("`--image` is an undocumented flag …
  If the test comes to depend on it, the workflow command table must name it in the same PR");
  prd.md D2 as reversed, which puts the new command on a surface the table owns; `CLAUDE.md`'s
  standing rule that the module table stays honest in the same PR.
- **Slice coverage:** F.
- **Success criteria:** the delivered change contains both the behavior and the matching command-
  table and `CLAUDE.md` rows; the table's entry matches how the scenarios actually invoke the
  harness; and the table does not imply the command runs by itself.
- **Evidence label:** Review of the delivered diff.
- **Boundary and errors:** No new lint step is introduced and none exists (the repository has
  none).
- **Non-claims:** N/A (documentation).

## Non-functional constraints

- **No new spend, and no live model.** The scripted agent is the whole reason this is affordable
  and deterministic (prd.md D1). No scenario may call a real provider, and no scenario may require
  a real provider credential to be present — a credential that resolves the provider registry is
  enough, and the values may be non-secret placeholders.
- **Local Docker only** (hard constraint 6) — engaged, not strained: the integration gate runs
  Docker locally, which the constraint permits, and stops short of any cloud sandbox.
- **Confidentiality** (hard constraint 3) — the fixture repository carries no client data, no
  client logs, and no client code. It is a seeded, self-authored bug.
- **Secrets posture is unchanged.** The new test writes task output to the console, as the harness
  already does; it introduces no new emission seam. Environment values are never echoed in
  prompts, pull-request bodies, or any log the harness writes — the existing rule, unamended.
- **Hard constraint 1 is engaged and honoured.** The fixture repository **is** opted in
  (`autoMerge: true`), deliberately, because the merge chain is part of what is being tested — a
  repo whose only purpose is to be merged into. This does not touch the rule for real
  repositories, and the harness's own repository keeps human merge regardless. The gate FR-006
  exercises is the opt-in gate's **wiring**, which no test has ever executed.
- **Hard constraint 2 is the posture of the whole work item.** The harness's own completion
  signal is not trusted anywhere; this work item applies the same treatment inward, to the
  harness's own wiring.
- **Runtime budget.** The dedicated command takes minutes; the default gate stays in seconds, and
  that difference is now the point of the split rather than a cost of it. The specification sets no
  numeric ceiling on the scenarios — a ceiling that made them flaky would be worse than the time
  it saved.
- **The trigger is a process, not a mechanism.** Nothing in this work item makes the scenarios run
  by themselves. The repository has no CI and no hook, the default gate is deliberately unchanged,
  and adding a mechanical trigger is out of scope (FR-011's non-claims, FR-013's honesty
  requirement). This is stated here as a property of the delivered work, not as a gap to be closed
  later without saying so.
- **The fixture repository is provisioned deliberately, not reflexively.** Creating it on GitHub
  is an outward-facing action. This specification does not authorize it: it happens once, under
  explicit owner authority, and the test verifies it exists and fails with a clear setup
  instruction when it does not — rather than creating repositories as a side effect of running
  tests. The fixture's name, owner and seed content are fixed by the implementation plan.

## Clarifications

**None.** The single question this specification opened — what the gate does when Docker, network
or `gh` auth is missing — was resolved by D2's reversal on 2026-09-25, and its marker is removed
rather than carried. With the scenarios on their own command, the answer is that command **fails**
and names the missing precondition: no skip, no silent pass, and no tension with a fast offline
inner loop, because the inner loop is no longer the thing that needs Docker.

Every other decision this requirement set depends on was settled in the grilling record, or is
made explicitly in FR-012 and flagged there as this specification's own call.

## Traceability matrix

| FR | prd.md basis | PRD / review source | Slice | Evidence |
|---|---|---|---|---|
| FR-001 | D1; origin | A-2 | A, B | integration run + planted-defect RED→GREEN |
| FR-002 | D1 | — | A | review of the diff (image diff) |
| FR-003 | D4 | — | A | review of the diff (changed-path accounting) |
| FR-004 | D5; H1, H3 | — | A | integration run (killed-run → clean-run pair) |
| FR-005 | H3 | repo lesson: vacuous evidence | A–D | induced-skip RED demonstration |
| FR-006 | D3 (structural finding) | TD3; A-2 | B | integration run |
| FR-007 | D3; fact 7 | TD4 | C | integration run |
| FR-008 | D3; fact 7 | TD5 | D | integration run |
| FR-009 | D5; H2 | — | A | integration run + profile review |
| FR-010 | H4 | — | A | integration run |
| FR-011 | D2 (reversed 2026-09-25) | — | A, F | integration run + a default-gate run showing it unaffected |
| FR-012 | D3 (judgment call) | TD6 | E | review of the diff |
| FR-013 | D4; D2 (reversed) | — | F | review of the diff |

## Approval

**Draft.** Awaiting owner approval. There is no open clarification — see Clarifications — so this
is approval of the requirement set as written.

Not approved for planning until then: `writing-plans` may not start from this document. If
approval changes a decision the grilling record settled, the record is corrected in place rather
than contradicted here — it is a standing claim, not a ledger, which is exactly how D2's reversal
was handled on 2026-09-25.