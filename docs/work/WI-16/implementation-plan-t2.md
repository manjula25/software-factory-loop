# WI-16 Implementation Plan — T2: the scripted-agent image

Ticket: `docs/work/WI-16/tickets/t2-scripted-agent-image.md` (status: Ready for planning).
Spec: `docs/work/WI-16/specification.md` — **FR-002** (the agent is substitutable; no scenario
calls a real provider), **FR-003** (no production source change; the `--image` seam suffices),
slice A. Base: `049cb75` (T1 complete; `npm test` 10 files / 287 tests, `npm run typecheck`
exit 0, `npm run test:integration` 3 passed — recorded in `docs/work/WI-16/verification.md`).

**No file under `src/` is touched.** If any step turns out to need one, that is the
specification's stop condition: report it, do not make it.

---

## Repository facts this plan is built on (verified 2026-09-26)

Every claim below was read out of the source this morning; line numbers are current at `049cb75`.

**How the agent is spawned.** `claudeCode(model, …)` builds
`claude --print --verbose --dangerously-skip-permissions --output-format stream-json --model <model> -p -`
with the prompt on **stdin** (`node_modules/@ai-hero/sandcastle/dist/index.js:3431`; the
`--dangerously-skip-permissions` flag is hardcoded at `index.js:258`). The binary is resolved
from `PATH` inside the container, and the production image puts `/home/agent/.local/bin`
**first** on `PATH` (`.sandcastle/Dockerfile:40`), ahead of anything else. Shadowing
`/home/agent/.local/bin/claude` therefore substitutes the agent and nothing else.

**The stream contract** (`parseStreamJsonLine`, `index.js:2805–2842`). The agent's stdout is
read as NDJSON — one JSON object per line; a line that does not start with `{`, fails to parse,
or has an unrecognised shape is silently ignored. Exactly three shapes are consumed:

```json
{"type": "system", "subtype": "init", "session_id": "..."}
{"type": "assistant", "message": {"content": [{"type": "text", "text": "..."}]}}
{"type": "result", "result": "..."}
```

**How stdout is assembled** (`index.js:265–281, 513`). Every `text` block and every `result`
string is appended, in order, to one accumulator, and that accumulator is what `run()` returns
as `stdout` — which is the string the harness parses. **Exit code must be 0**; anything else is
an `AgentError` (`index.js:283–299`). A run whose accumulated output contains
`<promise>COMPLETE</promise>` is treated as agent-signalled completion (`index.js:336`); with
`maxIterations: 1` the return shape is identical either way, so including it is fidelity, not
necessity.

**What the harness parses back** — the interface the script must answer, not bypass:

- the fix pass: `extractEvidence(stdout, "red"|"green")` takes the **first**
  `<red-evidence>…</red-evidence>` / `<green-evidence>…</green-evidence>` block and throws when
  either is absent (`src/loop.ts:493–502`); the prompt demanding them is `buildFixPrompt`
  (`src/loop.ts:525–566`), which also demands the reproduction test at
  `reproTestPath(issue)` = `tests/fixed-issues/test_gh_1.py` for `gh-1` (`src/loop.ts:438–440`),
  a fix of the reported defect only, and a commit under `LOOP_IDENTITY`
  (`src/loop.ts:57–60`: `software-factory-loop <manjula25+loop@users.noreply.github.com>`);
- the review pass: `parseReviewOutput` matches
  `/<review>\s*(approve|wrong|uncertain)\s*<\/review>/` (`src/queue.ts:442`) and only `approve`
  lets the merge chain proceed (`src/loop.ts:1499`); the prompt is `buildReviewPrompt`
  (`src/loop.ts:574–601`), whose opening line is `You are reviewing a proposed bug-fix diff…`;
  a missing or unparseable block is `uncertain` — the blocking class.

**The seams the test drives** — all exported, none under test by the default gate:
`runFixRun` / `runReview` (`src/sandcastle-adapter.ts:98, 235`), `buildFixPrompt` /
`buildReviewPrompt` (`src/loop.ts`), `parseReviewOutput` (`src/queue.ts`), `normalizeGitHubIssue`
(`src/issues.ts:36`). `fixBranch(issue)` is `fix/${issue.id}` (`src/loop.ts:442–444`). The CLI
seam `--image` already exists (`src/loop.ts:2605`) — T2's tests pass the image name directly to
the adapter, which is the same knob `--image` turns.

**Issue #1 normalizes without an attached log.** Its body's example block is 4-space indented,
not fenced, and `normalizeGitHubIssue` extracts `attachedLog` only from fenced blocks
(`src/issues.ts:41–44`) — so the fix prompt built from the live issue carries no log section,
matching the seeded symptom-only posture.

**Environment.** `pip install -e ".[test]"` inside `sandcastle-loop` was verified working at T1.3
(ran as root; as the non-root `agent` user pip falls back to the user site with a warning —
verified in T2.2's green run, and a stated risk below if it does not). The default vitest
`testTimeout` is already 300_000 on the integration surface (`vitest.integration.config.ts`).
`.sandcastle/.gitignore` ignores only `.env`, `logs/`, `worktrees/` — a new `Dockerfile.test`
and script directory are committed, not ignored.

---

## Plan-level design decisions (fixed here; leaves do not re-decide)

1. **D1 — the image is `sandcastle-loop-test`, layered on the production image.**
   `.sandcastle/Dockerfile.test` is `FROM sandcastle-loop` plus a single `COPY` of one script
   over `/home/agent/.local/bin/claude`. That is the entire difference from production — the
   image-diff acceptance criterion is satisfied by the Dockerfile being three lines, reviewed
   as a file. Built with plain `docker build` (not `sandcastle docker build-image`): it layers
   an existing local image, needs no `AGENT_UID`/`AGENT_GID` args (they are baked into the
   base), and keeping sandcastle's builder out of it means one fewer thing the test depends on.
2. **D2 — only `claude` is shadowed.** Every scenario runs `--provider claude-via-proxy`
   (engine `claude-code`); `codex` and `opencode` stay production binaries. "Differs only in
   the agent entry points" means the one entry point the scenarios invoke.
3. **D3 — the script is Python 3 at `.sandcastle/scripted-agent/claude`.** Python over bash
   because the contract is JSON on stdout — `json.dumps` is the whole job. The build context is
   `.sandcastle/scripted-agent/` alone (one file), so the build never sees `node_modules/`.
4. **D4 — the script ignores argv entirely and reads the prompt from stdin.** The harness
   always passes the same flag set (`--print --verbose --dangerously-skip-permissions
   --output-format stream-json --model <model> -p -`); the model string is a sentinel the script
   never reads. Passes are classified by prompt content — the literal opening lines of the real
   prompts, so classification is pinned to `buildFixPrompt`/`buildReviewPrompt` by construction:
   `You are fixing one reported issue` → fix pass; `You are reviewing a proposed bug-fix diff`
   → review pass; anything else → stderr message and **exit 1** (loud: an unrecognised prompt is
   a harness change someone must see, and `AgentError` surfaces it verbatim).
5. **D5 — the fix pass does the work, it does not narrate it.** It runs `pip install -e
   ".[test]"`, writes the reproduction test at exactly `tests/fixed-issues/test_gh_1.py`, runs
   it against the seeded code and **fails if it passes** (a green RED means the fixture is not
   in the seeded state — the same anti-vacuity rule the harness applies to itself), applies the
   one-line patch `text[:limit]` → `text[:limit - 1]`, re-runs the reproduction test and the
   full suite, sets the repo-local git identity to `LOOP_IDENTITY`, commits exactly the two
   files, then emits the NDJSON carrying the verbatim `<red-evidence>`/`<green-evidence>` blocks
   and `<promise>COMPLETE</promise>`. A failed commit or a green RED exits 1.
6. **D6 — the review pass changes nothing and answers `approve`.** It emits text ending with
   `<review>approve</review>` and the completion signal, and exits 0. The caller's
   `loop/review` branch is deleted by the harness itself (`src/loop.ts:1490`).
7. **D7 — the emission shape is one init event, one assistant text event, one result event.**
   The evidence/verdict text rides the **assistant** event; the **result** event carries a
   one-line summary plus `<promise>COMPLETE</promise>` (the result string is appended to the
   same accumulator, so putting the full report in both would duplicate it in `stdout`).
8. **D8 — T2's tests drive the real seams with the real prompts and the live issue.**
   `tests/integration/scripted-agent.test.ts` imports `runFixRun`/`runReview`, builds the
   prompts with `buildFixPrompt`/`buildReviewPrompt` over the **live issue #1** fetched via
   `gh issue view` and normalised by `normalizeGitHubIssue`, runs against a scratch local clone
   of the fixture, and reads the verdict back through `parseReviewOutput`. The agent spec is
   `{engine: "claude-code", model: "scripted-agent", env: {}}` — no provider registry, so **no
   credential of any kind is required at this layer**; the placeholder-credential CLI path
   (`--provider` + `.env`) is T3/T4's, and this plan does not pre-empt it. This reading of
   acceptance criterion 2's "running the harness" is the ticket's own evidence boundary: "the
   smallest invocation that shows the scripts responding".
9. **D9 — "no API spend" is structural, and stated as such.** The only binary invoked is the
   script; its source contains no network call of any kind (no `urllib`, no `curl`, no `subprocess`
   reaching outside the container's own git/pytest). The claim is reviewable by reading ~90
   lines of Python, and the evidence record says exactly that rather than pretending to measure
   absence of spend.
10. **D10 — the image is pre-built, not built by tests.** Same convention as T1's production
    image: a `FixtureMissingError`-style guard (`assertImageBuilt`) fails each test with the
    build instruction (`npm run build:image:test`) when the image is absent, mirroring
    `assertFixtureReady`. A test that builds its own target cannot tell a broken image from a
    broken script.

---

## The scripted agent — exact contents

`.sandcastle/scripted-agent/claude` (mode `0755` via the Dockerfile's `COPY --chmod`):

```python
#!/usr/bin/env python3
"""WI-16 T2 — the scripted agent. Shadows /home/agent/.local/bin/claude in the
test image. Answers the harness's real prompt/stream contract without a model:

- fix pass   (prompt opens "You are fixing one reported issue"): writes the
              reproduction test, applies the known patch, runs the suite,
              commits under LOOP_IDENTITY, emits <red/green-evidence>.
- review pass(prompt opens "You are reviewing a proposed bug-fix diff"):
              emits <review>approve</review>.
Anything else exits 1 — an unrecognised prompt is a harness change to see, not
to paper over. No network call exists in this file (FR-002, D9).
"""
import json
import subprocess
import sys

FIX_MARKER = "You are fixing one reported issue"
REVIEW_MARKER = "You are reviewing a proposed bug-fix diff"
REPRO_PATH = "tests/fixed-issues/test_gh_1.py"
PATCH_PATH = "src/loopsample/textops.py"
DEFECT = "return text[:limit] + ELLIPSIS"
PATCHED = "return text[:limit - 1] + ELLIPSIS"
USER_NAME = "software-factory-loop"
USER_EMAIL = "manjula25+loop@users.noreply.github.com"

REPRO_TEST = '''"""Regression test for gh-1: truncate must respect the limit."""
from loopsample import truncate


def test_truncate_respects_limit():
    result = truncate("abcdefghij", 5)
    assert len(result) <= 5, f"truncate returned {len(result)} characters"
    assert result == "abcd\\u2026"
'''


def emit(obj):
    print(json.dumps(obj), flush=True)


def emit_text(text):
    emit({"type": "assistant", "message": {"content": [{"type": "text", "text": text}]}})


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def fix_pass():
    install = run(["pip", "install", "-q", "-e", ".[test]"])
    if install.returncode != 0:
        sys.stderr.write(install.stderr)
        sys.exit(1)
    with open(REPRO_PATH, "w", encoding="utf-8") as fh:
        fh.write(REPRO_TEST)
    red = run(["pytest", "-q", REPRO_PATH])
    if red.returncode == 0:
        sys.stderr.write("reproduction test passed before the fix -- fixture is not in its seeded state\n")
        sys.exit(1)
    with open(PATCH_PATH, encoding="utf-8") as fh:
        source = fh.read()
    if DEFECT not in source:
        sys.stderr.write(f"known defect not found in {PATCH_PATH}\n")
        sys.exit(1)
    with open(PATCH_PATH, "w", encoding="utf-8") as fh:
        fh.write(source.replace(DEFECT, PATCHED))
    green = run(["pytest", "-q", REPRO_PATH])
    suite = run(["pytest", "-q"])
    if green.returncode != 0 or suite.returncode != 0:
        sys.stderr.write((green.stderr or "") + (suite.stderr or ""))
        sys.exit(1)
    for key, value in (("user.name", USER_NAME), ("user.email", USER_EMAIL)):
        run(["git", "config", key, value])
    run(["git", "add", REPRO_PATH, PATCH_PATH])
    commit = run(["git", "commit", "-m", "fix(gh-1): truncate returns at most limit characters"])
    if commit.returncode != 0:
        sys.stderr.write(commit.stderr)
        sys.exit(1)
    report = (
        "Reproduction test written at "
        + REPRO_PATH
        + ", defect patched, suite green, committed under the loop identity.\n"
        + "<red-evidence>\n"
        + red.stdout.strip()
        + "\n</red-evidence>\n"
        + "<green-evidence>\n"
        + green.stdout.strip()
        + "\n</green-evidence>\n"
    )
    emit({"type": "system", "subtype": "init", "session_id": "scripted-agent"})
    emit_text(report)
    emit({"type": "result", "result": "fix pass complete\n<promise>COMPLETE</promise>"})


def review_pass():
    emit({"type": "system", "subtype": "init", "session_id": "scripted-agent"})
    emit_text(
        "Diff judged against the reported issue: it patches the truncation "
        "off-by-one the report describes, and the new test asserts the reported "
        "behavior.\n<review>approve</review>\n"
    )
    emit({"type": "result", "result": "review pass complete\n<promise>COMPLETE</promise>"})


def main():
    prompt = sys.stdin.read()
    if FIX_MARKER in prompt:
        fix_pass()
    elif REVIEW_MARKER in prompt:
        review_pass()
    else:
        sys.stderr.write("scripted agent: unrecognised prompt (no fix or review marker)\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
```

`.sandcastle/Dockerfile.test`:

```dockerfile
# WI-16 T2 — the scripted-agent test image. The ONLY difference from the
# production image (sandcastle-loop, built from .sandcastle/Dockerfile) is the
# `claude` entry point, shadowed by a script that answers the harness's real
# prompt/stream contract with no model and no network (FR-002).
FROM sandcastle-loop
COPY --chmod=0755 claude /home/agent/.local/bin/claude
```

---

## The test — exact shape

`tests/integration/scripted-agent.test.ts`. Shared helpers move into
`tests/integration/fixture.ts` (test configuration, not `src/`): a `TEST_IMAGE` constant, an
`assertImageBuilt(name)` guard throwing an error that carries `npm run build:image:test`, and an
`ensureFixtureClone()` that exports T1's private clone-if-absent (remote clone into
`FIXTURE_CLONE_DIR`). Each test guards on both `assertFixtureReady` and `assertImageBuilt`,
then works on its **own scratch clone** (`git clone --quiet <FIXTURE_CLONE_DIR> <mkdtemp>`), so
sandcastle's `.sandcastle/worktrees/` machinery and the branches it leaves never touch a shared
directory; `afterAll` removes the scratch dirs.

```ts
// sketch — the plan fixes behaviour, the file fixes syntax
const issue = normalizeGitHubIssue(JSON.parse(execFileSync("gh",
  ["issue", "view", "1", "--repo", FIXTURE_REPO, "--json", "number,title,body,url"])));
const profile = JSON.parse(readFixtureFile(".loop-harness/profile.json"));

it("fix pass: patch, reproduction test and evidence land on fix/gh-1", async () => {
  const outcome = await runFixRun({
    cwd: scratch, prompt: buildFixPrompt(issue, profile),
    imageName: TEST_IMAGE, agent: { engine: "claude-code", model: "scripted-agent" },
    branch: "fix/gh-1", name: "t2-fix",
  });
  expect(outcome.commits.length).toBeGreaterThanOrEqual(1);
  expect(outcome.branch).toBe("fix/gh-1");
  expect(outcome.stdout).toContain("<red-evidence>");
  expect(outcome.stdout).toContain("<green-evidence>");
  // branch content: the patch and the reproduction test, and nothing else
  // (git diff --name-only main...fix/gh-1 → exactly the two files below),
  // and the commit's author is LOOP_IDENTITY (git log -1 --format=%an\ <%ae>).
});

it("review pass: the answer satisfies the harness's verdict parser", async () => {
  const stdout = await runReview({
    cwd: scratch2, prompt: buildReviewPrompt(issue, "<synthetic diff>"),
    imageName: TEST_IMAGE, agent: {...}, diff: "<synthetic diff>",
  });
  expect(parseReviewOutput(stdout)).toBe("approve");
});
```

The fix-test's branch-content assertion runs `git diff --name-only main...fix/gh-1` in the
scratch clone and expects exactly `tests/fixed-issues/test_gh_1.py` and
`src/loopsample/textops.py`; the author assertion runs `git log -1 --format=%an\ <%ae>
fix/gh-1` and expects `LOOP_IDENTITY`. `extractEvidence` is private (correctly — no `src/`
change), so the evidence assertion is containment of both tags, which is what the private
parser consumes.

---

## Tasks

### T2.1 — the test, born red on the missing image

**Files:** `tests/integration/scripted-agent.test.ts` (new), `tests/integration/fixture.ts`
(extend: `TEST_IMAGE`, `assertImageBuilt`, `ensureFixtureClone`).

**RED:** `npm run test:integration` → the two new tests **fail**, each with the build
instruction (`image sandcastle-loop-test is not built — run npm run build:image:test …`),
alongside T1's three passing. Recorded verbatim to `docs/work/WI-16/evidence/t2-image-missing-red.log`.
**Unchanged, checked in the same step:** `npm test` (10 files / 287 tests), `npm run typecheck`
(exit 0).

**Commit:** `test(WI-16): guard the scripted-agent image's absence with the build instruction`

### T2.2 — the image and the agent, first green

**Files:** `.sandcastle/Dockerfile.test` (new), `.sandcastle/scripted-agent/claude` (new),
`package.json` (`"build:image:test": "docker build -f .sandcastle/Dockerfile.test -t sandcastle-loop-test .sandcastle/scripted-agent"`),
`docs/agents/workflow.md` (Pipeline-integration row gains `build:image:test` — **and**
`test:integration`, which T1 added without recording there; CLAUDE.md's rule is "when a command
changes, change it there … in the same PR that adds it", and the branch is still unmerged, so
the correction lands here and is recorded in the implementation notes), `CLAUDE.md` (the
"What is built so far" section gains one sentence for the integration surface + scripted-agent
image — same rule, same catch-up).

1. `npm run build:image:test` → image builds (single `COPY` layer).
2. Direct smoke, before any harness involvement:
   `docker run --rm -i --entrypoint bash sandcastle-loop-test -c 'claude < <review prompt file>'`
   → three NDJSON lines, last containing `<review>approve</review>`; and `which claude` resolves
   to `/home/agent/.local/bin/claude` with the script's shebang (proves the shadow, not a
   PATH-ordering accident).
3. **GREEN:** `npm run test:integration` → **5 passed** (T1's 3 + these 2). Recorded verbatim
   to `docs/work/WI-16/evidence/t2-adapter-green.log`.
4. `npm test` and `npm run typecheck` re-checked, unchanged.

**Commit:** `build(WI-16): the scripted-agent test image, shadowing only the claude entry point`

### T2.3 — planted-defect pairs (the tests can fail on their subject)

Edit the script, rebuild, run, revert, rebuild, run — recorded to
`docs/work/WI-16/evidence/t2-planted-defects.log`:

1. **Fix side:** emit the report without the `<green-evidence>` block → the fix test fails on
   the missing tag (the same observation `extractEvidence` throws on in production). Revert → pass.
2. **Review side:** answer `<review>wrong</review>` → `parseReviewOutput` yields `wrong`, the
   review test fails. Revert → pass.

Each pair proves its assertion is load-bearing; the revert is confirmed byte-identical by an
empty `git diff` **before** the green re-run.

**Commit:** `test(WI-16): record the scripted agent's planted-defect pairs`

### T2.4 — records

`implementation-notes.md` (append: the contract facts with their file:line pins, the decisions,
the T1 documentation omissions corrected in T2.2, the pip-as-agent observation);
`verification.md` (extend: T2's claims → commands → outputs, evidence boundary, non-claims —
in particular that T2 proves the substitution real, minimal and source-free, and proves nothing
about the queue, the PR, the canary or the escalation path; those are T4's).

**Commit:** `docs(WI-16): record T2's provenance and its verification record`

---

## What T4 inherits (so it does not re-decide)

- `TEST_IMAGE` and `assertImageBuilt` in `tests/integration/fixture.ts` — one place.
- The scripted agent answers any prompt built by the current `buildFixPrompt`/`buildReviewPrompt`;
  if T4's scenario feeds it a **planner** prompt (more than one eligible issue), the script exits 1
  by design — scenario 1 uses `--issue 1` (single-issue override: no planner), which is exactly
  why the ticket graph ordered it that way. A plan-answering arm, if ever needed, is a new
  decision, not inherited silence.
- The scratch-clone pattern (`ensureFixtureClone` → per-test `git clone`) and the
  `afterAll` cleanup convention.

## Risks, stated

- **pip as the non-root `agent` user.** T1.3 verified the install as root; as `agent`, pip
  falls back to the user site with a warning. If it refuses instead, the script's install step
  exits 1 loudly and the fix is `pip install --user` in the script (test-only file, no `src/`
  change) — recorded, not assumed.
- **Build isolation needs the network** for setuptools unless the image already satisfies it —
  same condition T1.3's born-green check ran under, and it passed there.
- **Two vitest files cloning concurrently.** `ensureFixtureClone` clones only when the canonical
  clone is absent; T1's and T2's files could race on a cold machine. Consequence is a failed
  clone, not corruption; the retry is a re-run. Not worth a lock at this scale.
- **The script hard-codes the seeded defect.** It is a fixture actor, not a general agent — if
  the fixture's seed ever changes, the script changes with it, in the same PR.
- **`COPY --chmod` requires BuildKit** — the default on current Docker; if the local daemon
  predates it, the build fails loudly and the fix is a `RUN chmod` line.

## Non-claims

This plan delivers T2 and nothing else. It does not run the queue, open a PR, exercise the
canary, the merger, the escalation path, or onboarding; it does not touch `src/`; and it proves
nothing about any real model in either direction (FR-002's non-claims). "No API spend" is a
structural property of the script's source, stated as such, not a measurement.
