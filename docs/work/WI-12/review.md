# WI-12 — Code review (four-axis, batch level)

## Identities

- Fixed point: `003fbd1` (post-ponytail plan, local main)
- Candidate: `be0e016` (branch `worktree-wi-12`) — ancestry valid (merge-base =
  fixed point), tree clean, range non-empty (11 commits)
- Record-only fix after this review: `verification.md` commit-count correction
  (see Axis 3); docs-only, `src/` byte-identical, behavioral identity unchanged.

## Changed-path accounting (all 5 accounted)

| Path | What changed |
|---|---|
| `src/loop.ts` | 2 hunks: FR-001 conditional spread (uncanaried return); FR-002 present-arm `@` rendering + comment |
| `src/loop.test.ts` | 4 new tests ((q2)/(f3)/(r)/(e3)); 1 fixture knob (`sandboxCloseThrowsMsg`, default-preserving); 1 sanctioned pin supersession in (f2) |
| `CLAUDE.md` | `src/loop.ts` module-row wording (T5) |
| `docs/work/WI-12/implementation-notes.md` | checkpoint evidence (new) |
| `docs/work/WI-12/verification.md` | evidence record (new) |

## Axis verdicts (separate, evidence-backed)

### Axis 1 — Repository standards: **PASS**

No blocking/adjacent findings. Module row accurate to the diff (claims map
one-to-one onto the two production hunks); hard constraints untouched (the
`autoMerge: true` in tests is pre-existing fixture setup, not policy change);
all new tests at the public seam (zero source-text assertions); no invented
lint; no new dependency/module; comment provenance and knob conventions match
the file. One sub-threshold nit: trailing blank lines at the end of
implementation-notes.md.

### Axis 2 — Specification fidelity: **PASS**

One ADJACENT finding, ruled acceptable at batch level: the
`sandboxCloseThrowsMsg` fixture knob (`src/loop.test.ts:1622`, use `:1690`) was
an implementer deviation beyond the plan's named knob — test-fixture-only in
the named file, `??`-defaults to the byte-identical WI-11 literal, exists
solely for (r)'s attributable literal, recorded in the T3 notes with both
per-checkpoint rulings. The (f2) title/comment edits are inside the spec's
sanctioned-pin clause (leaving them claiming "pinned bare" would be a stale
lie). All four FRs fully met; no scope creep; CLAUDE.md row matches what is
built.

### Axis 3 — Evidence and risk integrity: **PASS**

One TASTE finding, **fixed by record-only commit**: verification.md's identity
line said "11 commits" at `4b09d97` (correct: 10 — the 11th is the record
itself). Reviewer independently confirmed `4b09d97..be0e016` adds only
verification.md with `src/` byte-identical, so the fresh evidence applies
verbatim to the review candidate. Per-FR map holds; sanctioned-pin audit
verified (exactly one existing assertion changed); non-claims cover the real
boundaries; the bare→@ string-shape risk honestly named; adjacent A1/A2
deferred with effect and owner; evidence is fresh re-runs, not agent
self-signal.

### Axis 4 — Unnecessary complexity: **PASS**

No blocking/adjacent findings. Two TASTE notes: (a) the conditional spread now
appears twice (uncanaried + reverted) — a shared helper would cost more
indirection than it saves at count 2-3; revisit at a fourth site; (b) the
(f2)/(f3) assertion duplication is deliberate (supersession
cross-reference). The fixture knob is justified by exactly one use and not
speculative. Production delta is 2 hunks / ~6 effective lines against four FRs.

## Aggregated findings ledger

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | ADJACENT | fixture knob deviation (Axis 2) | ruled acceptable; recorded T3 notes |
| 2 | TASTE | verification.md commit-count error (Axis 3) | **fixed** — record-only commit |
| 3 | TASTE | spread duplication ×2 (Axis 4) | follow-up ledger (revisit at 4th site) |
| 4 | TASTE | (f2)/(f3) assertion duplication (Axis 4) | kept deliberately |
| 5 | nit | trailing blank lines in notes (Axis 1) | fixed in the same record-only commit |

## Unverified evidence

None — all four axes had authoritative artifacts (approved spec, plan, notes,
verification record) and the full diff.

## Blocking findings

**None.** Verification remains fresh for the exact candidate (record-only docs
change since; `src/` byte-identical). Next: `finishing-a-development-branch`.
