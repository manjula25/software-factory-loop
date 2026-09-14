/**
 * Component check (docker only, no agent spend): the baseline preflight path
 * against the real fixtures repo — create the throwaway branch off main, run
 * install + full suite, compare with the recorded profile baseline, clean up.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createFixSandbox } from "../src/sandcastle-adapter.js";
import { parsePytestFailures } from "../src/verify.js";
import type { ProjectProfile } from "../src/loop.js";

const repoDir = "/Users/manju/Documents/loop-fixtures-py";
const profile = JSON.parse(readFileSync(join(repoDir, ".loop-harness", "profile.json"), "utf8")) as ProjectProfile;

const sandbox = await createFixSandbox({
  cwd: repoDir,
  branch: "loop/preflight-gh-1",
  baseBranch: "main",
  imageName: "sandcastle-loop",
});
try {
  const install = await sandbox.exec(profile.installCmd);
  if (install.exitCode !== 0) throw new Error(`install failed: ${install.stderr}`);
  const suite = await sandbox.exec(profile.testCmd);
  const actual = parsePytestFailures(suite.stdout);
  const recorded = profile.baselineFailures;
  const same =
    actual.length === recorded.length && actual.every((f, i) => f === recorded[i]);
  console.log("recorded baseline:", recorded);
  console.log("fresh run found:  ", actual);
  console.log(same ? "MATCH — preflight passes" : "MISMATCH — profile would be flagged stale");
  console.log(`summary line present: ${/\d+ (passed|failed|error)/.test(suite.stdout)}`);
} finally {
  await sandbox.close();
}
try {
  execFileSync("git", ["branch", "-D", "loop/preflight-gh-1"], { cwd: repoDir, stdio: "pipe" });
  console.log("preflight branch deleted");
} catch {
  console.log("preflight branch already absent");
}
