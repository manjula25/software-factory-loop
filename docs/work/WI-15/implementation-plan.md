# WI-15 — Implementation Plan

**Status:** In force. Tasks T1–T4 are complete on `worktree-wi-15` and T5 (the verification record)
is pending — see `implementation-notes.md`. The earlier "Draft — awaiting owner approval. No
implementation has begun." header was stale and is corrected 2026-09-24.

**Approved scope:** `docs/work/WI-15/specification.md` (FR-001..FR-006), approved 2026-09-23 by
the owner's invocation of `writing-plans`; traced to `docs/work/WI-15/prd.md` decisions 1–9 and
`docs/work/WI-15/slices.md` (one slice). `to-tickets` was skipped by decision 8 — there is no
dependency graph to sequence (one slice), and the reason is recorded here per that decision.

**Base:** `main` @ `0d371ef` (`Merge pull request #19 …`). **Branch:** `worktree-wi-15`,
worktree `.claude/worktrees/wi-15`, per `docs/agents/workflow.md` worktree policy.

## Baseline (record before the first commit, at `0d371ef`)

Commands are the authoritative ones from `docs/agents/workflow.md` (Repository commands); no
command is invented and there is no lint step to run.

| Command | Expected at baseline |
|---|---|
| `npm run typecheck` | exit 0 |
| `npx vitest run src/loop.test.ts` | exit 0 — 162 tests |
| `npm test` | exit 0 — 283 tests, 10 files |

`npm run build:image` / `npm run smoke:image` are **deliberately not run** for this work item:
no `Dockerfile` or `scripts/` file changes, so the image result is candidate-independent — the
same position WI-14's verification record took. This is recorded as a non-claim in
`verification.md`; the owner may override it.

## T0 — Land the planning-chain inputs on `main`

The three chain inputs are untracked. WI-14's precedent (commits `42b64b1`, `e488832`,
`ef8d52e`) is to land them on `main` before the branch, so a PR's diff is the implementation
range alone.

```
git add docs/work/WI-15/prd.md docs/work/WI-15/slices.md docs/work/WI-15/specification.md
git commit -m "docs(WI-15): grilling record, slices, and specification"
```

Verify: `git status --short docs/work/WI-15/` is empty for those three files.
**Not pushed** — pushing is a separate, explicitly authorized delivery action.

## T1 — One constant for the label name (FR-005)

**Files:** `src/loop.ts`.

**Change:** define the name once and use it at all three existing sites.

```ts
/** WI-15 (FR-005): the label's name, defined once — the create, the add/remove edit and the
 *  membership check must not be able to drift apart. */
export const HARNESS_FAILED_LABEL = "harness-failed";
```

Place it with the other module-level constants. Then replace the literal at:

- `src/loop.ts:2725` — the `gh issue edit … <labelFlag> "harness-failed"` argument;
- `src/loop.ts:2949` — the `gh label create "harness-failed" …` argument;
- `src/loop.ts:2958` — the static console line, as `` `label "…" already exists — nothing to create` ``.

`src/loop.test.ts` keeps its own literals: they are fixture text, not the product's name.

**Verify:** `npm run typecheck` exit 0; `npx vitest run src/loop.test.ts` exit 0, **162** tests
(no behavior change).

**Commit:** `refactor(wi-15): one constant for the harness-failed label name (FR-005)`

## T2 — Add the issue-label read seam (no behavior change)

**Step 1 — confirm the JSON shape; do not assume it.** One read-only command, its output
recorded verbatim as the first entry of `docs/work/WI-15/evidence/label-state-probes.log`:

```
gh issue list --repo manjula25/loop-fixtures-py --state all --limit 5 --json number,labels
```

Expected: `labels` is an array of objects carrying `name` (gh's Label export shape). If it
instead returns bare strings, the parse below is `JSON.parse(stdout).labels.map(String)` — the
two cases are the only fork in this step.

This step is not ceremony: assuming what a subprocess prints is the defect this work item
exists to remove, so the shape is observed before any parse is written.

**Step 2 — the interface.** In `src/loop.ts`, add to `LoopDeps`, beside `setIssueLabel`:

```ts
  /**
   * WI-15 (FR-001): the labels an issue currently carries — the evidence the
   * removal decides from, replacing WI-14's error-text classifier. Read at the
   * removal site, not at acquisition: the state must be fresh, or a label a
   * human removed out-of-band would send the removal into a call that fails
   * (FR-005's boundary: a missing label is success). Wiring-only, not exercised
   * by vitest — correctness is code review plus the recorded probes.
   */
  readIssueLabels(repoDir: string, issue: NormalizedIssue): Promise<readonly string[]>;
```

**Step 3 — the real wiring**, beside `setIssueLabel` in the same object literal:

```ts
    async readIssueLabels(dir: string, issueToRead: NormalizedIssue) {
      const raw = execFileSync(
        "gh",
        ["issue", "view", issueNumberFromUrl(issueToRead.url), "--json", "labels"],
        { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      return (JSON.parse(raw) as { labels: readonly { name: string }[] }).labels.map((l) => l.name);
    },
```

**Correction (review, 2026-09-23):** this snippet originally printed
`stdio: ["ignore", "inherit", "pipe"]`. That is defective: with stdout inherited, `execFileSync`
returns `null`, `JSON.parse(null)` is `null`, and the `.labels` read throws on **every** call, so
the read could never succeed. The shipped wiring pipes stdout (`["ignore", "pipe", "pipe"]`) and
comments why; the correction came from the specification review, not from this plan — re-executing
step 3 as first written would re-seed the bug.

**Step 4 — the test seams.** In `src/loop.test.ts`: add `readIssueLabels` to `makeDeps` and to
the queue-deps builder, both defaulting to **present** so every existing removal-arm assertion
keeps passing unchanged:

```ts
    // WI-15 seam (FR-001): the label state the removal decides from. Defaults to
    // the label being present — the pre-WI-15 assumption every existing
    // removal-arm test was written against.
    readIssueLabels: vi.fn(async (_repoDir: string, _target: NormalizedIssue) => {
      if (config.readLabelsThrows !== undefined) {
        throw new Error(config.readLabelsThrows);
      }
      return config.readLabels ?? [HARNESS_FAILED_LABEL];
    }),
```

The same body goes in `makeDeps`, reading `overrides` where the queue builder reads `config`
(that file's two builders use different names for their override bag) — the shape stays
identical to the neighbouring `commentOnIssue` / `setIssueLabel` fakes.

Add one knob to the overrides type, beside `setLabelThrows`: `readLabelsThrows?: string`
(a throwing read) and `readLabels?: readonly string[]` (an arbitrary label set). Import
`HARNESS_FAILED_LABEL` from `./loop.js` in the test file.

**Verify:** `npm run typecheck` exit 0; `npm test` exit 0 — **283** tests, 10 files (the seam
is additive; no assertion changes).

**Commit:** `feat(wi-15): add the issue-label read seam (no behavior change)`

## T3 — The removal decides from the read; the classifier is deleted (FR-001..FR-004)

**RED.** Add to the existing label block in `src/loop.test.ts` (after the `(e) a non-GitHub
issue` test at `:3730`):

- **(f) label not applied: the removal is never attempted, nothing is recorded, and the
  delivered-success outcome is unchanged** — `readLabels: []`; expect
  `deps.setIssueLabel` not called, no `LABEL REMOVE FAILED` in the summary text, no
  `harness-failed label remove failed:` in the single-issue text, `escalationLabelFailure`
  undefined, run exit 0.
- **(g) a throwing label read: the removal is skipped and the read is recorded on the existing
  line** — `readLabelsThrows: "gh: HTTP 502 — bad gateway"`; expect `deps.setIssueLabel` not
  called, `escalationLabelFailure` to equal
  `could not read the issue's labels: gh: HTTP 502 — bad gateway`, the queue summary to contain
  `LABEL REMOVE FAILED <id>: could not read the issue's labels: gh: HTTP 502 — bad gateway`, the
  single-issue text to contain the same reason on the `harness-failed label remove failed:`
  line, the merged outcome otherwise unchanged, and the run green.
- **(e) extended** — assert `deps.readIssueLabels` not called for a non-GitHub issue.

Run `npx vitest run src/loop.test.ts` → **RED**, and for the stated reasons: today the removal is
attempted unconditionally, so (f)'s "not called" and (g)'s "not called" both fail.

**GREEN.** In `src/loop.ts`:

1. `clearHarnessFailedLabel` (`:798`) — read, then decide:

```ts
async function clearHarnessFailedLabel(
  input: SingleIssueInput,
  deps: LoopDeps,
): Promise<{ escalationLabelFailure?: string }> {
  if (input.issue.url === undefined) {
    return {};
  }
  let labels: readonly string[];
  try {
    labels = await deps.readIssueLabels(input.repoDir, input.issue);
  } catch (error) {
    // FR-003: a failed READ is recorded and the removal is skipped — never
    // guessed at, never silent.
    const reason = error instanceof Error ? error.message : String(error);
    return { escalationLabelFailure: `could not read the issue's labels: ${reason}` };
  }
  if (!labels.includes(HARNESS_FAILED_LABEL)) {
    // FR-001: a missing label is success (FR-005's boundary) — implemented by
    // not calling, not by forgiving an error.
    return {};
  }
  try {
    await deps.setIssueLabel(input.repoDir, input.issue, "remove");
  } catch (error) {
    return { escalationLabelFailure: error instanceof Error ? error.message : String(error) };
  }
  return {};
}
```

Update its JSDoc: the closing sentence about the wiring's classifier ("Removal is idempotent by
contract: the wiring's classifier treats a missing label as success…") is replaced by the
read-before-remove contract.

2. `setIssueLabel` (`:2720`) — delete the `try`/`catch` and the regex outright; the call is left
   bare. **Keep `stdio: ["ignore", "inherit", "pipe"]`**: the piped fd 2 is why Node puts gh's
   stderr into the thrown error's message, which is what makes the recorded reason useful
   (verified locally: `"Command failed: …\nBOOM-STDERR\n"`). Deleting the pipe would silently
   thin every recorded label failure. Update the JSDoc accordingly (the classifier paragraph
   and its "the same classifier shape as `setIssueLabel` above" reference in
   `ensureHarnessFailedLabel` both go stale — fix the reference, leave that function's own
   `/already exists/i` check alone, per decision 5).

**Verify:** `npx vitest run src/loop.test.ts` exit 0 — **164** tests; then `npm test` exit 0 —
**285** tests, 10 files; `npm run typecheck` exit 0.

**Refactor-while-green:** with the classifier gone, re-read `ensureHarnessFailedLabel`'s JSDoc
against what the function now shares with `setIssueLabel` (the piped-fd rationale) — no code
change belongs there.

**Commit:** `fix(wi-15): decide the label removal from the issue's labels, not from error text (FR-001..FR-004)`

## T4 — Docs honesty and evidence (FR-006)

**Files:** `CLAUDE.md`, `docs/work/WI-15/evidence/label-state-probes.log`.

1. `CLAUDE.md` module table, the `src/loop.ts` row: extend the WI-14 clause so it states the
   read-before-remove behavior — the labels are read at the removal site, the label comes off
   only when the issue carries it, a failed read is recorded on the existing line and skips the
   removal, and no error text is interpreted (WI-15).
2. `CLAUDE.md` `## Lessons`: one line — a subprocess classifier's reachability must be probed
   across *all* its cases before it is called dead code: probe 2 (label absent → exit 0) looked
   like proof the classifier was unreachable, but probe 4 (label not in the repo →
   `'…' not found`) is the case that fires it (2026-09-23, WI-15).
3. `docs/work/WI-15/evidence/label-state-probes.log`: the five probes already run on 2026-09-23
   (T2's shape probe first), each with its command, exit code and verbatim output, plus the
   read-only repo-label check, and a one-line statement of what each proves.

No `docs/agents/workflow.md` change: no command changed.

**Verify:** none required (documentation); the next task's gate set runs against this candidate.

**Commit:** `docs(wi-15): module row and grilling lesson (FR-006)`

## T5 — Verification record

Run the gate set **fresh at the final candidate** (`verification-before-completion`):
`npm run typecheck`, `npx vitest run src/loop.test.ts`, `npm test` — capture output and exit
codes; write `docs/work/WI-15/verification.md` with the mapping from each completion claim to its
proving command, the evidence boundary, and the non-claims:

- the two `gh` calls are wiring, not exercised by vitest, and **no live run was bought**
  (decision 7) — proven by review plus the recorded probes;
- `build:image` / `smoke:image` not run, with the reason above;
- FR-002's "no error-text matching remains" is diff-verified, not test-verified;
- FR-005 is review-evidenced (structural).

**Commit:** `docs(wi-15): verification record at <final-sha>`

Then `code-review`, then `finishing-a-development-branch` (delivery is a PR; this repository
keeps human merge — hard constraint 1).

## Traceability

| Task | FRs | Slice |
|---|---|---|
| T1 | FR-005 | 1 |
| T2 | FR-001 (seam), FR-003 (seam) | 1 |
| T3 | FR-001, FR-002, FR-003, FR-004 | 1 |
| T4 | FR-006 | 1b |
| T5 | all (evidence) | 1, 1b |

## Rollback

Every task is a commit on `worktree-wi-15`; nothing is pushed and `main` is untouched after T0.
Reverting any single task is `git revert <sha>` on the branch; abandoning the work item is
deleting the branch and the worktree, since no shared state exists outside them.

## Explicit non-goals (not in this plan)

- No change to the add path or to `ensureHarnessFailedLabel` (decision 5).
- No change to FR-005's semantics, to any merge/canary/revert behavior, or to hard constraint 1.
- No amendment of WI-14's records (decision 9).
- No live run, no image build, no new command surface, no lint.