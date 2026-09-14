/** Verification helper: what does the normalizer extract from the real issues? */
import { execFileSync } from "node:child_process";
import { normalizeGitHubIssue } from "../src/issues.js";

for (const n of [1, 2, 3]) {
  const raw = JSON.parse(
    execFileSync(
      "gh",
      ["issue", "view", String(n), "--repo", "manjula25/loop-fixtures-py", "--json", "number,title,body,url"],
      { encoding: "utf8" },
    ),
  );
  const norm = normalizeGitHubIssue(raw);
  const log = norm.attachedLog
    ? `PRESENT (${norm.attachedLog.split("\n").length} lines, starts ${JSON.stringify(norm.attachedLog.slice(0, 50))})`
    : "absent";
  console.log(`issue ${n} → attachedLog: ${log}`);
}
