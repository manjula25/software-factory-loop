import { describe, expect, it } from "vitest";
import { assertNoSecrets } from "./assert-no-secrets.js";

const envWithSecrets: Readonly<Record<string, string>> = {
  CLI_PROXY_API_URL: "http://localhost:8317",
  CODEX_API_KEY: "sk-codex-SENTINEL-123",
  OPENCODE_API_KEY: "opencode-SENTINEL-key",
};

describe("secrets leak guard (FR-003)", () => {
  it("throws naming the offending string when one contains a secret value", () => {
    expect(() =>
      assertNoSecrets(["PR body: fixed via key sk-codex-SENTINEL-123"], envWithSecrets),
    ).toThrowError(/sk-codex-SENTINEL-123/);
  });

  it("throws when the whole secret value appears inside longer text", () => {
    expect(() =>
      assertNoSecrets(["log line ... key=sk-codex-SENTINEL-123 ... end"], envWithSecrets),
    ).toThrow();
  });

  it("does not throw on a mere fragment of a secret value (known limitation)", () => {
    // fragment detection would flag almost any string; the guard is whole-value
    expect(() => assertNoSecrets(["log mentions SENTINEL-123 briefly"], envWithSecrets)).not.toThrow();
  });

  it("passes clean strings", () => {
    expect(() =>
      assertNoSecrets(["clean prompt", "RED then GREEN evidence", "tests/test_x.py::test_y"], envWithSecrets),
    ).not.toThrow();
  });

  it("treats every sufficiently long env value as sensitive — even a base URL", () => {
    // hard rule: environment values are never echoed, URL included
    expect(() =>
      assertNoSecrets(["connect to http://localhost:8317 please"], envWithSecrets),
    ).toThrow();
  });

  it("skips env vars whose values are too short to be secrets", () => {
    // e.g. a URL var is not a secret; tiny values would cause false positives
    expect(() =>
      assertNoSecrets(["some string"], { CLI_PROXY_API_URL: "http://x:1", DEBUG: "1" }),
    ).not.toThrow();
  });
});
