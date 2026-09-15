# WI-2 Implementation Plan — Queue Ingestion

Approved scope: `docs/work/WI-2/specification.md` (FR-001–FR-006), `slices.md`,
`prd.md` (13 decisions), tickets `docs/work/WI-2/tickets/t1–t5`. Every task below
traces to a ticket and an FR.

## Setup (before Task 1)

1. `using-git-worktrees`: create worktree `worktree-wi-2` off `main` (currently `847ba3b`).
2. Move the untracked planning docs into the worktree (untracked files do not travel):
   `mkdir -p .claude/worktrees/wi-2/docs/work && mv docs/work/WI-2
   .claude/worktrees/wi-2/docs/work/`. Verify with
   `ls .claude/worktrees/wi-2/docs/work/WI-2/` (expect `prd.md  slices.md
   specification.md  tickets  implementation-plan.md`).
3. Baseline: `npm ci && npm install zod && npm test && npm run typecheck` — zod becomes a
   direct dependency (decision 15); 38/38 passing, clean typecheck, before any edit.

New source files: `src/queue.ts`, `src/queue.test.ts`. Modified: `src/loop.ts`,
`src/sandcastle-adapter.ts`, `docs/agents/workflow.md`. The adapter-boundary test
(`src/sandcastle-adapter.boundary.test.ts`) needs no change — `sandcastle-adapter.ts`
is already the sole allowlisted importer.

All unit tests run at the public seam with injected deps (`QueueDeps` below), never
asserting source text. Verification commands after every task: `npm test` (expect all
green) and `npm run typecheck` (expect clean).

---

## Task 1 — Queue acquisition (T1, FR-001)

**New seam** in `src/queue.ts`:

```ts
export interface QueueDeps {
  ghJson(args: string[], cwd: string): string; // execFileSync("gh", args, ...) wrapper
}
export interface ListIssuesInput { readonly repo: string; readonly label?: string; }
export class QueueAcquisitionError extends Error {} // named gh-failure outcome
export async function listOpenIssues(deps: QueueDeps, input: ListIssuesInput): Promise<NormalizedIssue[]>
```

Real implementation (wired in `src/loop.ts` main): `gh issue list --repo <owner/name>
--state open --limit 30 --json number,title,body,url` plus `--label <label>` when given;
`--limit 30` pins the one-page bound explicitly rather than relying on gh's default.
Each entry goes through the existing `normalizeGitHubIssue`. Empty list → `[]` (the
caller's named no-op). Non-zero `gh` exit or unparseable JSON → throw
`QueueAcquisitionError` naming the command and exit code — never an empty-list fallback.

**RED** — `src/queue.test.ts`:
1. Stubbed payload of three issues (one with a fenced code block in body, one without,
   one with empty `body: null`): all three normalize; `attachedLog` present iff a fenced
   block existed; ids are `gh-<number>`; `sourceType === "github-issue"`. Fails now:
   `listOpenIssues` does not exist.
2. `label: "bug"` → the stub records `--label bug` in gh args; absent label → no
   `--label` arg. Fails now (no function to call).
3. gh exits 1 → `QueueAcquisitionError` thrown (assert instance), distinct from the
   empty-result case which resolves `[]`.

**GREEN** — implement `listOpenIssues` in `src/queue.ts` exactly as above.

**REFACTOR while green** — none expected; keep `issues.ts` untouched.

**Commit:** `feat(queue): acquire open issues into the normalized queue (WI-2 T1)`

---

## Task 2 — Dedup and stale-branch cleanup (T2, FR-002)

**Extend `QueueDeps`** with the in-flight listing seam:

```ts
listOpenPrs(repoDir: string): Promise<{ headRefName: string; body: string }[]>;
listFixBranches(repoDir: string): Promise<string[]>; // local + remote fix/* branch names
deleteRemoteBranch(repoDir: string, branch: string): Promise<void>; // push origin --delete, tolerates absent
```

Real wiring: `gh pr list --state open --json headRefName,body` (run with `cwd: repoDir`);
branches = union of `git branch --list "fix/*"` (local) and `git ls-remote --heads origin
"refs/heads/fix/*"` (remote, stripped to short names).

**New function** `splitQueue(deps, repoDir, issues)`:

- Skip set: issue is *in flight* iff an open PR's `headRefName === fixBranch(issue)` **or**
  the PR body matches `new RegExp("\\b" + issue.id + "\\b")` — exact token, so `gh-1`
  never matches a body containing `gh-11` (the `\b` boundary plus full-id literal).
- Stale set: any `fix/<id>` branch (local or remote) for a queued issue with **no** open
  PR → local deletion via the existing `LoopDeps.deleteBranch` seam (already a tolerant
  `git branch -D` in try/catch from WI-1) plus `deleteRemoteBranch`, and the issue stays
  eligible — one local-deletion seam, no duplicate in `QueueDeps`.
- Listing failure (non-zero exit from `gh pr list` or the git listings) throws
  `QueueAcquisitionError` before any spend.

**RED** — extend `src/queue.test.ts`:
1. Queue of three; stub PRs `[{headRefName: "fix/gh-1", body: ""}]`, branches
   `["fix/gh-1", "fix/gh-2"]`: gh-1 skipped (PR), gh-2 stale branch deleted (both local
   and remote deleters recorded) and stays eligible, gh-3 untouched. Skipped issues
   produce no later sandbox call (asserted by what `splitQueue` returns — emptiness of
   the skip set's downstream use is Task 4's seam test).
2. Body `"see gh-11 also"` while checking `gh-1` → **not** matched (exact-token).
3. `gh pr list` exits 1 → `QueueAcquisitionError`, no deletions recorded.

**GREEN** — implement `splitQueue`.

**Commit:** `feat(queue): dedup against open PRs and clean stale fix branches (WI-2 T2)`

---

## Task 3 — Cap with deterministic default and opt-in triage (T3, FR-003)

**Pure admission function** in `src/queue.ts`:

```ts
export interface AdmitInput {
  readonly issues: NormalizedIssue[]; // the deduped, eligible queue
  readonly cap: number;               // validated >= 1 by the caller
  readonly triage?: { scores: Record<string, number>; files: Record<string, string[]> };
}
export interface NotAdmitted {
  readonly issue: NormalizedIssue;
  readonly reason: string; // "cap" or "file overlap with gh-N"
}
export interface AdmitResult {
  readonly admitted: NormalizedIssue[]; // admission order
  readonly notAdmitted: NotAdmitted[];
  readonly degraded: boolean; // true when triage output was present but unusable
}
export function admitIssues(input: AdmitInput): AdmitResult
```

Rules: cap ≥ 1 enforced by a thrown `Error("…--max-issues must be >= 1…")` at CLI parse
time (Task 4). No triage → sort by numeric id ascending, slice to cap, every overflow
entry `reason: "cap"` — no model call, no file knowledge (decision 9/10 unchanged). With
usable triage: sort by score desc, ties by numeric id asc, then **walk the ranked list**
admitting until the cap is filled — an issue whose `files` set intersects an
already-admitted issue's files is **deferred** (`reason: "file overlap with gh-N"`,
decision 14) and the walk continues to the next candidate. Triage present but unusable
(missing ids, wrong shape) → deterministic order, `degraded: true` (caller prints the
loud warning).

**Triage agent call** — new adapter export `runTriage` in `src/sandcastle-adapter.ts`:

```ts
export async function runTriage(input: {
  cwd: string; prompt: string; imageName: string; agent: AgentSpec;
}): Promise<string>
```

Implementation: `run({ cwd, prompt, name: "triage", agent: agentProvider(input.agent),
sandbox: sandboxProvider(input.imageName, <env from adapter's existing env seam>),
maxIterations: 1, branchStrategy: { type: "branch", branch: "loop/triage" } })`. The
prompt (built in `src/queue.ts`, passed through `assertNoSecrets` before dispatch) asks
for one JSON block inside `<triage>…</triage>` giving, per issue id, an integer priority
1–5 and the files the issue likely touches:
`<triage>{"scores":{"gh-1":3},"files":{"gh-1":["src/a.py"]}}</triage>`. The caller
(Task 4 wiring) extracts the block, deletes `loop/triage` afterwards via `deleteBranch`,
and validates it with a Zod schema — decisions 14–15:

```ts
const TriageOutput = z.object({
  scores: z.record(z.string(), z.number().int().min(1).max(5)),
  files: z.record(z.string(), z.array(z.string())),
});
export function parseTriageOutput(stdout: string, ids: string[]):
  { scores: Record<string, number>; files: Record<string, string[]> } | undefined;
```

`parseTriageOutput` returns the parsed value only when Zod validation passes **and**
every queued id appears in `scores` (missing coverage = unusable); otherwise `undefined`
→ degraded path.

**RED** — extend `src/queue.test.ts` (FR-003 criteria a–g):
1. Five issues, cap 3, no triage → first three by ascending number admitted, rest
   not-admitted with `reason: "cap"`, `degraded === false`.
2. Same with usable triage ranking gh-5 highest → gh-5 first; equal scores → ascending id.
3. Triage missing one id → deterministic order, `degraded === true`.
4. `parseTriageOutput`: well-formed block parses; garbage, mismatched tags, an
   out-of-range score (e.g. 9), and a non-integer score each → undefined (Zod rejects).
5. Dependency deferral (decision 14): cap 2, triage ranks gh-1 and gh-2 with overlapping
   `files` (both list `src/calculator.py`) and gh-3 disjoint → gh-1 admitted, gh-2
   deferred with `reason` naming `gh-1`, gh-3 admitted in its place; a non-overlapping
   issue keeps its ranked position.
6. Cap validation (`0`, negative, non-integer) is tested in Task 4 against the CLI parse
   helper; `admitIssues` itself takes a plain `number` and documents the cap ≥ 1
   precondition in its JSDoc (FR-003(f) assigns validation to startup).

**GREEN** — implement `admitIssues` (with the deferral walk), `parseTriageOutput`
(Zod schema), `runTriage`.

**Commit:** `feat(queue): capped admission, deterministic by default, opt-in triage (WI-2 T3)`

---

## Task 4 — Sequential runner, summary, CLI widening (T4, FR-004 + FR-005)

**`src/loop.ts` changes:**

1. Flag parsing: `--issue` becomes optional. New optional flags `--max-issues` (default
   3; parse, `Number.isInteger && >= 1` else throw naming the flag), `--label`,
   `--triage` (boolean via `args.includes`).
2. `--issue N` path: unchanged single-issue run, **preceded by the dedup check** — fetch
   `listOpenPrs`, and if the issue is in flight, print
   `[gh-N] skipped — open PR already references it` and exit 0 (no cap, no triage:
   decision 6).
3. Queue path (when `--issue` absent) — new exported `runQueue(input, deps)`:

```ts
export interface QueueRunInput {
  readonly ghRepo: string; readonly repoDir: string; readonly imageName: string;
  readonly agent: AgentSpec; readonly profile: ProjectProfile;
  readonly label?: string; readonly cap: number; readonly triage: boolean;
}
export interface QueueSummary {
  readonly attempted: string[]; readonly fixed: string[]; readonly failed: [string, string][];
  readonly skippedDuplicate: string[]; readonly notAdmitted: [string, string][]; readonly prUrls: string[];
} // notAdmitted entries are [id, reason] — "cap" or "file overlap with gh-N" (decision 14)
export async function runQueue(input: QueueRunInput, deps: LoopDeps & QueueDeps): Promise<QueueSummary>
```

Flow: `listOpenIssues` → `splitQueue` → if `eligible.length > cap && triage`:
`assertNoSecrets([prompt])`, `runTriage`, `parseTriageOutput`, `deleteBranch(loop/triage)`
→ `admitIssues` (degraded → `console.error` warning naming the fallback) → for each
admitted issue **sequentially**: `await runSingleIssue(...)`; on `outcome.failure`,
record `[id, failure]` and continue (runSingleIssue already deleted the fix branch);
a **thrown** error (credentials, stale-baseline preflight abort) propagates and ends the
queue — no summary is printed by `runQueue`; `main` prints the abort reason.

4. Summary (in `main`, after `runQueue` resolves): one block, `assertNoSecrets` applied,
   `console.log`:
   `Run summary — attempted: N (fixed: F, failed: X) | skipped-duplicate: S | not-admitted: M`
   followed by one `PR: <url>` line per opened PR, one
   `FAILED <id>: <failure>` line per failure, and one
   `NOT ADMITTED <id>: <reason>` line per not-admitted issue (reason is the cap or a
   file-overlap deferral naming the admitted issue it overlaps).

5. `docs/agents/workflow.md`: update the pipeline row — `npm run loop -- --repo <dir>
   [--issue <n>] [--label <label>] [--max-issues <n>] [--triage] --provider <name>`;
   note queue mode is the default and `--issue N` is the single-issue override.

**RED** — extend `src/loop.test.ts` (reuse `makeDeps`/`sandboxHandle` fixtures):
1. Three-issue queue via stubbed `QueueDeps` (listOpenIssues → gh-1/2/3; no PRs; no
   branches), `runFixRun` stub commits, second issue's verification fails: issues 1 and 3
   open PRs (exactly two `createPr` calls with `prUrl`s in summary), gh-2's branch
   deleted, summary counts `attempted: 3, fixed: 2, failed: 1`.
2. Sequential ordering: recorder timestamps show sandbox 1 fully closed before sandbox 2
   opens (extend `sandboxHandle`'s `commands` recorder with open/close markers).
3. Harness-level abort: first issue's preflight returns a stale baseline → error
   propagates out of `runQueue`, remaining issues never attempted.
4. `--max-issues 0` → startup `Error` naming the flag (unit-test the parse helper).
5. Over-cap queue without triage: first `cap` by ascending id admitted, `runTriage` dep
   never called; with `triage: true`: called once, admitted order follows stubbed scores,
   and an issue stubbed to overlap an admitted issue's files appears in `notAdmitted`
   with the overlap reason while never reaching `runSingleIssue`; degraded scores →
   warning printed (spy on `console.error`) and deterministic order.
6. `--issue N` with an open PR stubbed for it → skipped, `runSingleIssue` never called.

**GREEN** — implement the CLI changes and `runQueue`; wire real `QueueDeps` in `main`
(gh/git `execFileSync` wrappers + `runTriage`).

**Commit:** `feat(loop): sequential queue mode with dedup, cap, and run summary (WI-2 T4)`

---

## Task 5 — Live evidence runs (T5, FR-006)

No new product code. Execution procedure, captured to
`docs/work/WI-2/evidence/` (one log per run, full stdout):

0. Preconditions: Docker running; image current (`npm run build:image`); `.env` populated;
   proxy quota available.
1. **Run (a) — all-duplicates:** with fixtures PRs #5/#6/#7 still open, run
   `npm run loop -- --repo /Users/manju/Documents/loop-fixtures-py --provider claude-via-proxy`
   → expected: queue acquires gh-1/2/3, all three skipped-duplicate, zero sandboxes,
   summary matches observed PR state. Save to `evidence/run-a-all-duplicates.log`.
2. **Fixtures-state prep (execution-time decision, recorded when made):** close fixtures
   PRs #5/#6/#7 unmerged (`gh pr close`) and delete their remote `fix/gh-*` branches
   (`git push origin --delete`) plus any local leftovers — the bugs remain on `main`, so
   the issues stay valid fix targets. (Alternative — seeding new issues — rejected for
   now: no new bugs to eventually dispose of.)
3. **Run (b) — cap-forcing, deterministic:** `npm run loop -- --repo … --max-issues 1
   --provider claude-via-proxy` → expected: three eligible, gh-1 admitted
   (ascending order), one full per-issue path to a PR, two not-admitted reported with the
   cap named. Save to `evidence/run-b-cap1-deterministic.log`.
4. **Run (c) — cap-forcing, triage:** `--max-issues 1 --triage` → expected: scoring pass
   runs (`loop/triage` log exists, then deleted), the processed issue is the one ranked
   first; if scores come back unusable, the degraded path's warning appears in the log —
   either outcome is evidence, record which. Save to `evidence/run-c-cap1-triage.log`.
5. PRs opened by runs (b)/(c) stay open for human review (constraint 1). The
   `verification-before-completion` pass at work-item close re-runs and formally records
   everything into `docs/work/WI-2/verification.md`.

**Commit:** `test(wi-2): live queue-run evidence against fixtures (WI-2 T5)`

---

## Traceability matrix

| Task | Ticket | FR | Key decisions |
|---|---|---|---|
| 1 | T1 | FR-001 | 5, 12 |
| 2 | T2 | FR-002 | 4, 11 |
| 3 | T3 | FR-003 | 3, 7, 9, 14, 15 |
| 4 | T4 | FR-004, FR-005 | 2, 6, 11 |
| 5 | T5 | FR-006 | 8 |

## Rollback safety

Tasks 1–3 are purely additive (`src/queue.ts` + tests; one new adapter export). Task 4
is the only task touching existing behavior (`src/loop.ts` main); the `--issue N` path
keeps its current semantics plus one dedup check, and the existing 38 tests must stay
green through every task — any regression is one `git revert` of a single task commit.
