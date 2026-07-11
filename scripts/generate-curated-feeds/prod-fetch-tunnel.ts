/**
 * In-process orchestration for reaching the private prod feed-requests API:
 * preflight prerequisite checks, resolve the API task's private IP (it changes
 * every deploy), read the API key from SSM Parameter Store, spawn an SSM
 * remote-host port-forwarding session through the NAT instance, and tear it
 * all down on exit — success, failure, crash, and Ctrl+C.
 *
 * If FEED_REQUESTS_API_URL and FEED_REQUESTS_API_KEY are already set, they are
 * used verbatim and all orchestration is skipped.
 *
 * Infrastructure identifiers (profile, cluster, instance name, parameter path)
 * live in prod-fetch.local.json, which is deliberately untracked: this repo is
 * public. The API key is held in memory only and never written to disk.
 */
import { spawn, spawnSync, type ChildProcess } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import net from "net";

interface TunnelConfig {
  awsProfile: string;
  awsRegion: string;
  ecsCluster: string;
  ecsService: string;
  natInstanceName: string;
  apiKeySsmParameter: string;
  taskPort: number;
  localPort: number;
}

const CONFIG_FILE = "prod-fetch.local.json";
const HEALTH_PATH = "/v1/feed-requests/health";
const READINESS_TIMEOUT_MS = 60_000;

function loadTunnelConfig(): TunnelConfig {
  const configPath = join(__dirname, CONFIG_FILE);

  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch (err) {
    throw new Error(
      `Could not read ${configPath} (${(err as Error).message}). This file ` +
        `holds the prod infrastructure ` +
        `identifiers and is intentionally untracked (see SPEC-prod-fetch.md). ` +
        `Create it with keys: awsProfile, awsRegion, ecsCluster, ecsService, ` +
        `natInstanceName, apiKeySsmParameter, taskPort, localPort.`,
    );
  }

  const parsed = JSON.parse(raw) as Partial<TunnelConfig>;
  const stringKeys = [
    "awsProfile",
    "awsRegion",
    "ecsCluster",
    "ecsService",
    "natInstanceName",
    "apiKeySsmParameter",
  ] as const;
  const numberKeys = ["taskPort", "localPort"] as const;

  for (const key of stringKeys) {
    if (typeof parsed[key] !== "string" || !parsed[key]) {
      throw new Error(`${CONFIG_FILE} is missing required string key "${key}"`);
    }
  }
  for (const key of numberKeys) {
    if (typeof parsed[key] !== "number") {
      throw new Error(`${CONFIG_FILE} is missing required number key "${key}"`);
    }
  }

  return parsed as TunnelConfig;
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

function assertPrerequisites(config: TunnelConfig): void {
  const awsVersion = spawnSync("aws", ["--version"], { encoding: "utf-8" });
  if (awsVersion.error || awsVersion.status !== 0) {
    throw new Error(
      "AWS CLI not found on PATH. Install AWS CLI v2 before running this " +
        "script, or set FEED_REQUESTS_API_URL and FEED_REQUESTS_API_KEY to " +
        "skip tunnel orchestration.",
    );
  }

  const plugin = spawnSync("session-manager-plugin", [], { encoding: "utf-8" });
  if (plugin.error) {
    throw new Error(
      "session-manager-plugin not found on PATH. Install it " +
        "(https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) " +
        "before running this script.",
    );
  }

  const profiles = spawnSync("aws", ["configure", "list-profiles"], {
    encoding: "utf-8",
  });
  const profileNames = (profiles.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim());
  if (profiles.status !== 0 || !profileNames.includes(config.awsProfile)) {
    throw new Error(
      `AWS profile "${config.awsProfile}" is not configured. Run ` +
        `"aws configure --profile ${config.awsProfile}" or point ` +
        `${CONFIG_FILE} at the right profile.`,
    );
  }
}

async function assertLocalPortFree(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => {
      reject(
        new Error(
          `Local port ${port} is already in use. Free it or change ` +
            `"localPort" in ${CONFIG_FILE}.`,
        ),
      );
    });
    probe.once("listening", () => probe.close(() => resolve()));
    probe.listen(port, "127.0.0.1");
  });
}

// ---------------------------------------------------------------------------
// AWS lookups
// ---------------------------------------------------------------------------

async function runAws(config: TunnelConfig, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "aws",
      [
        ...args,
        "--profile",
        config.awsProfile,
        "--region",
        config.awsRegion,
        "--output",
        "json",
        "--no-cli-pager",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(`aws ${args.join(" ")} failed: ${stderr.trim() || code}`),
        );
      }
    });
  });
}

async function resolveNatInstanceId(config: TunnelConfig): Promise<string> {
  const output = await runAws(config, [
    "ec2",
    "describe-instances",
    "--filters",
    `Name=tag:Name,Values=${config.natInstanceName}`,
    "Name=instance-state-name,Values=running",
    "--query",
    "Reservations[].Instances[].InstanceId",
  ]);

  const instanceIds = JSON.parse(output) as string[];
  if (instanceIds.length === 0) {
    throw new Error(
      `No running instance found with Name tag "${config.natInstanceName}"`,
    );
  }
  return instanceIds[0];
}

async function resolveTaskPrivateIp(config: TunnelConfig): Promise<string> {
  const listOutput = await runAws(config, [
    "ecs",
    "list-tasks",
    "--cluster",
    config.ecsCluster,
    "--service-name",
    config.ecsService,
    "--desired-status",
    "RUNNING",
  ]);
  const { taskArns } = JSON.parse(listOutput) as { taskArns: string[] };
  if (!taskArns?.length) {
    throw new Error(
      `No running tasks found for service "${config.ecsService}" in cluster ` +
        `"${config.ecsCluster}"`,
    );
  }

  const describeOutput = await runAws(config, [
    "ecs",
    "describe-tasks",
    "--cluster",
    config.ecsCluster,
    "--tasks",
    taskArns[0],
    "--query",
    "tasks[0].attachments[?type=='ElasticNetworkInterface'][].details[?name=='privateIPv4Address'][].value",
  ]);
  const ips = JSON.parse(describeOutput) as string[];
  if (!ips?.length) {
    throw new Error(
      `Could not resolve a private IP for task ${taskArns[0]} — no ` +
        `ElasticNetworkInterface attachment with privateIPv4Address`,
    );
  }
  return ips[0];
}

async function readApiKey(config: TunnelConfig): Promise<string> {
  const output = await runAws(config, [
    "ssm",
    "get-parameter",
    "--name",
    config.apiKeySsmParameter,
    "--with-decryption",
  ]);
  const parsed = JSON.parse(output) as { Parameter?: { Value?: string } };
  if (!parsed.Parameter?.Value) {
    throw new Error(
      `SSM parameter "${config.apiKeySsmParameter}" has no value`,
    );
  }
  return parsed.Parameter.Value;
}

// ---------------------------------------------------------------------------
// Tunnel lifecycle
// ---------------------------------------------------------------------------

let tunnelProcess: ChildProcess | null = null;
let tunnelSessionId: string | null = null;
let tunnelConfig: TunnelConfig | null = null;

function killTunnel(): void {
  const child = tunnelProcess;
  tunnelProcess = null;
  if (
    !child ||
    child.pid === undefined ||
    child.exitCode !== null ||
    child.signalCode !== null
  ) {
    return;
  }
  if (process.platform === "win32") {
    // taskkill /t takes the whole tree down, including the
    // session-manager-plugin grandchild that holds the actual session.
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
  } else {
    child.kill("SIGTERM");
  }

  // The force-kill drops the connection without ending the session on the
  // server, which would otherwise linger until its idle timeout.
  if (tunnelSessionId && tunnelConfig) {
    spawnSync("aws", [
      "ssm",
      "terminate-session",
      "--session-id",
      tunnelSessionId,
      "--profile",
      tunnelConfig.awsProfile,
      "--region",
      tunnelConfig.awsRegion,
      "--no-cli-pager",
    ]);
    tunnelSessionId = null;
  }
}

function registerTeardownHandlers(): void {
  process.once("exit", killTunnel);
  process.once("SIGINT", () => {
    killTunnel();
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    killTunnel();
    process.exit(143);
  });
}

function spawnTunnel(
  config: TunnelConfig,
  natInstanceId: string,
  taskIp: string,
): { child: ChildProcess; exited: Promise<never> } {
  const child = spawn(
    "aws",
    [
      "ssm",
      "start-session",
      "--target",
      natInstanceId,
      "--document-name",
      "AWS-StartPortForwardingSessionToRemoteHost",
      "--parameters",
      JSON.stringify({
        host: [taskIp],
        portNumber: [String(config.taskPort)],
        localPortNumber: [String(config.localPort)],
      }),
      "--profile",
      config.awsProfile,
      "--region",
      config.awsRegion,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  const recentOutput: string[] = [];
  const record = (chunk: Buffer) => {
    const text = chunk.toString();
    const sessionIdMatch = text.match(/SessionId: (\S+)/);
    if (sessionIdMatch) {
      tunnelSessionId = sessionIdMatch[1];
    }
    recentOutput.push(text);
    if (recentOutput.length > 20) {
      recentOutput.shift();
    }
  };
  child.stdout?.on("data", record);
  child.stderr?.on("data", record);

  tunnelProcess = child;

  // Safe to leave rejected after readiness: the races in waitForTunnelReady
  // attached handlers, so a late rejection is never unhandled.
  const exited = new Promise<never>((_, reject) => {
    child.on("error", (err) =>
      reject(new Error(`Failed to spawn SSM session: ${err.message}`)),
    );
    child.on("close", (code) =>
      reject(
        new Error(
          `SSM session exited unexpectedly (code ${code}):\n` +
            recentOutput.join("").trim(),
        ),
      ),
    );
  });

  return { child, exited };
}

async function waitForTunnelReady(
  apiUrl: string,
  exited: Promise<never>,
): Promise<void> {
  const deadline = Date.now() + READINESS_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const attempt = fetch(`${apiUrl}${HEALTH_PATH}`, {
      signal: AbortSignal.timeout(2000),
    }).then(
      () => true,
      () => false,
    );
    const delay = new Promise<false>((resolve) =>
      setTimeout(() => resolve(false), 500),
    );

    // exited rejects, aborting readiness immediately if the session dies
    if (await Promise.race([attempt, exited])) {
      return;
    }
    await Promise.race([delay, exited]);
  }

  throw new Error(
    `Tunnel did not become ready within ${READINESS_TIMEOUT_MS / 1000}s ` +
      `(no response from ${apiUrl}${HEALTH_PATH})`,
  );
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface ProdFetchSession {
  apiUrl: string;
  /** Idempotent; also runs automatically on exit, SIGINT, and SIGTERM. */
  stop: () => void;
}

export async function setUpProdFeedRequestsApi(): Promise<ProdFetchSession> {
  if (process.env.FEED_REQUESTS_API_URL && process.env.FEED_REQUESTS_API_KEY) {
    console.log(
      "FEED_REQUESTS_API_URL and FEED_REQUESTS_API_KEY are set — skipping " +
        "tunnel orchestration",
    );
    return { apiUrl: process.env.FEED_REQUESTS_API_URL, stop: () => {} };
  }

  const config = loadTunnelConfig();
  assertPrerequisites(config);
  await assertLocalPortFree(config.localPort);

  console.log("Resolving feed-requests task IP and reading credentials...");
  const [natInstanceId, taskIp, apiKey] = await Promise.all([
    resolveNatInstanceId(config),
    resolveTaskPrivateIp(config),
    readApiKey(config),
  ]);

  console.log(
    `Opening SSM port-forward via ${natInstanceId} to ${taskIp}:${config.taskPort} ` +
      `on local port ${config.localPort}...`,
  );
  registerTeardownHandlers();
  tunnelConfig = config;
  const { child, exited } = spawnTunnel(config, natInstanceId, taskIp);

  const apiUrl = `http://127.0.0.1:${config.localPort}`;
  try {
    await waitForTunnelReady(apiUrl, exited);
  } catch (err) {
    killTunnel();
    throw err;
  }

  // Detach so a finished pipeline can exit naturally — the exit handler then
  // tears the tunnel down. Without this, the piped stdio would keep the event
  // loop alive forever on the success path.
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();

  process.env.FEED_REQUESTS_API_URL = apiUrl;
  process.env.FEED_REQUESTS_API_KEY = apiKey;
  console.log(`Tunnel ready — feed-requests API reachable at ${apiUrl}`);

  return { apiUrl, stop: killTunnel };
}

// Standalone mode for manual verification and for reusing one tunnel across
// runs: opens the tunnel, optionally probes a feed URL through the prod API,
// then stays up until Ctrl+C.
async function main() {
  await setUpProdFeedRequestsApi();

  const probeUrl = process.argv[2];
  if (probeUrl) {
    const { fetchFeedViaProd } = await import("./prod-fetch");
    console.log(`Probing ${probeUrl} through the prod feed fetcher...`);
    const result = await fetchFeedViaProd(probeUrl);
    if (result.kind === "success") {
      console.log(`Probe OK — received ${result.body.length} bytes`);
    } else {
      console.log(
        `Probe returned feed-level failure: ${result.prodStatus}` +
          (result.statusCode !== undefined ? ` (HTTP ${result.statusCode})` : ""),
      );
    }
  }

  console.log("Tunnel is up. Ctrl+C to tear it down.");
  // The tunnel child is unref'd, so hold the event loop open until Ctrl+C.
  setInterval(() => {}, 1 << 30);
  await new Promise<never>(() => {});
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    killTunnel();
    process.exit(1);
  });
}
