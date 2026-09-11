import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as adapter from "./sandcastle-adapter.js";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), ".");

/** Recursively collect .ts files under src/ (test files included — they must not import it either). */
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
  it("only src/sandcastle-adapter.ts imports @ai-hero/sandcastle", async () => {
    const files = await tsFiles(srcDir);
    expect(files.length).toBeGreaterThan(0);
    // Detect imports (static, type-only, dynamic, require) — a mere textual
    // mention in a comment or message must not trip the boundary.
    const importPattern = /(?:from\s+|require\(\s*|import\(\s*)["']@ai-hero\/sandcastle/;
    const offenders: string[] = [];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      if (importPattern.test(text)) {
        const relative = file.slice(srcDir.length + 1);
        if (relative !== "sandcastle-adapter.ts") offenders.push(relative);
      }
    }
    expect(offenders, `files importing @ai-hero/sandcastle outside the adapter: ${offenders.join(", ")}`).toEqual([]);
  });

  it("the adapter file itself exists and imports the pinned package", async () => {
    const adapterPath = join(srcDir, "sandcastle-adapter.ts");
    const text = await readFile(adapterPath, "utf8");
    expect(text).toContain("@ai-hero/sandcastle");
  });

  it("exposes the three seam exports: runFixRun, createFixSandbox, mergeBack", () => {
    expect(typeof adapter.runFixRun).toBe("function");
    expect(typeof adapter.createFixSandbox).toBe("function");
    expect(typeof adapter.mergeBack).toBe("function");
  });
});
