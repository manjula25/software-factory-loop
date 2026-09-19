# WI-9 Implementation Notes

Controller record for the implement loop over `docs/work/WI-9/implementation-plan.md`
(post-ponytail at `278bbf7`).

Baseline (recorded 2026-09-19, worktree `.claude/worktrees/wi-9`, branch
`worktree-wi-9`, base local `main` @ `278bbf7` — created from `origin/main`
`dd7a4d3` and fast-forwarded to local main to carry the planning artifacts):
clean tree; `npm run typecheck` exit 0; `npm test` 10 files / 216 tests exit
0. `.env` copied into the worktree root (untracked; never committed, never
echoed — the provider credentials source per workflow.md).

---

## Task 1 — worktree + environment preconditions + seed (FR-001, slice 1)

- **Size:** small-medium, controller-executed (no harness code changes; no
  leaf implementer — external gh writes and fixtures-repo commits are
  authorized by the approved plan, which the owner invoked via `/implement`).
- **Risk:** low on the harness side (docs-only evidence commit); medium on
  the external side (fixtures `main` push + two issue creates — additive and
  revertable per the plan's rollback section).
- **Budget:** zero LLM except one agent probe (minimal call, ledgered).
- **Evidence boundary:** image build + 9-check smoke + probe + seed checks +
  preflight MATCH; no fix runs yet.
- **Fixed point:** `278bbf7` (clean tree, baseline recorded above).
- **Intended candidate:** working tree vs `278bbf7`; evidence commit message
  `docs(WI-9): T1 seed evidence — numops seeded, issues filed, suite green, preflight MATCH`.

### Checkpoint records — Tasks 1–4 ACCEPTED 2026-09-19 (controller-executed)

This work item changes no harness `src/` code (branch diff = docs + evidence
only), so the leaf-implementer/review-package loop had no code candidate to
run; every task was controller-executed live evidence per the plan, and the
work-item-level code review follows at stage 4.

- **T1 (seed, `64e882c`):** environment preconditions green (image built,
  smoke 9/9, probe OK — ledgered); seed `88a18c3` pushed; suite 17 passed in
  the image; preflight MATCH; issues #22/#23 filed (actuals vs plan's
  expected #21/#22 — #21 was taken; recorded). Deviation: seed suite check
  ran in a fresh clone inside the Docker image (host lacks pytest) —
  strictly stronger isolation.
- **Run 1 (`4fbcd9c`):** exactly the plan-expected chain — triage ranked
  gh-22 (4) over gh-23 (3), both naming numops.py; gh-22 fixed by the real
  LLM (born-red evidence in PR #24), verified in a fresh sandbox,
  squash-merged `5f372b6`, canary green, issue closed; gh-23 deferred
  `file overlap with gh-22`. Exit 0. End-states read back fresh.
- **Run 2 (`f11100f`):** deferred issue admitted (re-admission proof), same
  chain green, PR #25 merged `b46c9ef`, issue closed, no triage pass. Exit 0.
  Operational deviation: controller session restarted mid-run; the run
  process survived detached and completed normally; re-observed on wake.
- **T4 (verification, this commit):** final fresh-clone proof — both fixes
  in numops.py, both repro tests present, 23 passed green; spend ledger
  exactly 1 probe + 1 triage + 2 fix runs, zero retries; no defects surfaced
  (Task 5 never triggered); harness gates fresh at `f11100f` (216/10,
  typecheck 0). Standing pipeline-integration non-claim CLOSED for this
  tree; remaining non-claims stated in verification.md.

Adjacent follow-ups (recorded, not fixed): stale `origin/fix/gh-{1,2,3,10}`
branches on the fixtures repo from prior work items; naturally-red-canary /
revert path live-proven only on the older WI-6 T7 tree.
