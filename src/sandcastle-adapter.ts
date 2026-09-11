/**
 * The ONLY module that imports `@ai-hero/sandcastle` (FR-001).
 *
 * Everything the rest of the harness knows about Sandcastle goes through the
 * three exports below (`runFixRun`, `createFixSandbox`, `mergeBack`), all thin
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
