# WI-3 Implementation Plan — attachment fetching + non-GitHub sources

Source of record: `docs/work/WI-3/specification.md` (approved 2026-09-17) and
`docs/work/WI-3/tickets/` (T1–T6, approved). Every task below maps to one ticket and
names exact files, commands, and expected results. No placeholders.

Two repository facts this plan builds on (verified 2026-09-17):

- **`copyToWorktree`** exists on Sandcastle 0.12.0's `RunOptions`
  (`node_modules/@ai-hero/sandcastle/dist/index.d.ts:553`): "Paths relative to the host
  repo root to copy into the worktree before sandbox start." Attachment delivery is a
  passthrough of this native option — no new mechanism, no adapter fork trigger.
- The existing secrets guard already wraps every prompt (`src/loop.ts:226`
  `assertNoSecrets([prompt], deps.env)`), so attachment excerpts inlined into prompts
  are guarded with no new wiring.

Standing rules for every task: `npm test` green and `npm run typecheck` clean before
committing; one commit per task with the exact message given; tests at the public seam
(vitest on exported functions), never source-text assertions.

---

## Task 1 — T1: Attachment discovery + confidentiality gate

Files: `src/attachments.ts` (new), `src/attachments.test.ts` (new),
`src/onboard-profile.ts` (new), `src/onboard-profile.test.ts` (new), `scripts/onboard.ts`
(edit), `src/loop.ts` (edit, one field).

**RED.** Write `src/attachments.test.ts` first — all cases fail (module absent):

- `discoverAttachmentUrls` cases: single URL; duplicate URL → once; URL in prose and
  inside a code fence; multiple URLs → all, order-preserving; inline-log body without
  URLs → `[]`; `https://github.com/owner/repo/issues/1` → `[]` (non-attachment ignored).
- Source-independence: the same body text passed as a GitHub body, spec-doc section
  text, and plain-list line yields identical discovery output.
- `assertClearedForAttachments({ confidentialityCleared: undefined }, [url])` throws
  `ConfidentialityGateError` whose message contains the repo name and both resolutions
  ("clear the repo" / "drop the attachment"); with `confidentialityCleared: true` and
  zero URLs → returns without throwing; cleared + URLs → no throw.
- `src/onboard-profile.test.ts`: `onboardProfile(argv, runFacts)` with
  `--confidentiality-cleared` absent → returned profile has no
  `confidentialityCleared` field (never `false`, never inferred); flag present
  (valueless, like `--triage` in `src/loop.ts:546`) → `confidentialityCleared: true`;
  `--install`/`--test`/`--single-test` passthrough preserved.

**GREEN.**

- `src/attachments.ts`:
  - Module-private regex `ATTACHMENT_URL_RE` (not exported — behavior tests only):
    `/https:\/\/github\.com\/user-attachments\/[^\s)`\]]+/g`
  - `export function discoverAttachmentUrls(body: string): string[]` — matchAll,
    order-preserving `[...new Set(...)]`.
  - `export class ConfidentialityGateError extends Error` (name set, like
    `QueueAcquisitionError` in `src/queue.ts:29`).
  - `export function assertClearedForAttachments(profile: { readonly
    confidentialityCleared?: boolean }, urls: readonly string[], repoName: string): void`
    — throws iff `urls.length > 0 && profile.confidentialityCleared !== true`.
- `src/onboard-profile.ts`: one exported function
  `onboardProfile(argv: readonly string[], runFacts: { baselineFailures: readonly
  string[]; durationSec: number })` absorbing the argv parsing from
  `scripts/onboard.ts:20-27` and the profile construction from
  `scripts/onboard.ts:57-64` — flag parsing and profile shaping in one function.
  `scripts/onboard.ts` keeps only sandbox execution, suite parsing, and output, and
  writes the returned profile verbatim.
- `src/loop.ts`: add `readonly confidentialityCleared?: boolean` to `ProjectProfile`
  (`src/loop.ts:43`). No behavior change yet.

Run: `npm test` (new suites pass, existing 30+ unchanged), `npm run typecheck` clean.

Commit: `feat(WI-3): attachment URL discovery + confidentiality gate (T1)`

**Refactor-while-green:** none expected — the module is new.

## Task 2 — T2: Attachment fetch, delivery, loud degrade

Files: `src/attachments.ts` (extend), `src/attachments.test.ts` (extend),
`src/sandcastle-adapter.ts` (edit), `src/loop.ts` (edit), `src/loop.test.ts` (extend).

**RED.** Extend `src/attachments.test.ts` with `vi.stubGlobal("fetch", stub)` — no
dependency-injection interface; the stub records each call's `RequestInit`:

- Cleared fetch: stub 200 with body bytes (incl. binary-safe content) →
  `fetchAndStageAttachment` returns `{ stagedPath, excerpt }`; bytes written verbatim
  under `<repoDir>/.loop-harness/attachments/<issueId>/<basename(url)>`.
- **No-auth assertion:** the captured `RequestInit.headers` of the initial request and
  every redirect hop (stub returns 302 → second call) contain no `authorization` key,
  case-insensitive.
- 404 stub → returns `{ failed: url, reason }` shape — no throw.
- Two URLs, first 404, second 200 → second still fetches and stages.
- `buildAttachmentExcerpt(bytes)` → first + last `EXCERPT_LINES` (20) lines joined with
  a `… (N total lines, full file at <path>)` separator; exact shape pinned.

Extend `src/loop.test.ts` (uses the existing stubbed `LoopDeps` pattern plus
`vi.stubGlobal("fetch", …)` — `LoopDeps` itself gains no new member):

- Issue whose description carries an attachment URL, uncleared profile →
  `runSingleIssue` returns `{ failure }` containing `ConfidentialityGateError`'s
  message, and `createFixSandbox`/`runFixRun` were **never called** (zero API/Docker
  spend on refusal).
- Cleared profile, stub fetch 200 → `runFixRun` receives
  `copyToWorktree: [".loop-harness/attachments/<id>/<file>"]` and a prompt containing
  the excerpt and the in-sandbox file path.
- Cleared, stub 404 → run proceeds; `formatSummary` output contains
  `ATTACHMENT FAILED <id>: <url>`; `buildPrBody` output contains
  `attachment fetch failed: <url>`.

**GREEN.**

- `src/attachments.ts`:
  - `export function fetchAndStageAttachment(input: { url; repoDir; issueId }):
    Promise<StagedAttachment | AttachmentFetchFailure>` — global `fetch` called
    directly (redirects followed natively), `AbortSignal.timeout(30_000)`, host-side
    staging via `node:fs` (mkdir recursive, write bytes as-is; filename =
    `new URL(url).pathname` basename).
  - Module constant `export const EXCERPT_LINES = 20` and
    `export function buildAttachmentExcerpt(content: string): string` (no parameter).
- `src/sandcastle-adapter.ts`: add `readonly copyToWorktree?: readonly string[]` to
  `FixRunInput` (`src/sandcastle-adapter.ts:75`) and pass it into `run()`
  (`src/sandcastle-adapter.ts:96`). Two-line change, boundary test untouched (still the
  only sandcastle importer).
- `src/loop.ts`, inside `runSingleIssue` before the preflight block
  (`src/loop.ts:230` — refusal must precede any sandbox spend):
  1. `const urls = discoverAttachmentUrls(input.issue.description);`
  2. `assertClearedForAttachments(input.profile, urls, input.repoDir)` — gate refusal
     returns `{ branch, failure: error.message }` (issue-level; the queue continues —
     issues without attachments in the same repo still run).
  3. Fetch each URL; stage successes, collect `attachmentFailures`.
  4. `buildFixPrompt` gains an optional attachments section: excerpt block + the
     in-sandbox path (`src/loop.ts:152`); for failures, the "expected but unavailable"
     line with the URL.
  5. `deps.runFixRun` call gains `copyToWorktree` when anything staged.
  6. `buildPrBody` gains an optional `attachmentFailures` note; `QueueSummary` gains
     `attachmentFailures: [string, string][]`; `formatSummary` prints
     `ATTACHMENT FAILED <id>: <url>` lines; `runQueue` threads outcomes through. The
     excerpt lands inside `prompt`, which already passes `assertNoSecrets`
     (`src/loop.ts:226`) — no new guard call needed, but a test asserts the guarded
     prompt still contains the excerpt.
  7. Tests intercept fetching with `vi.stubGlobal("fetch", …)` — `LoopDeps` is
     unchanged (no `fetchAttachment` member).

Run: `npm test`, `npm run typecheck`.

Commit: `feat(WI-3): attachment fetch, sandbox delivery, loud degrade (T2)`

**Refactor-while-green:** if `runSingleIssue` grows past ~150 lines, extract the
attachment block into a helper in `src/attachments.ts` — behavior-neutral, tests stay.

## Task 3 — T3: Spec-doc normalizer

Files: `src/issues.ts` (extend), `src/issues.test.ts` (extend).

**RED.** `src/issues.test.ts` cases (fail — functions absent):

- Three-`##`-section fixture (one with a `log: ./logs/a.txt` line, one with a
  `log: https://github.com/user-attachments/assets/x` line) → three `NormalizedIssue`
  entries; each compared field-by-field against a hand-built GitHub-issue entry's
  shape (`id`/`description`/`attachedLog` present-iff-bound; only `sourceType` and
  `url` differ) — the PRD L90 shape-equality test.
- Slug: `"Camera JSON overwrite"` → `spec-camera-json-overwrite`; two identical
  headings → `spec-<slug>` and `spec-<slug>-2`.
- Zero `##` headings (incl. `#`-only and `###`-only documents) → `SpecDocParseError`
  with a message naming the file problem; distinct from an unreadable-file error.
- `log:` line binds only its own section; a `log:` before any `##` is ignored
  (pinned).
- Description = heading line + content verbatim until the next `##`.

**GREEN.** `src/issues.ts`:

- `export function slugify(text: string): string` — lowercase, non-alphanumerics →
  `-`, collapse/trim (shared with Task 4; unit-pinned by the cases above).
- `export class SpecDocParseError extends Error`.
- `export function parseSpecDoc(text: string): NormalizedIssue[]` — split on
  `/^## (.+)$/m`; per section: id `spec-${slugify(title)}` with in-document collision
  counter; description `# ${title}\n\n${body}` (matching
  `normalizeGitHubIssue`'s title prefix at `src/issues.ts:39`); `log:` line (regex
  `/^log:\s*(\S+)\s*$/m`) sets `attachedLog`; `sourceType: "spec-doc"`.

Run: `npm test`, `npm run typecheck`.

Commit: `feat(WI-3): spec-doc source normalizer with slug ids (T3)`

## Task 4 — T4: Plain-list normalizer

Files: `src/issues.ts` (extend), `src/issues.test.ts` (extend).

**RED.** Cases: three-line fixture with `# comment` lines interleaved, one line with
`| ./logs/b.log`, one with `| https://github.com/user-attachments/assets/y` → three
shape-identical entries (PRD L90); slug + collision `list-<slug>-2`; comments-only and
empty text → `PlainListParseError`; trailing pipe (`foo |`) → **loud rejection**
(pinned — no silent drop); the `|` suffix is stripped from the description.

**GREEN.** `src/issues.ts`: `export class PlainListParseError extends Error`;
`export function parsePlainList(text: string): NormalizedIssue[]` — non-empty,
non-`#`-prefixed lines; optional `/ \| (\S+)$/` suffix → `attachedLog` (path-or-URL
kept verbatim, opaque); id `list-${slugify(line-without-suffix)}` with collision
counter; `sourceType: "plain-list"`.

Run: `npm test`, `npm run typecheck`.

Commit: `feat(WI-3): plain-list source normalizer (T4)`

## Task 5 — T5: Source selection + queue parity

Files: `src/loop.ts` (edit), `src/queue.ts` (no behavior change), `src/loop.test.ts`
(extend), `src/queue.test.ts` (extend).

**RED.**

- `src/loop.test.ts`: `runQueue` with `sourceIssues` preset (two `spec-*`, one
  `list-*`) → `deps.ghJson` **never called** (acquisition replaced); `formatSummary`
  first line contains `source: spec-doc (<path>)` / `source: plain-list (<path>)` /
  unchanged default shape for GitHub.
- CLI arg parsing (exported helper, tested like `parseCap` at `src/loop.ts:493`):
  `--spec-doc <path>` and `--plain-list <path>`; both together → startup error
  ("sources cannot be combined"); unreadable file → named error before any sandbox
  work; parse errors from Task 3/4 surface verbatim.
- `src/queue.test.ts`: `splitQueue` over a mixed queue (`gh-1`, `spec-camera-json`,
  `list-stale-pin`) with an open PR whose body mentions `spec-camera-json` → that id
  skipped-duplicate, others eligible; a stale local `fix/list-stale-pin` branch →
  deleted, retried. (Pins that the existing dedup at `src/queue.ts:138` is already
  source-agnostic — no production change expected in `src/queue.ts`.)

**GREEN.**

- `src/loop.ts`: `QueueRunInput` gains optional `sourceIssues?: readonly
  NormalizedIssue[]` and `sourceName?: string`; `runQueue` uses them instead of
  `listOpenIssues` when present (`src/loop.ts:393`). `QueueSummary` gains
  `source?: string`; `formatSummary` prefixes it.
- `main()`: after profile load, if `--spec-doc`/`--plain-list` given →
  `readFileSync`, `parseSpecDoc`/`parsePlainList`, pass `sourceIssues` + `sourceName`;
  validation errors throw before any worktree/sandbox call. GitHub path untouched
  when neither flag is passed.

Run: `npm test`, `npm run typecheck`.

Commit: `feat(WI-3): --spec-doc/--plain-list source selection, mixed-queue parity (T5)`

## Task 6 — T6: Live evidence runs (pipeline integration)

Files: `docs/work/WI-3/evidence/` (new logs), `docs/work/WI-3/evidence.md` (new note).
No source changes.

Preconditions: `sandcastle-loop` image current (`npm run build:image`); fixtures clone
at `.loop-work/loop-fixtures-py` or a fresh `gh repo clone manjula25/loop-fixtures-py`;
profile exists; `.env` carries the claude-via-proxy provider.

1. **Gate refusal record**: temporarily remove `confidentialityCleared` from the
   fixtures profile, run
   `npm run loop -- --repo <fixtures-dir> --issue 3 --provider claude-via-proxy` →
   expect the named `ConfidentialityGateError` failure and no fetch; restore the field.
2. **Live attachment run** (profile cleared — re-run
   `npx tsx scripts/onboard.ts <fixtures-dir> --confidentiality-cleared` with the
   recorded install/test overrides, or hand-edit the one field):
   same command → expect attachment staged, prompt excerpt, normal fix outcome; PR on
   `fix/gh-3`. Preserve summary verbatim →
   `docs/work/WI-3/evidence/fixtures-attachment-gh-3.log`.
3. **Non-GitHub source end-to-end**: author a 1–2 entry spec doc describing one known
   fixtures bug (from its existing GitHub issue text), run
   `npm run loop -- --repo <fixtures-dir> --spec-doc <file> --provider claude-via-proxy`
   → expect preflight → fix → fresh-sandbox verify → PR on `fix/spec-<slug>`.
   Preserve summary → `docs/work/WI-3/evidence/fixtures-spec-doc-run.log`.
4. `docs/work/WI-3/evidence.md`: three records linked to FR-002/FR-003/FR-008; note
   that opened PRs await human review (never merged by the harness).

Commit: `docs(WI-3): live evidence runs — attachment fetch, spec-doc source, gate refusal (T6)`

---

## Sequencing and rollback

Dependency order = task order; Tasks 1, 3, 4 are mutually independent and could run
as parallel worktrees if desired. Every task ends green (`npm test` +
`npm run typecheck`), so any task can be reverted by reverting its single commit —
no task rewrites a later task's ground. Task 6 spends API budget only at the end, and
its refusal check (step 1) is the cheapest run in the plan.

## Traceability

| Task | Ticket | FRs | Commit |
|---|---|---|---|
| 1 | T1 | FR-001, FR-002 | `feat(WI-3): attachment URL discovery + confidentiality gate (T1)` |
| 2 | T2 | FR-003, FR-004 | `feat(WI-3): attachment fetch, sandbox delivery, loud degrade (T2)` |
| 3 | T3 | FR-005 | `feat(WI-3): spec-doc source normalizer with slug ids (T3)` |
| 4 | T4 | FR-006 | `feat(WI-3): plain-list source normalizer (T4)` |
| 5 | T5 | FR-007, FR-008 | `feat(WI-3): --spec-doc/--plain-list source selection, mixed-queue parity (T5)` |
| 6 | T6 | FR-002/003/008 (live) | `docs(WI-3): live evidence runs — attachment fetch, spec-doc source, gate refusal (T6)` |
