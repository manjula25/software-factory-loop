# WI-16 Implementation Plan — T1: the fixture repository and its seed

*Planned 2026-09-25. Covers **ticket T1 only** (`docs/work/WI-16/tickets/t1-fixture-repository.md`);
T2–T8 are planned when their frontier opens, and their tasks are appended here.*

Inputs of record: `docs/work/WI-16/specification.md` (approved 2026-09-25),
`docs/work/WI-16/slices.md` (slice A), ticket T1, `docs/work/WI-16/prd.md` (D1–D5, H1–H4).
Baseline recorded fresh at **`8ea62f7`** on branch `harness-audit-followups`: `npm run typecheck`
exit 0; `npm test` = **10 files / 287 tests passed** (1.41s).

## Repository facts this plan is built on (verified 2026-09-25)

- **A practice fixture already exists** — `manjula25/loop-fixtures-py`, **public**, cloned at
  `/home/bitcot/Documents/projects/loop-fixtures-py`. Package `loopfix`, born **green**
  (`baselineFailures: []`), profile carrying `"autoMerge": true` **and `"notifyHandle":
  "manjula25"`** — the whole of hazard H2. This is the repo D5 says the new test must **not**
  touch, and it is the template the seed copies.
- **The regression-test home is `tests/fixed-issues/`**, matching hard constraint 4:
  `reproTestPath()` (`src/loop.ts:438–440`) returns `tests/fixed-issues/test_${id.replace(/-/g,"_")}.py`,
  and the practice repo carries 20 such files. GitHub issue `#1` normalizes to id `gh-1`.
- **`.loop-harness/` is gitignored in the practice repo** (`git ls-files .loop-harness | wc -l` → 0),
  so its profile is untracked local state. The fixture deliberately differs (see D2).
- **`gh` auth**: account `manjula25`, token scopes `gist, read:org, repo`. `repo` covers creating
  the fixture and filing its issue. **`delete_repo` is not granted** — the fixture cannot be
  deleted with this token, so creating it is effectively permanent.
- **The image's `agent` user takes the host UID/GID** (`.sandcastle/Dockerfile:30–35`,
  `sandcastle docker build-image` defaults the build args to the host user), and the image's
  default `USER` is `agent`.
- **`SUITE_SUMMARY_RE`** (`src/verify.ts:22`) rejects a zero count, so "1 passed" reads and
  "0 passed" does not — the fixture's green run must be read through it, not around it.
- The default gate is `vitest run` over `vitest.config.ts` (`include: ["src/**/*.test.ts"]`);
  `tsconfig.json` includes `src`, `scripts`, `vitest.config.ts` — **not** `tests`.

## Plan-level design decisions (fixed here; leaves do not re-decide)

1. **D1 — The fixture is `manjula25/loop-integration-fixture`, public.** Public matches the practice
   repo's posture, which is what makes them comparable; hard constraint 3 is about client data and
   there is none — the seed is self-authored. It is not the practice repo and must never be reset,
   merged into, or otherwise touched by a test.
2. **D2 — The fixture commits `.loop-harness/profile.json`.** Its `.gitignore` does not list
   `.loop-harness/`. That puts the profile in the seed commit, so FR-004's reset restores it by
   construction and the profile becomes a reviewable artifact instead of untracked local state.
   This is the one deliberate structural difference from the practice repo.
3. **D3 — The seed is born green, with one latent defect.** `baselineFailures: []`, the contract
   suite does not reach the defect, and the open issue describes only the symptom. This is the
   practice repo's convention and it is what makes the reproduction test load-bearing: it is the
   only thing that fails before the fix. A born-red seed would additionally force the preflight
   staleness check (`src/loop.ts:985–992`) to demand a non-empty baseline, for no gain.
4. **D4 — The defect is `truncate(text, limit)` returning `limit + 1` characters.** The docstring
   states the correct contract (the ellipsis counts toward the limit); the code cuts at `limit` and
   then appends the ellipsis. One cause, one obvious one-line fix, and no second reading — the
   WI-14 lesson's trap (a contradiction satisfiable by *adding* a parameter) does not apply.
5. **D5 — The fixture's identity lives in one module**, `tests/integration/fixture.ts`, which every
   later ticket imports. `FIXTURE_REPO` is a single constant so T2–T6 never re-spell it.
6. **D6 — The integration surface is a second vitest config, not a filter on the first.**
   `vitest.integration.config.ts` includes `tests/integration/**/*.test.ts` and sets
   `passWithNoTests: false` **deliberately**: an integration command that finds no tests must fail,
   not report success. `vitest.config.ts` is not touched, so `npm test` cannot change.
7. **D7 — `tests` joins `tsconfig.json`'s `include`.** Today the integration test would be the only
   TypeScript in the repo that `npm run typecheck` never checks. Adding it is test configuration,
   in scope under FR-003's boundary.
8. **D8 — The seed's suite is checked by a read-only copy into the container, not a bind mount.**
   `docker run --user 0:0 -v <clone>:/src:ro … 'cp -r /src /work && …'` — pip must write to system
   site-packages, and a read-only mount keeps root-owned `__pycache__` and `*.egg-info` off the
   host clone. The practice repo's `.gitignore` lists both for the same reason.
9. **D9 — The suite check reads its verdict through `parsePytestFailures` and `SUITE_SUMMARY_RE`**,
   the harness's own parser, and compares against the profile's `baselineFailures`. The fixture is
   thereby proven *not stale* by the same rule the harness will apply at preflight, rather than by
   a second, weaker judgement.

## The seed — exact contents

Eight files, committed as the fixture's single seed commit. Identity for that commit:
`manjula <manjula@bitcot.com>` — the practice repo's seed identity.

**`.gitignore`** — note the deliberate absence of `.loop-harness/` (D2).

```
__pycache__/
*.pyc
*.egg-info/
.pytest_cache/
.venv/
.sandcastle/
```

**`README.md`** — the inner fence is four backticks so the file's own `bash` block survives.

````markdown
# loop-integration-fixture

A **disposable** Python fixture for the
[software-factory-loop](https://github.com/manjula25/software-factory-loop)
integration test.

Not a real library, and **not** the practice fixture (`loop-fixtures-py`):
this repository exists to be reset, rewritten and merged into by an automated
test, and its history is expendable.

The seed carries one latent defect that the contract suite does not cover,
with an open issue describing the symptom.

## Install and test

```bash
pip install -e ".[test]"
pytest
```

Fully offline: no network, no services.
````

**`pyproject.toml`**

```toml
[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[project]
name = "loopsample"
version = "0.1.0"
description = "Small text utilities (disposable integration fixture for software-factory-loop)"
requires-python = ">=3.10"
license = { text = "MIT" }

[project.optional-dependencies]
test = ["pytest>=7"]

[tool.setuptools.packages.find]
where = ["src"]
```

**`src/loopsample/__init__.py`**

```python
"""loopsample — small text utilities."""

from loopsample.textops import truncate

__all__ = ["truncate"]
```

**`src/loopsample/textops.py`** — the docstring states the contract; the last line is the defect (D4).

```python
"""Text utilities for loopsample."""

ELLIPSIS = "…"


def truncate(text: str, limit: int) -> str:
    """Return *text* shortened to at most *limit* characters.

    Text that already fits is returned unchanged. Longer text is cut and an
    ellipsis marks the cut, the ellipsis counting toward the limit:
    ``truncate("abcdef", 4) == "abc…"`` (three characters plus the ellipsis).
    """
    if len(text) <= limit:
        return text
    return text[:limit] + ELLIPSIS
```

**`tests/test_textops.py`** — the contract suite. All three cases pass **with the defect present**
(D3); none of them reaches it.

```python
"""Tests for loopsample.textops."""

from loopsample.textops import truncate


class TestTruncate:
    def test_short_text_unchanged(self):
        assert truncate("abc", 10) == "abc"

    def test_exactly_at_limit_unchanged(self):
        assert truncate("abcde", 5) == "abcde"

    def test_long_text_is_cut_and_marked(self):
        result = truncate("abcdefghij", 5)
        assert result.endswith("…")
        assert result.startswith("abc")
```

**`.loop-harness/profile.json`** — committed (D2); no `notifyHandle` (FR-009), no
`confidentialityCleared`, matching the practice repo.

```json
{
  "language": "python",
  "installCmd": "pip install -e \".[test]\"",
  "testCmd": "pytest -q",
  "singleTestCmd": "pytest -q {test}",
  "baselineFailures": [],
  "expectedDurationSec": 3,
  "autoMerge": true
}
```

## Tasks

### T1.1 — The integration test surface

**Files:** `vitest.integration.config.ts` (new), `package.json`, `tsconfig.json`.

`vitest.integration.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Deliberately false: an integration command that finds no tests must fail,
    // not report success. A check that cannot fail is not evidence.
    passWithNoTests: false,
    include: ["tests/integration/**/*.test.ts"],
  },
});
```

`package.json` — add to `scripts`, leaving every existing entry untouched:

```json
"test:integration": "vitest run --config vitest.integration.config.ts",
```

`tsconfig.json` — `"include": ["src", "scripts", "tests", "vitest.config.ts"]`.

**RED:** `npm run test:integration` → exits **1** with vitest's "No test files found" — the surface
exists and refuses to pass empty.

**GREEN:** none yet; T1.2 supplies the first test.

**Unchanged, and checked here:** `npm test` is still 10 files / 287 tests, and `npm run typecheck`
still exits 0.

**Commit:** `test(WI-16): add the integration test surface, isolated from the default gate`

### T1.2 — The fixture identity and its absence guard

**Files:** `tests/integration/fixture.ts`, `tests/integration/fixture.test.ts` (both new).

`tests/integration/fixture.ts`:

```ts
/**
 * WI-16 T1 — the disposable integration fixture, named in exactly one place.
 *
 * The fixture is provisioned once, by hand, under owner authority (see
 * `docs/work/WI-16/implementation-plan.md`, T1.3). No test creates it: creating
 * a GitHub repository is outward-facing, and a test that makes its own target
 * cannot tell a missing fixture from a working one.
 */
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The disposable fixture. NOT `loop-fixtures-py` — that one is the practice repo. */
export const FIXTURE_REPO = "manjula25/loop-integration-fixture";

/** The fixture's base branch. */
export const FIXTURE_BRANCH = "main";

/** Where the test keeps its clone. Under tmpdir: this is scratch, not source. */
export const FIXTURE_CLONE_DIR = join(tmpdir(), "loop-integration-fixture");

/** The production image — T1 checks the seed here; the scenarios pass their own (T2). */
export const PRODUCTION_IMAGE = "sandcastle-loop";

/** Thrown when the fixture is absent or unreachable, always with the setup instruction. */
export class FixtureMissingError extends Error {
  constructor(repo: string, detail: string) {
    super(
      `integration fixture ${repo} is missing or unreachable (${detail}). ` +
        `Provision it once, under owner authority, per ` +
        `docs/work/WI-16/implementation-plan.md T1.3. This test never creates it.`,
    );
    this.name = "FixtureMissingError";
  }
}

/** The single guard. Everything else in this directory runs behind it. */
export function assertFixtureReady(repo: string = FIXTURE_REPO): void {
  try {
    execFileSync("gh", ["repo", "view", repo, "--json", "name"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new FixtureMissingError(repo, error instanceof Error ? error.message : String(error));
  }
}

/** Read a fixture file from the remote, so a check need not depend on a local clone. */
export function readFixtureFile(path: string, repo: string = FIXTURE_REPO): string {
  return execFileSync(
    "gh",
    ["api", `repos/${repo}/contents/${path}`, "-H", "Accept: application/vnd.github.raw"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}
```

`tests/integration/fixture.test.ts`:

```ts
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { ProjectProfile } from "../../src/loop.js";
import { SUITE_SUMMARY_RE, parsePytestFailures } from "../../src/verify.js";
import {
  FIXTURE_BRANCH,
  FIXTURE_CLONE_DIR,
  FIXTURE_REPO,
  PRODUCTION_IMAGE,
  assertFixtureReady,
  readFixtureFile,
} from "./fixture.js";

let profile: ProjectProfile;

beforeAll(() => {
  assertFixtureReady(FIXTURE_REPO);
  profile = JSON.parse(readFixtureFile(".loop-harness/profile.json")) as ProjectProfile;
  if (!existsSync(FIXTURE_CLONE_DIR)) {
    execFileSync("gh", ["repo", "clone", FIXTURE_REPO, FIXTURE_CLONE_DIR], { stdio: "inherit" });
  }
});

describe("the disposable integration fixture (WI-16 T1)", () => {
  it("exists on GitHub with the base branch the harness will drive", () => {
    const view = JSON.parse(
      execFileSync("gh", ["repo", "view", FIXTURE_REPO, "--json", "name,defaultBranchRef"], {
        encoding: "utf8",
      }),
    ) as { name: string; defaultBranchRef: { name: string } };
    expect(view.name).toBe("loop-integration-fixture");
    expect(view.defaultBranchRef.name).toBe(FIXTURE_BRANCH);
  });

  it("carries a profile that is opted in, unnotifiable, and born green", () => {
    expect(profile.language).toBe("python");
    expect(profile.autoMerge).toBe(true);
    expect(profile).not.toHaveProperty("notifyHandle");
    expect(profile.baselineFailures).toEqual([]);
  });

  it("has a contract suite that is green in the production image", () => {
    const out = execFileSync(
      "docker",
      [
        "run", "--rm", "--user", "0:0",
        "-v", `${FIXTURE_CLONE_DIR}:/src:ro`,
        "--entrypoint", "bash", PRODUCTION_IMAGE, "-lc",
        'cp -r /src /work && cd /work && pip install -q -e ".[test]" && pytest -q',
      ],
      { encoding: "utf8" },
    );
    expect(SUITE_SUMMARY_RE.test(out)).toBe(true);
    expect(parsePytestFailures(out)).toEqual([...profile.baselineFailures]);
  });
});
```

**RED:** `npm run test:integration` → all three tests fail, each carrying
`integration fixture manjula25/loop-integration-fixture is missing or unreachable …` — the guard
fires, and the message names what is missing and where the provisioning instructions are.

Record the run verbatim to `docs/work/WI-16/evidence/t1-fixture-missing.log`.

**GREEN:** T1.3.

**Commit:** `test(WI-16): guard the fixture's absence with the setup instruction`

### T1.3 — Provision the fixture repository and seed its issue

**Outward-facing. This task needs the owner's explicit authority at the moment it runs** —
`docs/agents/issue-tracker.md` defaults to read-only, and creating a repository and filing an issue
are mutations. Nothing below is executed by the plan itself.

```bash
# 1. the seed, in a scratch directory outside this repo
SEED="$(mktemp -d)/loop-integration-fixture"
mkdir -p "$SEED/src/loopsample" "$SEED/tests" "$SEED/.loop-harness"
# 2. write the eight files from "The seed — exact contents" above
# 3. one commit, under the practice repo's seed identity
cd "$SEED" && git init -b main && git add -A
git -c user.name="manjula" -c user.email="manjula@bitcot.com" \
  commit -m "seed: loopsample with a latent truncate defect"
# 4. create and push — public, matching the practice repo
gh repo create manjula25/loop-integration-fixture --public --source=. --remote=origin --push
```

Then the open issue — symptom only, **no cause, no attachment URL**:

```bash
gh issue create --repo manjula25/loop-integration-fixture \
  --title 'truncate() returns one character more than the limit' \
  --body-file /tmp/loop-integration-fixture-issue.md
```

Body:

```markdown
Truncated strings come back one character longer than the limit I passed.

    >>> from loopsample import truncate
    >>> truncate("abcdefghij", 5)
    'abcde…'
    >>> len(truncate("abcdefghij", 5))
    6

I asked for a 5-character result and got 6. The docstring says the result is
"at most `limit` characters" and that the ellipsis counts toward the limit, so
`truncate("abcdefghij", 5)` should be `'abcd…'`.

Strings that already fit come back unchanged, which is correct.

Nothing else in the library looks wrong.
```

**Read back, never assumed:**

```bash
gh repo view manjula25/loop-integration-fixture --json name,visibility,defaultBranchRef
gh issue list --repo manjula25/loop-integration-fixture --state open
```

Expected: `visibility: PUBLIC`, `defaultBranchRef.name: main`, and exactly **one** open issue —
numbered `1`, which normalizes to id `gh-1` and therefore to
`tests/fixed-issues/test_gh_1.py` for the reproduction test scenario 1 will write.

**GREEN:** `npm run test:integration` → **3 passed**. Record the run verbatim to
`docs/work/WI-16/evidence/t1-fixture-green.log`.

**Commit:** `test(WI-16): record the fixture's provisioning and the first green run`

### T1.4 — The planted-defect pair for the guard

T1.3's RED proved the guard fires when the fixture is absent. This proves it is the *guard* doing
it, and that it can go back to green — the recorded RED→GREEN pair the ticket asks for.

1. Edit `FIXTURE_REPO` in `tests/integration/fixture.ts` to
   `manjula25/loop-integration-fixture-does-not-exist`.
2. `npm run test:integration` → **3 failed**, each with the setup instruction.
3. Revert the constant.
4. `npm run test:integration` → **3 passed**.

Record all four outputs, with the commands, to `docs/work/WI-16/evidence/t1-guard-planted-defect.log`.

**Commit:** `test(WI-16): record the fixture guard's planted-defect pair`

### T1.5 — Record the seed's provenance

**Files:** `docs/work/WI-16/implementation-notes.md` (new — this is where implementation begins),
`docs/work/WI-16/verification.md` (new).

Append to `implementation-notes.md`: the seed commit's SHA and subject as read back from the
fixture, the issue number and its normalized id, and the four `.gitignore` decisions that differ
from the practice repo (D2's committed profile; nothing else).

`verification.md` records the claims T1 makes and the exact commands that prove them, with the
outputs and exit codes — the three passing tests, the planted-defect pair, and the
missing-fixture RED. Its evidence boundary states what T1 does **not** prove: nothing about the
harness's wiring (no scenario runs yet — that is T4), nothing about the reset or the guard
(T3), and nothing about the escalation path (deliberately unexercised, FR-009).

**Commit:** `docs(WI-16): record T1's seed provenance and its verification record`

## What T3 inherits (so it does not re-decide)

- The integration command already exists (`npm run test:integration`), so T3's criterion "the
  dedicated command exists" is satisfied by T1 and T3 only has to keep it honest — it adds the
  reset, the guard, and the preconditions, and asserts `npm test` is unaffected.
- `FIXTURE_CLONE_DIR` and a clone-if-absent step already exist. **T3 owns the reset** and replaces
  the existence-only clone with a reset-to-seed, on both the remote and the local clone.
- `tests/integration/fixture.ts` is the one place any later ticket spells the fixture.

## Risks, stated

- **The image must be built before T1.3's green run** — `npm run build:image`. Absent it, the third
  test fails on a missing image, not on the fixture.
- **`docker run` writes nothing to the host clone** by design (D8). If a later ticket mounts the
  clone read-write and runs pip inside it, the host clone gains root-owned `*.egg-info` and
  `__pycache__` — which `.gitignore` covers but `git reset --hard` does not.
- **The fixture is effectively permanent**: the token has no `delete_repo` scope. If it is ever
  wrong, it is fixed forward, not deleted.

## Non-claims

This plan delivers T1 and nothing else. It does not run the harness, does not substitute an agent,
does not reset anything, and adds no file under `src/`.