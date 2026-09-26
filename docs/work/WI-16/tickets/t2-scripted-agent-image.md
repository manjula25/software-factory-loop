# T2 — The scripted-agent image

## What to build

A test-only sandbox image, defined alongside the production image and built from it, in which the
**agent entry points are scripts** instead of a live model. Everything else stays production: same
base, same git / curl / jq / gh, same Node, same Python and pytest, same non-root user, same `PATH`
treatment.

The harness spawns an agent by resolving a binary on `PATH` — `claude`, `codex` or `opencode`, per
the provider the run selected. The production image installs those into `/home/agent/.local/bin`,
which is already on `PATH` (`.sandcastle/Dockerfile:40`). The test image shadows that directory
with scripts. This is the whole substitution: the agent executable and nothing else (FR-002).

The scripts must answer the harness's real contract rather than bypass it — the point is to remove
the model, not the interface:

- **the fix pass** — writes the known patch for the seeded bug plus a reproduction test, commits
  them under the harness's identity, and answers on the stream the harness parses
  (`--output-format stream-json`), so the run's own parsing path is exercised;
- **the pre-merge review pass** — answers the review verdict contract the harness parses back, so
  the merge chain can proceed.

No scenario may call a real provider, and no scenario may require a real provider credential: a
credential that resolves the provider registry is enough and its value may be a placeholder
(`specification.md`, non-functional constraints).

**No production source file changes.** The image build and its wiring are test configuration;
`src/sandcastle-adapter.ts` already takes the image name as an input and `main()` already exposes
it as an option. If the substitution turns out to need a change under `src/`, that is the
specification's stop condition — report it, do not make it (FR-003).

## Blocked by

None — can start immediately.

## Requirement coverage

FR-002; FR-003; slice A.

## Acceptance criteria

- [ ] The test image builds from the production image definition and differs from it only in the
      agent entry points (`review of the image diff`)
- [ ] Running the harness with the test image and a placeholder provider credential, the fix-pass
      script's patch and reproduction test land on a branch — with no real model invoked and no
      API spend (`integration run`)
- [ ] The review-pass script's answer satisfies the harness's verdict parser (`integration run`)
- [ ] The delivered diff adds fixtures, an image definition and tests, and changes no file under
      `src/` (`review`, with the changed-path list accounted for)

## Evidence boundary

Proves the substitution is real, minimal and source-free. Does not prove the harness's wiring — the
image is only exercised end to end once T4 drives a scenario through it, and this ticket's own runs
are the smallest invocation that shows the scripts responding. Does not prove anything about a real
model, in either direction (FR-002's non-claims).

## Status

Ready for planning