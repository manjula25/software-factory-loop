import { describe, expect, it } from "vitest";
import { resolveProvider, registryNames } from "./providers.js";

const fullEnv: Readonly<Record<string, string>> = {
  CLI_PROXY_API_URL: "http://localhost:8317",
  CLI_PROXY_API_TOKEN: "proxy-token-dummy",
  CODEX_API_KEY: "codex-key-dummy",
  OPENCODE_API_KEY: "opencode-key-dummy",
};

describe("provider registry (FR-002)", () => {
  it("resolves two registry entries to distinct agents", () => {
    const claude = resolveProvider("claude-via-proxy", fullEnv);
    const codex = resolveProvider("codex-direct", fullEnv);
    expect(claude).not.toEqual(codex);
    expect(claude.engine).toBe("claude-code");
    expect(codex.engine).toBe("codex");
    // the proxy URL + token reach the agent env under the names Claude Code reads
    expect(claude.env?.ANTHROPIC_BASE_URL).toBe("http://localhost:8317");
    expect(claude.env?.ANTHROPIC_AUTH_TOKEN).toBe("proxy-token-dummy");
    expect(claude.model).toBe("glm-5.2");
    // proxy models are absent from Claude Code's catalog: name the context window
    // explicitly and skip background calls the proxy has no small model for
    expect(claude.env?.CLAUDE_CODE_MAX_CONTEXT_TOKENS).toBe("200000");
    expect(claude.env?.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe("1");
    expect(codex.env?.OPENAI_API_KEY).toBe("codex-key-dummy");
  });

  it("accepts a model override (CLI --model) instead of the registry default", () => {
    const claude = resolveProvider("claude-via-proxy", fullEnv, "glm-5.3");
    expect(claude.model).toBe("glm-5.3");
    // whitespace-only override falls back to the default, not an empty model
    expect(resolveProvider("claude-via-proxy", fullEnv, "  ").model).toBe("glm-5.2");
  });

  it("honors an explicit context-window override from the environment", () => {
    const claude = resolveProvider("claude-via-proxy", { ...fullEnv, CLI_PROXY_MAX_CONTEXT_TOKENS: "1000000" });
    expect(claude.env?.CLAUDE_CODE_MAX_CONTEXT_TOKENS).toBe("1000000");
  });

  it("throws on an unknown provider name, listing the registry entries", () => {
    expect(() => resolveProvider("gpt-mega", fullEnv)).toThrowError(/gpt-mega/);
    for (const name of registryNames()) {
      expect(() => resolveProvider(name, fullEnv)).not.toThrow();
    }
  });

  it("throws at startup when the selected provider's env var is missing, naming it", () => {
    expect(() => resolveProvider("claude-via-proxy", {})).toThrowError(/CLI_PROXY_API_URL|CLI_PROXY_API_TOKEN/);
    expect(() =>
      resolveProvider("claude-via-proxy", { CLI_PROXY_API_URL: "http://localhost:8317" }),
    ).toThrowError(/CLI_PROXY_API_TOKEN/);
    expect(() => resolveProvider("codex-direct", {})).toThrowError(/CODEX_API_KEY/);
    expect(() => resolveProvider("opencode", {})).toThrowError(/OPENCODE_API_KEY/);
    // an unrelated missing var must not block a provider whose vars are present
    expect(() =>
      resolveProvider("opencode", { OPENCODE_API_KEY: "opencode-key-dummy" }),
    ).not.toThrow();
  });
});
