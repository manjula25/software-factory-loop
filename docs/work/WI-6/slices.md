# WI-6 Slices

Dependency-ordered; each slice is independently verifiable at a public
seam and lands as its own checkpoint. Evidence labels: `unit` (vitest) or
`pipeline-integration` (live flow against the seeded fixtures repo in
Docker).

1. **Opt-in flag** (`unit`) — `--auto-merge` at onboarding →
   `autoMerge: true` in the profile; absent → omitted; hand-editable
   (field read wherever the profile is read). No behavior change anywhere
   else yet. *No dependencies.*

2. **Merged-PR dedup** (`unit`) — acquisition/dedup treats a merged fix PR
   as "issue done", not just open PRs; stale `fix/<id>` branch logic
   re-checked against merged state. *No dependencies; independent of
   slice 1.*

3. **Merge machinery behind the flag** (`unit`) — `mergePr` dep
   (squash-merge via `gh`) + mode-aware wiring in the loop: on
   `autoMerge: true`, after verification-green, merge; on conflict or
   merge failure → no auto-merge, PR open, run continues (loudly
   recorded); PR body text becomes mode-conditional. *Depends on 1.*

4. **Canary + revert + halt + notify** (`unit`) — post-merge fresh-sandbox
   suite on main; green → proceed; red → revert the merge commit, halt the
   queue run, @-mention comment on the merged PR, `⚠️ REVERTED` summary
   section, failing exit code. *Depends on 3.*

5. **Issue closing on merge** (`unit`) — gh-sourced issues closed with an
   evidence comment on successful merge (post-canary only); other sources:
   no-op. *Depends on 4 (closing only after the canary holds).*

6. **Pre-merge review pass** (`unit` + one live exercise) — cheap-model
   diff review between verification and merge on opted-in repos only;
   uncertain/wrong/unavailable → skip auto-merge, PR open with comment,
   run continues. *Depends on 3; can be built in parallel with 4/5 but
   merges after 3.*

7. **Pipeline integration** (`pipeline-integration`) — live fixtures run
   with auto-merge on: seeded bug → PR → review pass → merge → canary
   green → issue closed; plus an observed canary-red → revert → halt →
   notification scenario. *Depends on all above.*
