import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as adapter from "./sandcastle-adapter.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The only files permitted to import @ai-hero/sandcastle. Anything else fails. */
const ALLOWED_IMPORTERS = new Set(["src/sandcastle-adapter.ts", ".sandcastle/main.ts"]);

/**
 * Directories never scanned. `node_modules` and `.git` are not our code; `.claude`
 * holds sibling worktrees, each a full copy of this repo whose own adapter would
 * report as an offender; the rest is tooling output.
 */
const SKIP_DIRS = new Set(["node_modules", ".git", ".claude", ".loop-work", "dist", "coverage"]);

/**
 * Every extension a hand-written source file plausibly carries. Narrowing this to
 * `.ts` would leave the rule enforceable only against files that happen to use it.
 */
const SOURCE_EXTENSIONS = [".ts", ".mts", ".cts", ".tsx"];

/**
 * Recursively collect source files under `dir`, skipping SKIP_DIRS. The scan root
 * is the whole repository, not `src/`: the rule this test enforces is about every
 * file, so a scanner pointed at two directories enforces something weaker than the
 * rule it is recorded as enforcing (finding A-3, 2026-09-25).
 */
async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        return SKIP_DIRS.has(entry.name) ? [] : sourceFiles(full);
      }
      return SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) ? [full] : [];
    }),
  );
  return files.flat();
}

describe("sandcastle adapter boundary (FR-001)", () => {
  it("only the adapter (plus the explicitly allowed init template) imports @ai-hero/sandcastle", async () => {
    // The scan root is the whole repository, so a NEW file importing the package
    // anywhere fails — not only one placed under src/. `.sandcastle/` holds the
    // committed init scaffold, whose blank template (main.ts) imports the package;
    // that exemption is explicit in ALLOWED_IMPORTERS above.
    const files = await sourceFiles(repoRoot);
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

  it("exposes the four seam exports: runFixRun, createFixSandbox, mergeBack, runPlan", () => {
    expect(typeof adapter.runFixRun).toBe("function");
    expect(typeof adapter.createFixSandbox).toBe("function");
    expect(typeof adapter.mergeBack).toBe("function");
    expect(typeof adapter.runPlan).toBe("function");
  });

  it("keeps the planning pass bounded to one iteration, on a branch that is never a fix branch", () => {
    const options = adapter.planRunOptions();

    // constraint 5: a planning run that could iterate is an unbounded second agent
    expect(options.maxIterations).toBe(1);
    expect(options.branchStrategy).toEqual({ type: "branch", branch: adapter.PLAN_BRANCH });
    expect(adapter.PLAN_BRANCH.startsWith("fix/")).toBe(false);
  });

  it("keeps the merger bounded to one iteration, on the caller's fix branch (FR-007)", () => {
    // constraint 5: a merger that could iterate is an unbounded second agent
    expect(adapter.MERGER_MAX_ITERATIONS).toBe(1);

    const options = adapter.mergerRunOptions("fix/gh-1");
    expect(options.maxIterations).toBe(1);
    // the merger reuses the caller's existing fix branch, unlike the throwaway
    // loop/plan and loop/review branches
    expect(options.branchStrategy).toEqual({ type: "branch", branch: "fix/gh-1" });

    expect(typeof adapter.runMerger).toBe("function");
    expect(adapter.runMerger.constructor.name).toBe("AsyncFunction");
  });
});
