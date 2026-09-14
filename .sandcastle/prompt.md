# This file is intentionally unused by the loop

In vanilla Sandcastle, `prompt.md` holds one fixed, human-written task, launched via
`run({ promptFile: ".sandcastle/prompt.md" })` from `main.ts` below.

This harness does the opposite: every prompt is composed at runtime from a GitHub issue —
`buildFixPrompt()` in `src/loop.ts` (issue symptom + attached log + the target project's
onboarded commands + the required RED/GREEN evidence format) — and passed inline as
`run({ prompt })`. Two reasons a static file cannot work here:

1. The task differs per issue; there is no fixed task to write down.
2. Every string the harness emits passes the secrets guard (`src/assert-no-secrets.ts`)
   before it leaves; a prompt written straight into this file would bypass that gate.

To run the loop, use `npm run loop -- --repo <dir> --issue <n> --provider <name>` —
see `docs/agents/workflow.md`. `main.ts` remains the stock init template, kept for the
`sandcastle init` scaffold record (FR-001); nothing imports it.
