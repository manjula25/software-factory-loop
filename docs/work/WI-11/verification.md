# WI-11 — Verification record

## Completion claim (exact, no optimistic qualifiers)

On branch `worktree-wi-11` at candidate `413fd13` (fixed point `cddaf49`,
local main):

1. **FR-001:** a merged or reverted run's outcome carries teardown
   failures from both origins as distinct fields (`teardownFailure` =
   early, `canaryTeardownFailure` = canary); the queue MERGED line and
   single-issue report name both when both fail. Single-failure rendering
   is byte-identical to pre-WI-11 on the MERGED summary line and every
   early-origin surface. One surface legitimately changed: a CANARY-only
   teardown on a merged run now renders on the single-issue report as
   `canary teardown failed: <reason>` (previously `sandbox teardown
   failed: <reason>`) — origin-labeling per d1; no test pinned the old
   line, and the four-axis review records it as ADJACENT finding A1
   against FR-001's "output is unchanged" letter.
2. **FR-002:** a verification failure (install-fail, unreadable suite, or
   verification-rejected) whose sandbox close also throws carries the
   teardown reason beside the failure — FAILED-line suffix + report stderr
   line — with reason, kind, and exit codes unchanged.
3. **FR-003:** the reverted failure line renders `notify handle not
   configured` when no handle is configured, identical to the uncanaried
   detail and queue REVERTED line; present-handle rendering byte-identical.
4. **FR-004:** the stale WI-6 emission comment corrected (guarding is at
   the CLI entry); dated append-only addenda added to the WI-9 and WI-10
   records.
5. **FR-005:** the CLAUDE.md `src/loop.ts` module row states the WI-11
   surfaces accurately.
6. All gates pass fresh; every checkpoint passed sequential spec +
   code-quality reviews at its exact identity.

## Proving commands (all run fresh at `413fd13`, 2026-09-19)

| Check | Command | Result |
|---|---|---|
| Candidate pinned | `git rev-parse HEAD` | `413fd13ee4c815d3e79ae2499e247a91a0759941` |
| Typecheck | `npm run typecheck` | exit 0 |
| Full suite | `npm test` | exit 0 — 10 files, 219/219 passed (baseline 216 + 3 new) |
| Focused | `npx vitest run src/loop.test.ts` | exit 0 — 111/111 passed |
| New tests by name | `npx vitest run src/loop.test.ts -t "WI-11"` | exit 0 — 3 passed, 108 skipped |
| Vocabulary unification | `grep -n "notify handle not configured" src/loop.ts` | 3 sites: `:311`, `:1097`, `:1415` |
| Old string gone | `grep -c "notify: not configured" src/loop.ts src/loop.test.ts` | src: 0; test: 1 (the negative assertion in test (f2)) |
| Addenda append-only | `git diff cddaf49..413fd13 -- <WI-9/WI-10 docs> \| grep "^-"` | only the two `--- a/` diff headers; zero content deletions |
| Changed-path accounting | `git diff --stat cddaf49..413fd13` | 6 files: `src/loop.ts`, `src/loop.test.ts`, `CLAUDE.md`, `docs/work/WI-9/verification.md`, `docs/work/WI-10/evidence/run-endstates.md`, `docs/work/WI-11/implementation-notes.md` — all plan-named |

Full outputs: `/tmp/wi11-typecheck.log`, `/tmp/wi11-fulltest.log`,
`/tmp/wi11-focused.log`, `/tmp/wi11-newtests.log` (counts quoted above;
logs are session-temp, the counts and identities here are the record).

## Per-FR evidence map

- **FR-001** → test (p) (`src/loop.test.ts`, dual-throw green merge):
  pins both outcome fields, both report stderr lines, both-origin MERGED
  line; test (l) canary-only MERGED-line pin byte-identical and untouched.
- **FR-002** → test (e2): pins outcome field, report stderr line, FAILED
  line `endsWith` suffix, failure reason unchanged, `createPr` not called.
- **FR-003** → test (f2): pins unified absent string + negative pin on the
  old rendering + bare present-handle contrast; grep confirms the 3-site
  unification (above).
- **FR-004** → diff inspection: comment rewording in `src/loop.ts`
  (behavior-neutrality proven by identical gate counts before/after);
  addenda append-only (grep proof above).
- **FR-005** → diff inspection: one row updated; other rows checked,
  accurate, unchanged.

## Review chain (all at exact candidate identities)

| Checkpoint | Candidate | Spec review | Quality review |
|---|---|---|---|
| T1 (FR-001) | `bbd3d1c` | PASS | PASS |
| T2 (FR-002) | `cfc7d3f` | PASS (deviation accepted) | PASS |
| T3 (FR-003) | `30d59b6` | PASS (plan-text error documented) | PASS |
| T4/T5 | `92cd626` / `b15b8ae` | controller docs tasks; gates identical | — |

## Evidence boundary, non-claims

- **Harness-source surface only** (vitest at the public seam). **No
  pipeline/Docker run was performed** — the spec's stated non-claim; these
  changes are record-shape and rendering precision over unit-pinned
  paths, with no sandbox-lifecycle logic touched.
- **FR-006 not executed** (stale-branch deletion): delivery-time,
  authority-gated by decision d3; branches still exist; the delivery
  record will mark it executed-with-read-back or pending.
- The uncanaried-merge return still drops an early teardown failure
  (adjacent finding, T1 implementer) — out of FR-001's scoped surface,
  recorded in implementation-notes for a future work item.
- No live CLI run; the three new tests pin the behavior at the seam the
  CLI consumes.

## Unknowns, deferred items, remaining risks

- Closed: none were open at implementation start (planning resolved all
  three design decisions d1–d3 with the owner).
- Deferred (adjacent, non-blocking, recorded in implementation-notes):
  (a) reverted-path early-teardown lift untested at the seam; (b)
  fail()-path with both early teardowns failing untested; (c)
  present-handle @-rendering asymmetry (`notify: manjula25` bare on the
  canary line vs `notify: @manjula25` on siblings) — intentional,
  FR-003-pinned; (d) uncanaried early-teardown drop.
- Remaining risks: none within the claimed boundary. Hard constraints
  untouched: no auto-merge behavior change (1), no verification-gate
  change (2), no client data (3), no suite-artifact change (4), no spend
  (5), no cloud (6).
