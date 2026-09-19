# WI-11 — Cleanup & docs batch (PRD carve-out)

Carved from the accumulated, explicitly-recorded follow-up findings of
WI-8/WI-9/WI-10 (each deferred with owner visibility in those work items'
verification/review records). Anchors in the PRD of record: hard
constraint 2's posture (failures recorded loudly, never silently dropped
or overwritten) and the "keep every record honest" convention; the PRD
wins on any disagreement. No new product behavior is invented — this
batch makes existing failure-recording behavior and its records precise.

## Scope

### A. Failure-recording precision (harness `src/`, RED/GREEN at the public seam)

1. **Canary-wins teardown precedence (WI-8):** when both an early sandbox
   teardown and the canary teardown fail on a merged run, the canary's
   reason currently overwrites the early one (single-field structure).
   Both reasons should be recorded — neither dropped.
2. **fail()-path `sandboxTeardown` drop (WI-8, brief-sanctioned gap):**
   a teardown failure on the fail() path is currently dropped entirely
   (declared before the sandbox exists). Record it beside the failure
   like its siblings do.
3. **Reverted-surface notify vocabulary mismatch (WI-8 T3 review):**
   the reverted summary line says `notify: not configured` while the
   uncanaried detail says `notify handle not configured` — unify on the
   precise wording (pinned-string updates in the same commit as the
   change).

### B. Code/docs hygiene (no behavior change)

4. Stale WI-6 comment wording in `src/loop.ts` ("this emission passes the
   guard" — guarding moved to `main()` in WI-8).
5. WI-9/WI-10 record addenda (dated, append-only — evidence is never
   rewritten): cite PR #24/#25/#27 RED/GREEN body evidence in the WI-9
   run records and WI-10's end-states; fix WI-9 verification's
   probe-attribution wording ("exactly the approved plan (design decision
   (b))" — the probe's authorization is the implementation plan).

### C. Stale-branch cleanup (external git ops, delivery-time)

6. Delete stale fixtures branches `origin/fix/gh-{1,2,3,10}` (leftovers
   from prior work items; tolerated by the stale-branch pass) and the
   local `worktree-wi-2-trial` branch (no worktree attached).

## Out of scope (explicit non-goals, recorded taste calls from WI-8)

- Cross-stream emit ordering (stdout-then-stderr; never an ordered
  contract).
- `formatSingleIssueResult` naming tension (defensible).
- The 137-char failed.push suffix line and the shared teardown-suffix
  helper (taste, below restructuring threshold).
- Tripled `throwOnClose` override blocks in makeDeps (existing factory
  idiom).
- Any behavior change beyond items 1–3; any new surface (the CLAUDE.md
  module rows change only if wording in a row becomes inaccurate).

## Open design decisions (for the spec stage)

1. Item 1's shape: two-field record (early + canary reasons both carried)
   vs joined single string — recommendation: two-field structure.
2. Item 2's placement: ride the existing FAILED summary line (suffix) vs
   a separate line — recommendation: suffix, matching the teardown-line
   precedent.
3. Item 6's authority: branch deletions are external and destructive —
   executed only at delivery with explicit owner authorization per
   branch set, read back after.
