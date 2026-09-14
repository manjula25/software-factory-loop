/**
 * One-off diagnostic (T11 debugging): run the container's Claude CLI against
 * the configured proxy with a trivial prompt. Prints stdout/stderr and exit
 * code; env values are passed through, never echoed.
 *
 * Usage: npx tsx scripts/probe-agent.ts [model] [--env-model]
 *   model        → defaults to glm-5.3
 *   --env-model  → set ANTHROPIC_MODEL env instead of the --model flag
 */
import { execFileSync } from "node:child_process";
import { readEnvFile } from "../src/env.js";

const envFile = readEnvFile(process.cwd());
const dockerEnv: Record<string, string> = {};
const base = envFile.CLI_PROXY_API_URL;
const token = envFile.CLI_PROXY_API_TOKEN;
if (!base || !token) throw new Error(".env must define CLI_PROXY_API_URL and CLI_PROXY_API_TOKEN");

const useEnvModel = process.argv.includes("--env-model");
const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const model = positional[0] ?? "glm-5.3";
if (useEnvModel) dockerEnv.ANTHROPIC_MODEL = model;
// Explicit window: the CLI's model catalog doesn't know proxy models, so it
// warns and assumes 200k; naming the window tells it what to compact against.
// Non-essential background calls (session-title generation) are off — the
// proxy has no small model for them and their failure is the noisy
// unrecognized_model line.
dockerEnv.CLAUDE_CODE_MAX_CONTEXT_TOKENS = envFile.CLI_PROXY_MAX_CONTEXT_TOKENS ?? "200000";
dockerEnv.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
dockerEnv.ANTHROPIC_BASE_URL = base;
dockerEnv.ANTHROPIC_AUTH_TOKEN = token;

const args = [
  "run", "--rm",
  ...Object.entries(dockerEnv).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
  "--entrypoint", "claude", "sandcastle-loop",
  "-p",
  ...(useEnvModel ? [] : ["--model", model]),
  "reply with exactly: OK",
];
console.log(`probing model: ${model} (${useEnvModel ? "ANTHROPIC_MODEL env" : "--model flag"})`);

try {
  const out = execFileSync("docker", args, { encoding: "utf8", timeout: 120_000 });
  console.log("stdout:", out);
  console.log("exit: 0");
} catch (err) {
  const e = err as { stdout?: string; stderr?: string; status?: number };
  console.log("stdout:", e.stdout ?? "");
  console.log("stderr:", e.stderr ?? "");
  console.log("exit:", e.status);
}
