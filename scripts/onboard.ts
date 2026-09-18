/**
 * Onboarding pass (T9, FR-104): create a sandbox from a clean worktree of the
 * target repo, run install + full suite by execution, and write
 * `.loop-harness/profile.json` into the target repo. Facts enter the profile
 * only if execution produced them — a doc claim that fails to run never does.
 *
 * Usage: npx tsx scripts/onboard.ts <repoDir> [--install <cmd>] [--test <cmd>]
 *                                                 [--single-test <cmd>]
 *                                                 [--confidentiality-cleared] [--auto-merge]
 *
 * The install/test commands default to the pip-editable convention; override
 * them for repos that install differently (filtered requirements files,
 * non-packaged source trees, …). Whatever is recorded here is what the loop
 * re-runs in every sandbox.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { onboardProfile, parseSuiteBaseline } from "../src/onboard-profile.js";
import { createFixSandbox } from "../src/sandcastle-adapter.js";

async function main(): Promise<void> {
  const repoDir = resolve(process.argv[2] ?? ".");
  const startedAt = Date.now();

  // Sandcastle reuses an existing branch instead of re-forking, so a persisted
  // loop/onboard made re-onboarding test stale code (observed live 2026-09-18).
  // Only absence is tolerable here: a branch that survives deletion means a
  // stale fork, so that failure must throw — never silently proceed.
  let branchExists = true;
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", "refs/heads/loop/onboard"], {
      cwd: repoDir,
      stdio: "ignore",
    });
  } catch {
    branchExists = false;
  }
  if (branchExists) {
    execFileSync("git", ["branch", "-D", "loop/onboard"], { cwd: repoDir, stdio: "pipe" });
  }

  const sandbox = await createFixSandbox({
    cwd: repoDir,
    branch: "loop/onboard",
    baseBranch: "main",
    imageName: "sandcastle-loop",
  });
  try {
    // Commands and profile come from the same argv, so what is recorded here
    // is exactly what was executed.
    const argv = process.argv.slice(2);
    const pending = onboardProfile(argv, { baselineFailures: [], durationSec: 0 });
    const install = await sandbox.exec(pending.installCmd);
    if (install.exitCode !== 0) {
      throw new Error(`install failed (${install.exitCode}): ${install.stderr.slice(-500)}`);
    }

    const suite = await sandbox.exec(pending.testCmd);
    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    // Throws SuiteDidNotRunError when there is no evidence the suite executed;
    // a green suite is valid and onboards with an empty baseline.
    const baselineFailures = parseSuiteBaseline(suite.exitCode, suite.stdout);

    const profile = onboardProfile(argv, { baselineFailures, durationSec });
    const profileDir = resolve(repoDir, ".loop-harness");
    mkdirSync(profileDir, { recursive: true });
    const profilePath = resolve(profileDir, "profile.json");
    writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`);

    console.log(`suite exit: ${suite.exitCode}`);
    console.log(`baseline failures (${baselineFailures.length}):`);
    for (const f of baselineFailures) console.log(`  - ${f}`);
    console.log(`expected duration: ~${durationSec}s`);
    console.log(`profile written: ${profilePath}`);
  } finally {
    await sandbox.close();
  }
}

await main();
