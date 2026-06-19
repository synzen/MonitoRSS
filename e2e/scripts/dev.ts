/**
 * One-command dev session for Paddle webhook testing.
 *
 * Replaces the manual three-step dance of:
 *   1. docker compose -f docker-compose.dev.yml up --watch
 *   2. ngrok http 8000
 *   3. pasting the ngrok URL into the Paddle sandbox notification setting
 *
 * Instead this:
 *   - brings up the dev stack with file-watching,
 *   - opens a cloudflared tunnel to the web-api port,
 *   - PATCHes the Paddle sandbox notification setting's destination to
 *     <tunnel>/api/v1/subscription-products/paddle-webhook,
 *   - and on exit, tears down the tunnel and the stack.
 */
import { spawn, type ChildProcess } from "child_process";
import { readFileSync } from "fs";
import { join, resolve } from "path";
import { startTunnel, stopTunnel } from "../helpers/tunnel";
import { updateNotificationUrl } from "../helpers/paddle-api";

const REPO_ROOT = resolve(__dirname, "..", "..");
const COMPOSE_FILE = join(REPO_ROOT, "docker-compose.dev.yml");
const WEBHOOK_PATH = "/api/v1/subscription-products/paddle-webhook";

// Loads KEY=VALUE pairs from an env file into process.env without clobbering
// anything already set in the real environment.
function loadEnvFile(path: string): void {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// The notification setting id is encoded in the webhook secret
// (pdl_<settingId>_<random>), so derive it from there to avoid a duplicate
// source of truth. An explicit E2E_PADDLE_NOTIFICATION_SETTING_ID still wins.
function resolveNotificationSettingId(): string {
  if (process.env.E2E_PADDLE_NOTIFICATION_SETTING_ID) {
    return process.env.E2E_PADDLE_NOTIFICATION_SETTING_ID;
  }

  const secret = process.env.BACKEND_API_PADDLE_WEBHOOK_SECRET ?? "";
  const match = secret.match(/^pdl_(ntfset_[a-z0-9]+)_/i);
  if (match) {
    return match[1];
  }

  throw new Error(
    "Could not resolve the Paddle notification setting id. Set " +
      "E2E_PADDLE_NOTIFICATION_SETTING_ID, or ensure " +
      "BACKEND_API_PADDLE_WEBHOOK_SECRET is in pdl_<settingId>_<secret> form.",
  );
}

// Bring the stack up detached so its container logs don't flood the terminal.
async function composeUp(): Promise<void> {
  await new Promise<void>((resolveUp, rejectUp) => {
    const up = spawn("docker", ["compose", "-f", COMPOSE_FILE, "up", "-d"], {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
    up.on("error", rejectUp);
    up.on("exit", (code) =>
      code === 0
        ? resolveUp()
        : rejectUp(new Error(`docker compose up exited with code ${code}`)),
    );
  });
}

// Run `docker compose watch` in the foreground for just the sync/rebuild
// output. The returned process owns the session lifecycle.
function startWatch(): ChildProcess {
  const proc = spawn("docker", ["compose", "-f", COMPOSE_FILE, "watch"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });

  proc.on("error", (err) => {
    console.error(`Failed to start docker compose watch: ${err.message}`);
    process.exit(1);
  });

  return proc;
}

async function stopCompose(): Promise<void> {
  await new Promise<void>((resolveDown) => {
    const down = spawn("docker", ["compose", "-f", COMPOSE_FILE, "down"], {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
    down.on("exit", () => resolveDown());
    down.on("error", () => resolveDown());
  });
}

async function main() {
  loadEnvFile(join(REPO_ROOT, ".env.local"));
  loadEnvFile(join(__dirname, "..", ".env"));

  const port = Number(process.env.BACKEND_API_PORT ?? 8000);
  process.env.E2E_PADDLE_NOTIFICATION_SETTING_ID = resolveNotificationSettingId();

  let shuttingDown = false;
  await composeUp();
  const compose = startWatch();

  async function shutdown(code: number) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\nShutting down dev session...");
    await stopTunnel().catch(() => undefined);
    if (!compose.killed) {
      compose.kill("SIGINT");
    }
    await stopCompose();
    process.exit(code);
  }

  process.on("SIGINT", () => void shutdown(0));
  process.on("SIGTERM", () => void shutdown(0));
  compose.on("exit", (code) => void shutdown(code ?? 0));

  console.log(`Opening cloudflared tunnel to http://localhost:${port}...`);
  const tunnelUrl = await startTunnel(port);
  const webhookUrl = `${tunnelUrl}${WEBHOOK_PATH}`;

  await updateNotificationUrl(webhookUrl);

  console.log("\n========================================================");
  console.log(`  Tunnel:        ${tunnelUrl}`);
  console.log(`  Paddle webhook: ${webhookUrl}`);
  console.log("  Dev stack is running with --watch. Ctrl+C to stop.");
  console.log("========================================================\n");
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : String(err));
  await stopTunnel().catch(() => undefined);
  process.exit(1);
});
