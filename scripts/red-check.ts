/**
 * Verification helper: prove each PR's reproduction test genuinely fails on
 * unfixed `main` (RED truthfulness). Runs the staged repro tests from
 * /tmp/loop-red-check (main's source + the three PRs' test files) inside the
 * sandcastle-loop container.
 */
import { execFileSync } from "node:child_process";

const args = [
  "run", "--rm", "-v", "/tmp/loop-red-check:/workspace", "-w", "/workspace",
  "--entrypoint", "sh", "sandcastle-loop",
  "-c", "pip install -q -e . && python -m pytest -q tests/fixed-issues/",
];
// A nonzero pytest exit (failing tests — the expected RED result) throws.
try {
  console.log(execFileSync("docker", args, { encoding: "utf8", timeout: 300_000 }));
} catch (err) {
  const e = err as { stdout?: string; status?: number };
  console.log(e.stdout ?? "");
  console.log(`exit: ${e.status} (RED confirmed — repro tests fail on unfixed main)`);
}
