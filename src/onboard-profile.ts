/**
 * Profile shaping for onboarding (WI-3, T1): argv parsing and profile
 * construction in one function, so the confidentiality clearance a human
 * asserts at onboarding is recorded exactly once, in the profile. The flag is
 * valueless like `--triage` — presence means cleared, absence means the field
 * is omitted entirely (never `false`, never inferred from anything else).
 */

import type { ProjectProfile } from "./loop.js";

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
