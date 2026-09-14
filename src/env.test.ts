import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadEnv, parseDotEnv } from "./env.js";

describe("env loader (FR-003)", () => {
  it("parses KEY=VALUE lines, skipping comments and blanks", () => {
    expect(
      parseDotEnv("# comment\n\nCLI_PROXY_API_URL=http://localhost:8317\nCODEX_API_KEY=\"quoted\"\n"),
    ).toEqual({ CLI_PROXY_API_URL: "http://localhost:8317", CODEX_API_KEY: "quoted" });
  });

  it("merges .env over the source env; missing file leaves it untouched", () => {
    const dir = mkdtempSync(join(tmpdir(), "loop-env-"));
    writeFileSync(join(dir, ".env"), "CODEX_API_KEY=file-value\n");
    const merged = loadEnv(dir, { CODEX_API_KEY: "process-value", OTHER: "x" });
    expect(merged.CODEX_API_KEY).toBe("file-value"); // file wins
    expect(merged.OTHER).toBe("x");
    const untouched = loadEnv(join(dir, "no-such-subdir"), { CODEX_API_KEY: "process-value" });
    expect(untouched.CODEX_API_KEY).toBe("process-value");
  });
});
