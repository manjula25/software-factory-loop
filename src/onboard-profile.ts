/**
 * Profile shaping for onboarding (WI-3, T1): argv parsing and profile
 * construction in one function, so the confidentiality clearance a human
 * asserts at onboarding is recorded exactly once, in the profile. The flag is
 * valueless like `--triage` — presence means cleared, absence means the field
 * is omitted entirely (never `false`, never inferred from anything else).
 */

import type { ProjectProfile } from "./loop.js";
import { parsePytestFailures } from "./verify.js";

/**
 * Thrown when suite output carries no evidence a test suite executed at all.
 * Replaces the old born-red guard: the thing worth detecting was never
 * "suite is green" but "the sandbox lied or the test command is wrong".
 */
export class SuiteDidNotRunError extends Error {
  constructor(exitCode: number) {
    super(`no pytest summary line in suite output (exit ${exitCode}) — did the test command run anything?`);
    this.name = "SuiteDidNotRunError";
  }
}

// A pytest summary token anywhere in stdout (`3 passed in 0.01s`,
// `1 failed, 2 passed`, `2 errors`, …) is the evidence of execution. Counted
// outcomes only — pytest's "no tests ran" has no count and must not pass.
const SUMMARY_TOKEN = /\b\d+ (?:passed|failed|error|errors|skipped|xfailed|xpassed)\b/;

/**
 * Derive the onboarding baseline from a suite run. A green suite is valid and
 * onboards with `[]`; output with no summary token means the suite never
 * executed and throws `SuiteDidNotRunError`.
 */
export function parseSuiteBaseline(exitCode: number, stdout: string): string[] {
  if (!SUMMARY_TOKEN.test(stdout)) throw new SuiteDidNotRunError(exitCode);
  return parsePytestFailures(stdout);
}

function optValue(argv: readonly string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

/**
 * Absorbs the flag parsing and profile construction from scripts/onboard.ts.
 * `runFacts` carries only what sandbox execution produced — nothing a doc
 * claimed makes it into the profile.
 */
export function onboardProfile(
  argv: readonly string[],
  runFacts: { baselineFailures: readonly string[]; durationSec: number },
): ProjectProfile {
  const installCmd = optValue(argv, "--install") ?? 'pip install -e ".[test]"';
  const testCmd = optValue(argv, "--test") ?? "pytest -q";
  const singleTestCmd = optValue(argv, "--single-test") ?? "pytest -q {test}";
  const cleared = argv.includes("--confidentiality-cleared");
  return {
    language: "python",
    installCmd,
    testCmd,
    singleTestCmd,
    baselineFailures: runFacts.baselineFailures,
    expectedDurationSec: runFacts.durationSec,
    ...(cleared ? { confidentialityCleared: true } : {}),
  };
}
