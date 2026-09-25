# T8 — Docs honesty for the new command and the option it needs

## What to build

The documentation catches up with the delivered command, in the same delivery as the code — the
standing rule of the module table, and FR-013.

`docs/agents/workflow.md:24` — the **Pipeline integration (local Docker)** row — gains two things it
does not carry today:

1. **the dedicated integration command**, under its own name, as the scenarios actually invoke it;
2. **`--image`** — the option the scenarios pass to select the test image, which `src/loop.ts:2605`
   already accepts and the table has never listed.

The row must not imply the command runs by itself.

`CLAUDE.md` — the module table and the testing-tiers description — stays honest about what the new
command does and does not prove:

- it executes the harness's real entry against a real GitHub fixture with only the agent
  substituted, so the entry's subprocess wiring is covered for the branches the scenarios drive;
- it is **not** the default gate, and **nothing runs it automatically** — there is no CI and no
  hook, so the trigger is the verification stage's own requirement that a claim about the wiring
  carry fresh evidence for the exact candidate (FR-011's non-claims);
- A-2 is **narrowed, not closed**.

Any lesson the work produced lands as one line under `## Lessons`, in the repository's existing
form. No new lint step is introduced, and none exists.

## Blocked by

T4 — the row cannot honestly describe what the command proves until the command has been shown to
prove it.

## Requirement coverage

FR-013; slice F.

## Acceptance criteria

- [ ] `workflow.md`'s Pipeline integration row names the integration command exactly as the
      scenarios invoke it (`review`, matched against the command T3 delivered)
- [ ] The same row documents `--image` (`review`)
- [ ] Neither document claims the command runs automatically, and the module table says A-2 is
      narrowed rather than closed (`review`)
- [ ] Every claim in both documents is read off the delivered code and command, not off this ticket
      or the specification (`review`, with the source of each claim identified)

## Evidence boundary

Documentation only — it proves nothing about behavior, and its own claims are only as good as the
tickets they describe. Review-verified; no run is evidence for a doc edit.

## Status

Ready for planning