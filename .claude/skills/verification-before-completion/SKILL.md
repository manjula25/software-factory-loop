---
name: verification-before-completion
description: Use when completion is about to be claimed to map exact claims to fresh commands, full outputs, exit codes, and honest evidence boundaries.
---

# Verification Before Completion

## Required inputs

The exact candidate identity and exact claim proposed about it.

## Optional inputs

The verification commands listed in `docs/agents/workflow.md` (Repository commands), the approved plan task, implementation notes, external evidence, and prior unknowns.

## Required companion skills

None.

## Output

`docs/work/{WORK_ITEM}/verification.md` updated with proving commands, full output or durable output references, exit codes, evidence boundaries, unknown closure or deferment, remaining risks, and explicit non-claims.

## Project context

This repository has two surfaces and the proving commands differ per surface — harness source
(`src/`, TypeScript, proven with vitest at the public seam of the module) and pipeline
integration (proven by actually running the flow against a seeded buggy repo in Docker). The
authoritative list is `docs/agents/workflow.md` (Repository commands); where it reads
*(none yet)*, that surface is not scaffolded and **any claim about it is a stated non-claim, not
a pass**. An integration run that could not start for lack of Docker is likewise a non-claim,
not silence and not a pass. A fix claimed on the strength of an agent's own completion signal —
without the reproduction test and full suite re-run fresh — is a non-claim; that is the
project's core invariant. The public seam is never source text; a file-content check is not
behavioral evidence.

## Process

1. State the exact claim without optimistic qualifiers.
2. Map each part of the claim to the command, inspection, or external check that can prove it. Label checks outside available authority.
3. Run every proving command fresh against the exact candidate, from the directory that surface requires (`src/` for harness source, the repo root for a pipeline run). Capture full output and exit code; a prior run, partial run, or inferred result is not evidence.
4. Read the output, including skips, warnings, counts, environment, and failure status. Distinguish focused (one surface), broad (all surfaces), runtime, external, and human evidence.
5. Reconcile each prior unknown: close it with evidence or defer it explicitly with effect and owner. Record remaining risks.
6. Update `verification.md` and state only what the evidence proves. Include explicit non-claims for anything outside the evidence boundary (a validate-only run is not a behavioral pass; an unavailable plan rung is not a pass).
7. If a candidate changes, invalidate affected evidence and rerun its proving checks.

## Completion criterion

Every completion claim maps to fresh successful evidence for the exact candidate, outputs and exit codes are recorded, unknowns are closed or deferred, and remaining risks and non-claims are explicit.

## Stop conditions

Stop the completion claim when a proving command fails, required coverage skips, candidate identity changes, output is unavailable, evidence exceeds its stated boundary, or an unresolved unknown is material.

## Next recommended skill

Recommend `code-review` after the verification record is fresh and complete.
