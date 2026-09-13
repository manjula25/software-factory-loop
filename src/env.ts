/**
 * Loads the untracked `.env` at the repo root and merges it over the process
 * environment (file wins). Provider vars are validated by `resolveProvider`
 * at startup — this module only reads.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadEnv(
  repoRoot: string,
  source: Readonly<Record<string, string | undefined>> = process.env,
): Record<string, string> {
  const parsed = readEnvFile(repoRoot);
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) merged[key] = value;
  }
  return { ...merged, ...parsed };
}

/**
 * Only the values configured in the repo's `.env` — the correct scope for the
 * secrets guard. The full process env carries npm- and shell-injected vars (e.g.
 * npm_package_name, which collides with our own commit identity in prompts)
 * that is not secret and must not feed the guard.
 */
export function readEnvFile(repoRoot: string): Record<string, string> {
  const envPath = join(repoRoot, ".env");
  return existsSync(envPath) ? parseDotEnv(readFileSync(envPath, "utf8")) : {};
}

/** Minimal KEY=VALUE parser: skips blanks and # comments, trims around '='. */
export function parseDotEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}
