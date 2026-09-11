import { describe, expect, it } from "vitest";
import { resolveProvider, registryNames } from "./providers.js";

const fullEnv: Readonly<Record<string, string>> = {
  CLI_PROXY_API_URL: "http://localhost:8317",
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
    // the proxy URL reaches the agent env under the name Claude Code reads
    expect(claude.env?.ANTHROPIC_BASE_URL).toBe("http://localhost:8317");
    expect(codex.env?.OPENAI_API_KEY).toBe("codex-key-dummy");
  });

  it("throws on an unknown provider name, listing the registry entries", () => {
    expect(() => resolveProvider("gpt-mega", fullEnv)).toThrowError(/gpt-mega/);
    for (const name of registryNames()) {
      expect(() => resolveProvider(name, fullEnv)).not.toThrow();
    }
  });

  it("throws at startup when the selected provider's env var is missing, naming it", () => {
    expect(() => resolveProvider("claude-via-proxy", {})).toThrowError(/CLI_PROXY_API_URL/);
    expect(() => resolveProvider("codex-direct", {})).toThrowError(/CODEX_API_KEY/);
    expect(() => resolveProvider("opencode", {})).toThrowError(/OPENCODE_API_KEY/);
    // an unrelated missing var must not block a provider whose vars are present
    expect(() =>
      resolveProvider("opencode", { OPENCODE_API_KEY: "opencode-key-dummy" }),
    ).not.toThrow();
  });
});
