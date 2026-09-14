/**
 * Baseline-diff verification (FR-104, Grilling decision 6): a fix is verified
 * when the reproduction test passes AND the full suite shows no failures the
 * onboarding baseline didn't already have. The seeded repo is born red, so
 * "suite is green" can never be the gate.
 */

/** Parse `pytest -q` output into failing test node ids. */
export function parsePytestFailures(output: string): string[] {
  const failures: string[] = [];
  for (const line of output.split(/\r?\n/)) {
    const match = /^(?:FAILED|ERROR) (\S+?)(?: - .*)?$/.exec(line);
    if (match) failures.push(match[1]);
  }
  return failures;
}

export interface VerificationInput {
  /** Pre-existing failures recorded during onboarding — never cached across issues. */
  readonly baselineFailures: readonly string[];
  /** Failures from the post-fix full-suite run in the fresh sandbox. */
  readonly postFixFailures: readonly string[];
  /** Whether the reproduction test passed in that same run. */
  readonly reproTestPassed: boolean;
}

export interface VerificationResult {
  /** True only when repro passes and no failures are new versus baseline. */
  readonly passed: boolean;
  /** Failures present post-fix but absent from the baseline. */
  readonly newFailures: readonly string[];
}

export function diffVerification(input: VerificationInput): VerificationResult {
  const baseline = new Set(input.baselineFailures);
  const newFailures = input.postFixFailures.filter((id) => !baseline.has(id));
  return {
    passed: input.reproTestPassed && newFailures.length === 0,
    newFailures,
  };
}
