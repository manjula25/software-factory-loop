/**
 * Onboarding pass (T9, FR-104): create a sandbox from a clean worktree of the
 * target repo, run install + full suite by execution, and write
 * `.loop-harness/profile.json` into the target repo. Facts enter the profile
 * only if execution produced them — a doc claim that fails to run never does.
 *
 * Usage: npx tsx scripts/onboard.ts <repoDir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createFixSandbox } from "../src/sandcastle-adapter.js";
import { parsePytestFailures } from "../src/verify.js";

const INSTALL_CMD = 'pip install -e ".[test]"';
const TEST_CMD = "pytest -q";

async function main(): Promise<void> {
  const repoDir = resolve(process.argv[2] ?? ".");
  const startedAt = Date.now();

  const sandbox = await createFixSandbox({
    cwd: repoDir,
    branch: "loop/onboard",
    baseBranch: "main",
    imageName: "sandcastle-loop",
  });
  try {
    const install = await sandbox.exec(INSTALL_CMD);
    if (install.exitCode !== 0) {
      throw new Error(`install failed (${install.exitCode}): ${install.stderr.slice(-500)}`);
    }

    const suite = await sandbox.exec(TEST_CMD);
    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    const baselineFailures = parsePytestFailures(suite.stdout);

    // The repo is born red: a clean suite run that exits 0 or shows no
    // failures means our assumptions are wrong — refuse to record a profile.
    if (suite.exitCode === 0 || baselineFailures.length === 0) {
      throw new Error(
        `expected a born-red suite, got exit ${suite.exitCode} with ${baselineFailures.length} failures`,
      );
    }

    const profile = {
      language: "python",
      installCmd: INSTALL_CMD,
      testCmd: TEST_CMD,
      singleTestCmd: "pytest -q {test}",
      baselineFailures,
      expectedDurationSec: durationSec,
    };
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
