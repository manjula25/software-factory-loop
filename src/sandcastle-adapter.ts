/**
 * The ONLY module that imports `@ai-hero/sandcastle` (FR-001).
 *
 * Everything the rest of the harness knows about Sandcastle goes through the
 * exports below (`runFixRun`, `createFixSandbox`, `mergeBack`, and the
 * bounded one-shot passes `runPlan`, `runReview`, `runMerger`), all thin
 * typed wrappers over the pinned 0.12.0 API. If a future Sandcastle release
 * breaks us, the fix lands here — or, per the fork-on-demand triggers in
 * harness-prd-v2.md, we fork the package.
 */
import {
  claudeCode,
  codex,
  createSandbox,
  opencode,
  run,
  type AgentProvider,
  type MergeToHeadBranchStrategy,
  type NamedBranchStrategy,
} from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

/** Agent engines the loop supports (mirrors the provider registry in T3). */
export type AgentEngine = "claude-code" | "codex" | "opencode";

/** Plain-object description of an agent — the registry resolves to one of these. */
export interface AgentSpec {
  readonly engine: AgentEngine;
  readonly model: string;
  /** Extra env injected into the agent process (secrets reach it here, never via prompt). */
  readonly env?: Readonly<Record<string, string>>;
}

function agentProvider(spec: AgentSpec): AgentProvider {
  switch (spec.engine) {
    case "claude-code":
      return claudeCode(spec.model, { env: { ...spec.env } });
    case "codex":
      return codex(spec.model, { env: { ...spec.env } });
    case "opencode":
      return opencode(spec.model, { env: { ...spec.env } });
  }
}

function sandboxProvider(imageName: string, env?: Readonly<Record<string, string>>) {
  return docker({ imageName, env: { ...env } });
}

/** The minimum of Sandcastle's `Sandbox` handle the loop needs, as our own type. */
export interface FixSandboxHandle {
  /** The branch the worktree is on. */
  readonly branch: string;
  /** Host path to the worktree backing the sandbox. */
  readonly worktreePath: string;
  /** Execute a command in the sandbox. Non-zero exit is returned, not thrown. */
  exec(
    command: string,
    options?: { readonly cwd?: string; readonly stdin?: string },
  ): Promise<{ readonly stdout: string; readonly stderr: string; readonly exitCode: number }>;
  /** Tear down the sandbox; returns a preserved-worktree path when dirty. */
  close(): Promise<{ readonly preservedWorktreePath?: string }>;
}

/** What the loop does with the result of a fix run. */
export interface FixRunOutcome {
  /** Combined agent stdout — source of RED/GREEN evidence excerpts. */
  readonly stdout: string;
  /** Commits the agent made, by SHA. Empty means nothing to PR. */
  readonly commits: readonly { readonly sha: string }[];
  /** Branch the agent's commits landed on. */
  readonly branch: string;
  /** Path to the run log, when Sandcastle drained one to a file. */
  readonly logFilePath?: string;
}

export interface FixRunInput {
  /** Host repo directory the run anchors to (`.sandcastle/` lives under it). */
  readonly cwd: string;
  /** Inline prompt for the fix agent. */
  readonly prompt: string;
  /** Sandbox image (built by scripts/smoke-image.sh, T7). */
  readonly imageName: string;
  /** Which agent to run. */
  readonly agent: AgentSpec;
  /** Env injected into the sandbox (API keys etc. — never echoed anywhere). */
  readonly env?: Readonly<Record<string, string>>;
  /** Branch the agent's commits must land on, e.g. `loop/issue-1`. */
  readonly branch: string;
  /** Ref to branch from when `branch` does not exist yet. */
  readonly baseBranch?: string;
  /** Optional name for the run, used as a log prefix. */
  readonly name?: string;
  /** Repo-relative paths copied into the worktree before the run (attachments). */
  readonly copyToWorktree?: readonly string[];
}

/** Run one AFK fix iteration in a Docker sandbox, commits landing on `branch`. */
export async function runFixRun(input: FixRunInput): Promise<FixRunOutcome> {
  const result = await run({
    cwd: input.cwd,
    prompt: input.prompt,
    name: input.name,
    agent: agentProvider(input.agent),
    sandbox: sandboxProvider(input.imageName, input.env),
    branchStrategy: {
      type: "branch",
      branch: input.branch,
      ...(input.baseBranch ? { baseBranch: input.baseBranch } : {}),
    } satisfies NamedBranchStrategy,
    ...(input.copyToWorktree ? { copyToWorktree: [...input.copyToWorktree] } : {}),
  });
  return {
    stdout: result.stdout,
    commits: result.commits,
    branch: result.branch,
    logFilePath: result.logFilePath,
  };
}

export interface FixSandboxInput {
  /** Host repo directory the sandbox anchors to. */
  readonly cwd: string;
  /** Explicit branch for the worktree (e.g. the fix branch, for verification). */
  readonly branch: string;
  /** Ref to fork from when `branch` does not yet exist. */
  readonly baseBranch?: string;
  /** Sandbox image. */
  readonly imageName: string;
  /** Env injected into the sandbox. */
  readonly env?: Readonly<Record<string, string>>;
}

/**
 * Create a long-lived sandbox on an explicit branch — used for the independent
 * re-verification pass (never trusts the agent's own completion signal).
 */
export async function createFixSandbox(input: FixSandboxInput): Promise<FixSandboxHandle> {
  return createSandbox({
    cwd: input.cwd,
    branch: input.branch,
    ...(input.baseBranch ? { baseBranch: input.baseBranch } : {}),
    sandbox: sandboxProvider(input.imageName, input.env),
  });
}

/**
 * Branch strategy that merges the agent's temp branch back into the host HEAD
 * branch. Exposed so call sites never write Sandcastle strategy literals.
 */
export function mergeBack(): MergeToHeadBranchStrategy {
  return { type: "merge-to-head" };
}

export interface PlanRunInput {
  /** Host repo directory the run anchors to. */
  readonly cwd: string;
  /** Planning prompt (already secrets-guarded by the caller). */
  readonly prompt: string;
  readonly imageName: string;
  readonly agent: AgentSpec;
  /** Env injected into the sandbox (never echoed anywhere). */
  readonly env?: Readonly<Record<string, string>>;
}

/** Throwaway branch the planning pass runs on — never a `fix/*` branch. */
export const PLAN_BRANCH = "loop/plan";

/** WI-6 T6 (D7): throwaway branch the pre-merge review pass runs on. */
export const REVIEW_BRANCH = "loop/review";

/**
 * The shape of a bounded one-shot pass's cost controls (see
 * `boundedRunOptions`): named, so the budget bound is declared (and asserted)
 * once instead of as an inline literal at every factory.
 */
export interface BoundedRunOptions {
  readonly name: string;
  readonly maxIterations: number;
  readonly branchStrategy: NamedBranchStrategy;
}

/**
 * The shared cost-control factory for every bounded one-shot pass (WI-6 R2):
 * a `maxIterations` of 1 (the defaulted param; the merger passes
 * `MERGER_MAX_ITERATIONS`) is what makes an auxiliary pass cheap enough to be
 * worth running at all (constraint 5) — a pass that could iterate would be an
 * unbounded second agent. The planning pass, the pre-merge review pass, and
 * the merger pass all build their options here, so the budget bound lives
 * (and is asserted) once.
 */
export function boundedRunOptions(
  name: string,
  branch: string,
  maxIterations = 1,
): BoundedRunOptions {
  return {
    name,
    maxIterations,
    branchStrategy: { type: "branch", branch },
  };
}

/**
 * The planning pass's cost controls, as a value rather than an inline literal,
 * so they are assertable without spending a model call (see `boundedRunOptions`).
 */
export function planRunOptions(): BoundedRunOptions {
  return boundedRunOptions("plan", PLAN_BRANCH);
}

/**
 * One bounded planning pass over the queue (WI-13 T3, FR-001): stdout is
 * returned for `<plan>` extraction. The caller deletes the branch afterwards.
 */
export async function runPlan(input: PlanRunInput): Promise<string> {
  const result = await run({
    cwd: input.cwd,
    prompt: input.prompt,
    agent: agentProvider(input.agent),
    sandbox: sandboxProvider(input.imageName, input.env),
    ...boundedRunOptions("plan", PLAN_BRANCH),
  });
  return result.stdout;
}

/**
 * One bounded pre-merge review pass (WI-6 T6, FR-009, D7), cloned from
 * `runPlan`: a single `run({...})` on the throwaway `loop/review` branch,
 * stdout returned for `<review>` extraction. The prompt is prebuilt by the
 * caller (`buildReviewPrompt`: issue description + the diff, three-verdict
 * contract) and secrets-guarded before the call; the caller deletes the branch
 * afterwards. `diff` rides the seam per D7 so the review input is complete at
 * the adapter boundary.
 */
export async function runReview(input: PlanRunInput & { readonly diff: string }): Promise<string> {
  const result = await run({
    cwd: input.cwd,
    prompt: input.prompt,
    agent: agentProvider(input.agent),
    sandbox: sandboxProvider(input.imageName, input.env),
    ...boundedRunOptions("review", REVIEW_BRANCH),
  });
  return result.stdout;
}

/**
 * The merger pass's iteration bound (WI-13, FR-007): one bounded pass, same
 * philosophy as every other bounded run — a merger that could iterate would be
 * an unbounded second agent (constraint 5).
 */
export const MERGER_MAX_ITERATIONS = 1;

/**
 * The merger pass's cost controls, on the caller's fix branch — unlike
 * `planRunOptions`/`runReview`, the merger works on an existing branch rather
 * than a throwaway one.
 */
export function mergerRunOptions(branch: string): BoundedRunOptions {
  return boundedRunOptions("merger", branch, MERGER_MAX_ITERATIONS);
}

/**
 * One bounded merger pass (WI-13 T7, FR-007): merges `mainRef` into `branch`
 * and resolves conflicts; never trusted (constraint 2) — the caller
 * re-verifies the merged result in a fresh sandbox before any merge is counted
 * (FR-007/FR-008). The prompt is prebuilt by the caller (T8); `mainRef` rides
 * the seam per the `runReview` idiom so the merger input is complete at the
 * adapter boundary.
 */
export async function runMerger(
  input: PlanRunInput & { readonly branch: string; readonly mainRef: string },
): Promise<{ stdout: string; commits: readonly { readonly sha: string }[] }> {
  const result = await run({
    cwd: input.cwd,
    prompt: input.prompt,
    agent: agentProvider(input.agent),
    sandbox: sandboxProvider(input.imageName, input.env),
    ...mergerRunOptions(input.branch),
  });
  return { stdout: result.stdout, commits: result.commits };
}
