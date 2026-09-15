import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as adapter from "./sandcastle-adapter.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The only files permitted to import @ai-hero/sandcastle. Anything else fails. */
const ALLOWED_IMPORTERS = new Set(["src/sandcastle-adapter.ts", ".sandcastle/main.ts"]);

/** Recursively collect .ts files under the given roots (test files included). */
async function tsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? tsFiles(full) : entry.name.endsWith(".ts") ? [full] : [];
    }),
  );
  return files.flat();
}

describe("sandcastle adapter boundary (FR-001)", () => {
  it("only the adapter (plus the explicitly allowed init template) imports @ai-hero/sandcastle", async () => {
    // src/ is where harness code lives; .sandcastle/ holds the committed init
    // scaffold, whose blank template (main.ts) imports the package. The
    // exemption is explicit here so a NEW file importing it anywhere fails.
    const files = [
      ...(await tsFiles(join(repoRoot, "src"))),
      ...(await tsFiles(join(repoRoot, ".sandcastle"))),
    ];
    expect(files.length).toBeGreaterThan(0);
    // Detect imports (static, type-only, dynamic, require) — a mere textual
    // mention in a comment or message must not trip the boundary.
    const importPattern = /(?:from\s+|require\(\s*|import\(\s*)["']@ai-hero\/sandcastle/;
    const offenders: string[] = [];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      if (importPattern.test(text)) {
        const relative = file.slice(repoRoot.length + 1);
        if (!ALLOWED_IMPORTERS.has(relative)) offenders.push(relative);
      }
    }
    expect(
      offenders,
      `files importing @ai-hero/sandcastle outside the adapter: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("the adapter file itself exists and imports the pinned package", async () => {
    const adapterPath = join(repoRoot, "src", "sandcastle-adapter.ts");
    const text = await readFile(adapterPath, "utf8");
    expect(text).toContain("@ai-hero/sandcastle");
  });

  it("exposes the four seam exports: runFixRun, createFixSandbox, mergeBack, runTriage", () => {
    expect(typeof adapter.runFixRun).toBe("function");
    expect(typeof adapter.createFixSandbox).toBe("function");
    expect(typeof adapter.mergeBack).toBe("function");
    expect(typeof adapter.runTriage).toBe("function");
  });

  it("keeps the triage pass bounded to one iteration, on a branch that is never a fix branch", () => {
    const options = adapter.triageRunOptions();

    // constraint 5: a scoring run that could iterate is an unbounded second agent
    expect(options.maxIterations).toBe(1);
    expect(options.branchStrategy).toEqual({ type: "branch", branch: adapter.TRIAGE_BRANCH });
    expect(adapter.TRIAGE_BRANCH.startsWith("fix/")).toBe(false);
  });
});
