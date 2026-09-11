# CLAUDE.md

Guidance for Claude Code and other agents working in `test-harness`.

## What this repository is

A proof of concept for an **issue-driven test & fix loop**: a harness that takes a queue of
already-known issues (GitHub Issues, a spec document, or a plain list — each often with an
attached log or stack trace), writes a regression test that reproduces the reported failure,
fixes the code in an isolated sandbox, independently re-verifies the fix, and opens a PR for
human review. Built on Sandcastle (`@ai-hero/sandcastle`), local Docker only for the POC.

The plan of record is **`harness-prd-v2.md`**. Read it before proposing anything that
contradicts it; changes to it go through `grilling` first, not silent edits.

The target project being fixed can be in **any language** — the harness is TypeScript, the
target's language only shapes the sandbox Docker image. The harness never *discovers* issues; it
works through a queue of issues a human already reported.

### There is no code yet

Documentation-only so far: no scaffold, no build, no lint, no test command, no package manifest.
Nothing has been generated because that work has not been started. Do not invent commands for
what does not exist; when the scaffold lands, the real commands are recorded in
`docs/agents/workflow.md` (Repository commands).

## Hard constraints — each prevents a specific failure

These come from `harness-prd-v2.md` and are invariants every review enforces:

1. **Never auto-merge.** Every fix lands as a PR a human reviews. Full autonomy is explicitly out
   of scope — even a verified fix can be the wrong root cause.
2. **Never trust the agent's own completion signal.** Verification means re-running the
   reproduction test AND the full suite in a fresh sandbox. An agent's "done" is never evidence.
3. **Confidentiality gate.** No client repo, client issue list, or client log is pointed at this
   harness until Bitcot's policy on sending that client's data to a third-party AI API is
   explicitly confirmed. Logs often contain internal paths and data values — treat them as
   sensitive by default.
4. **The reproduction test stays in the suite.** A regression test written for a fixed issue is
   a permanent artifact (proposed home: `tests/fixed-issues/`), not scaffolding to delete.
5. **Budget cap.** A run processes at most the capped number of issues, triaged by priority. No
   silent API spend beyond the cap.
6. **Local Docker only.** No cloud sandbox spend before the POC is proven and a team lead signs
   off.

## Repository boundaries — read before any git command

| Path | What it is |
|---|---|
| `/Users/manju/Documents/test-harness` | **This repository.** Its own git root. |
| `/Users/manju/Documents/port-poc` | A separate, unrelated POC repo. Reference only — never run commands against it from here. |
| `/Users/manju` | The **home directory**, which is itself an unrelated git repository. |

**Never run repo-wide git commands from `/Users/manju`** — `git add -A`, `git commit -a`, or a
bare `git status` there operate on the home repository. Scope every git command to the folder
you mean.

## Skills — use the project-local copies

This repository ships its own Agentic Development Skills at **`.claude/skills/`**, committed to
git so every team member and every agent (Claude Code, or anything else pointed at this repo) has
the same set — do not rely on a personal `~/.claude/skills/` copy, which can drift or be missing
entirely for a teammate. Invoke one with `/<skill-name>` (e.g. `/grilling`), or let Claude
pick it up automatically where its `description` matches the task.

Most of these skills end with a **`## Next recommended skill`** line naming what to run next.
Follow it — that is how Claude autosuggests the next step, and how a team member new to the repo
can walk the same path without memorising it.

**The requirements chain starts at the PRD.** `harness-prd-v2.md` is the product-level
requirements of record (goals, users, success criteria, out-of-scope). There is no build plan
yet: until one exists, work items are carved from the PRD by section, and the PRD wins on any
disagreement about product purpose.

## The lifecycle

A work item moves through four stages. Pick your entry point — most work doesn't start at
stage 1.

**1. Definition** — before any code changes
`grilling` stress-tests an approach or a PRD change against evidence before it is accepted.
`domain-modeling` only when terminology or a boundary is genuinely unclear.

**2. Planning** — turn an approved work item into an executable plan
`to-spec` (measurable FRs traced to the PRD section) → `to-tickets` (dependency-aware tickets)
→ `writing-plans` → `ponytail` (strip accidental complexity before anyone builds it).

**3. Implementation**
`using-git-worktrees` (isolate the branch) → `implement`, which orchestrates each approved slice:
one leaf implementer works through `tdd`, which tests at the public seam of the surface being
changed — harness source (`src/`, vitest) or pipeline integration (actually running the flow
against a seeded buggy repo in Docker). Never a source-text assertion. The controller runs a
read-only specification review before a read-only code-quality review, rerunning both if the
candidate changed. `diagnosing-bugs` handles defects found along the way.

**4. Verification and delivery**
`verification-before-completion` → `code-review` → (blocking findings send you back to stage 3;
otherwise) → `finishing-a-development-branch`, which requires explicit authorization before any
delivery action and is a terminal step. Delivery is a PR; the harness itself never merges. Use
`handoff` whenever a task pauses mid-flight for another session or agent to pick up.

```
grilling* → domain-modeling*
  → to-spec → to-tickets → writing-plans → ponytail
  → using-git-worktrees → implement (tdd per slice, ± diagnosing-bugs)
  → verification-before-completion → code-review → finishing-a-development-branch | handoff
```

Plans, verification records, review notes and delivery summaries are written to
`docs/work/{WORK_ITEM}/`. That directory holds **evidence, never requirements**, and is created
when a work item actually starts, not before.

## Self-learning

When corrected, or on catching a mistake, add the lesson as a one-line rule under `## Lessons`
before continuing. Project-specific lessons belong here; lessons that apply everywhere belong in
`~/.claude/CLAUDE.md`.

## Lessons
