/**
 * Provider registry (FR-002): named agent configurations, resolved and
 * validated once at startup — never mid-run.
 *
 * Entries return a plain {@link AgentSpec}; the adapter (the only module that
 * touches Sandcastle) turns it into a live agent provider. Env values reach
 * the agent through its environment, never through prompt text (FR-003).
 */
import type { AgentEngine, AgentSpec } from "./sandcastle-adapter.js";

interface ProviderEntry {
  readonly engine: AgentEngine;
  /** Env vars that must be set for this provider, mapped to the agent's env. */
  readonly envKeys: readonly string[];
  /** Cheap by default — the strong-model rerun rule covers inexplicable failures. */
  readonly defaultModel: string;
  /** Builds the agent-process env from the harness's env (secrets pass through, never echoed). */
  readonly agentEnv: (env: Readonly<Record<string, string>>) => Record<string, string>;
}

const ENTRIES: Readonly<Record<string, ProviderEntry>> = {
  // Primary: Claude Code CLI pointed at an Anthropic-protocol proxy
  // (base URL + auth token are the two vars the CLI reads).
  "claude-via-proxy": {
    engine: "claude-code",
    envKeys: ["CLI_PROXY_API_URL", "CLI_PROXY_API_TOKEN"],
    defaultModel: "glm-5.2",
    agentEnv: (env) => ({
      ANTHROPIC_BASE_URL: env.CLI_PROXY_API_URL!,
      ANTHROPIC_AUTH_TOKEN: env.CLI_PROXY_API_TOKEN!,
    }),
  },
  // Sandcastle's native codex agent, direct API key.
  "codex-direct": {
    engine: "codex",
    envKeys: ["CODEX_API_KEY"],
    defaultModel: "gpt-5-mini",
    agentEnv: (env) => ({ OPENAI_API_KEY: env.CODEX_API_KEY! }),
  },
  // Alternate CLI provider.
  opencode: {
    engine: "opencode",
    envKeys: ["OPENCODE_API_KEY"],
    defaultModel: "qwen3-coder",
    agentEnv: (env) => ({ OPENCODE_API_KEY: env.OPENCODE_API_KEY! }),
  },
};

export function registryNames(): string[] {
  return Object.keys(ENTRIES);
}

/**
 * Resolve a provider by name. Throws at startup — not mid-run — when the name
 * is unknown (message lists the registry) or a required env var is missing
 * (message names the variable).
 */
export function resolveProvider(
  name: string,
  env: Readonly<Record<string, string>>,
): AgentSpec {
  const entry = ENTRIES[name];
  if (!entry) {
    throw new Error(
      `Unknown provider "${name}". Registered providers: ${registryNames().join(", ")}.`,
    );
  }
  const missing = entry.envKeys.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Provider "${name}" requires ${missing.join(", ")} to be set in the environment (see .env.example).`,
    );
  }
  return {
    engine: entry.engine,
    model: entry.defaultModel,
    env: entry.agentEnv(env),
  };
}
