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
