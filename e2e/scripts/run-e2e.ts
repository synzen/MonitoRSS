import { chromium } from "@playwright/test";
import { ChildProcess, spawn, spawnSync } from "child_process";
import {
  appendFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { basename, join, resolve } from "path";
import { pipeline } from "stream/promises";
import {
  createNotificationSetting,
  deleteNotificationSetting,
  deleteStaleEphemeralNotificationSettings,
} from "../helpers/paddle-api";
import {
  isPortFree,
  runProcess as runChildProcess,
  toPlaywrightArgs,
} from "./run-e2e-utils";

const E2E_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(E2E_DIR, "..");
const COMPOSE_FILE = join(REPO_ROOT, "docker-compose.e2e.yml");
const PLAYWRIGHT_CLI = require.resolve("@playwright/test/cli");
const LOG_DIR = join(E2E_DIR, "logs");
const PORT_STRIDE = 1000;
const DEFAULT_PORTS = {
  backend: 8100,
  frontend: 3100,
  mongo: 27019,
  rss: 3001,
  discord: 3002,
  smtp: 3004,
  smtpHttp: 3005,
  reddit: 3006,
};

type ProcessResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type RunContext = {
  instance: number;
  suffix: string;
  projectName: string;
  runDir: string;
  runnerLog: string;
  playwrightLog: string;
  dockerLog: string;
  combinedLog: string;
  mockLogs: string[];
  env: NodeJS.ProcessEnv;
};

let activeProcess: ChildProcess | undefined;
let logFollower: ChildProcess | undefined;
let logFollowerStream: ReturnType<typeof createWriteStream> | undefined;
let cleanupPromise: Promise<void> | undefined;
let context: RunContext | undefined;
let ephemeralPaddleSettingId: string | undefined;
let interrupted = false;
let cleanupFailed = false;

class RunInterruptedError extends Error {
  constructor() {
    super("E2E run interrupted");
  }
}

function throwIfInterrupted(): void {
  if (interrupted) throw new RunInterruptedError();
}

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function commandName(name: string): string {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function runSync(
  command: string,
  args: string[],
  env = process.env,
): ProcessResult {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? result.error?.message ?? "",
  };
}

function appendLog(path: string, text: string): void {
  appendFileSync(path, text);
}

function runProcess(
  command: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    logPath?: string;
    echo?: boolean;
    timeoutMs?: number;
  } = {},
): Promise<number> {
  return runChildProcess(command, args, {
    ...options,
    cwd: E2E_DIR,
    onStart: (child) => {
      activeProcess = child;
    },
    onFinish: (child) => {
      if (activeProcess === child) activeProcess = undefined;
    },
  });
}

function portsForInstance(instance: number): number[] {
  const offset = instance * PORT_STRIDE;
  return Object.values(DEFAULT_PORTS).map((port) => port + offset);
}

async function instanceIsFree(
  instance: number,
  usedProjects: Set<string>,
): Promise<boolean> {
  throwIfInterrupted();
  const project =
    instance === 0 ? "monitorss-e2e" : `monitorss-e2e-${instance}`;
  if (usedProjects.has(project)) return false;

  for (const port of portsForInstance(instance)) {
    throwIfInterrupted();
    const [ipv4Free, ipv6Free] = await Promise.all([
      isPortFree(port, "127.0.0.1"),
      isPortFree(port, "::1"),
    ]);
    throwIfInterrupted();
    if (!ipv4Free || !ipv6Free) return false;
  }
  return true;
}

function usedComposeProjects(): Set<string> {
  const result = runSync("docker", ["compose", "ls", "--format", "json"]);
  if (result.code !== 0) return new Set();
  try {
    const projects = JSON.parse(result.stdout) as Array<{ Name?: string }>;
    return new Set(
      projects.map(({ Name }) => Name).filter(Boolean) as string[],
    );
  } catch {
    return new Set(result.stdout.match(/monitorss-e2e(?:-[0-9]+)?/g) ?? []);
  }
}

async function resolveInstance(): Promise<number> {
  const requested = process.env.E2E_INSTANCE;
  const usedProjects = usedComposeProjects();
  throwIfInterrupted();
  if (requested !== undefined) {
    const instance = Number(requested);
    if (!Number.isInteger(instance) || instance < 0) {
      throw new Error(
        `E2E_INSTANCE must be a non-negative integer, got ${requested}`,
      );
    }
    if (!(await instanceIsFree(instance, usedProjects))) {
      throw new Error(
        `E2E_INSTANCE=${instance} has a busy compose project or host port: ${portsForInstance(instance).join(", ")}`,
      );
    }
    return instance;
  }

  for (let instance = 0; ; instance += 1) {
    throwIfInterrupted();
    if (await instanceIsFree(instance, usedProjects)) return instance;
  }
}

function isBillingRun(args: string[]): boolean {
  return args.some(
    (arg) =>
      arg.includes("e2e-paddle") || /(^|[\\/])billing([\\/]|$)/.test(arg),
  );
}

function checkCommand(command: string, args: string[]): string | undefined {
  const result = runSync(command, args);
  if (result.code === 0) return undefined;
  return (
    (result.stderr || result.stdout).trim() ||
    `${command} exited with code ${result.code}`
  );
}

function doctor(args: string[]): boolean {
  const billing = isBillingRun(args);
  const checks: Array<[string, string | undefined]> = [];
  checks.push([
    "Docker daemon",
    checkCommand("docker", ["info", "--format", "{{.ServerVersion}}"]),
  ]);
  checks.push([
    "Docker Compose",
    checkCommand("docker", ["compose", "version"]),
  ]);
  checks.push([
    "Playwright Chromium",
    existsSync(chromium.executablePath())
      ? undefined
      : `browser is not installed; run: ${commandName("npx")} playwright install chromium`,
  ]);

  if (billing) {
    checks.push(["cloudflared", checkCommand("cloudflared", ["--version"])]);
    for (const key of [
      "BACKEND_API_PADDLE_KEY",
      "BACKEND_API_PADDLE_URL",
      "VITE_PADDLE_CLIENT_TOKEN",
    ]) {
      checks.push([
        key,
        process.env[key] ? undefined : `missing from e2e/.env or .env.local`,
      ]);
    }
    if (
      process.env.E2E_PADDLE_NOTIFICATION_SETTING_ID &&
      !process.env.BACKEND_API_PADDLE_WEBHOOK_SECRET
    ) {
      checks.push([
        "BACKEND_API_PADDLE_WEBHOOK_SECRET",
        "required when E2E_PADDLE_NOTIFICATION_SETTING_ID is provided",
      ]);
    }
  }

  console.log(`E2E doctor (${billing ? "Paddle" : "web"} run):`);
  let healthy = true;
  for (const [name, error] of checks) {
    if (error) {
      healthy = false;
      console.error(`  FAIL ${name}: ${error}`);
    } else {
      console.log(`  PASS ${name}`);
    }
  }
  return healthy;
}

function createContext(instance: number): RunContext {
  const offset = instance * PORT_STRIDE;
  const suffix = instance === 0 ? "" : `-${instance}`;
  const projectName =
    instance === 0 ? "monitorss-e2e" : `monitorss-e2e-${instance}`;
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}${suffix}`;
  const runDir = join(LOG_DIR, "runs", runId);
  mkdirSync(runDir, { recursive: true });

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    E2E_INSTANCE: String(instance),
    E2E_BACKEND_PORT: String(DEFAULT_PORTS.backend + offset),
    E2E_FRONTEND_PORT: String(DEFAULT_PORTS.frontend + offset),
    E2E_MONGO_PORT: String(DEFAULT_PORTS.mongo + offset),
    E2E_MOCK_RSS_PORT: String(DEFAULT_PORTS.rss + offset),
    E2E_MOCK_DISCORD_PORT: String(DEFAULT_PORTS.discord + offset),
    E2E_MOCK_SMTP_PORT: String(DEFAULT_PORTS.smtp + offset),
    E2E_MOCK_SMTP_HTTP_PORT: String(DEFAULT_PORTS.smtpHttp + offset),
    E2E_MOCK_REDDIT_PORT: String(DEFAULT_PORTS.reddit + offset),
    BACKEND_API_REDDIT_CLIENT_ID:
      process.env.BACKEND_API_REDDIT_CLIENT_ID || "e2e-reddit-client-id",
    COMPOSE_PROJECT_NAME: projectName,
  };

  const mockLogs = ["rss", "discord", "smtp", "reddit"].map((name) =>
    join(LOG_DIR, `mock-${name}${suffix}.log`),
  );
  return {
    instance,
    suffix,
    projectName,
    runDir,
    runnerLog: join(LOG_DIR, `runner${suffix}.log`),
    playwrightLog: join(LOG_DIR, `playwright${suffix}.log`),
    dockerLog: join(LOG_DIR, `docker-stack${suffix}.log`),
    combinedLog: join(LOG_DIR, `combined${suffix}.log`),
    mockLogs,
    env,
  };
}

function prepareLogs(runContext: RunContext): void {
  mkdirSync(LOG_DIR, { recursive: true });
  for (const path of [
    runContext.runnerLog,
    runContext.playwrightLog,
    runContext.dockerLog,
    runContext.combinedLog,
    ...runContext.mockLogs,
  ]) {
    rmSync(path, { force: true });
  }
  writeFileSync(
    join(LOG_DIR, `latest-run${runContext.suffix}.txt`),
    `${runContext.runDir}\n`,
  );
}

function composeArgs(runContext: RunContext, args: string[]): string[] {
  return ["compose", "-f", COMPOSE_FILE, "-p", runContext.projectName, ...args];
}

function startLogFollower(runContext: RunContext): void {
  const stream = createWriteStream(runContext.dockerLog, { flags: "w" });
  logFollowerStream = stream;
  logFollower = spawn(
    "docker",
    composeArgs(runContext, ["logs", "--no-color", "--timestamps", "--follow"]),
    {
      cwd: REPO_ROOT,
      env: runContext.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  logFollower.stdout?.pipe(stream, { end: false });
  logFollower.stderr?.pipe(stream, { end: false });
  logFollower.once("error", (error) => {
    appendLog(
      runContext.runnerLog,
      `Docker log follower failed: ${String(error)}\n`,
    );
    stream.end();
  });
  logFollower.once("exit", () => stream.end());
}

async function waitForExit(
  child: ChildProcess,
  timeoutMs: number,
): Promise<boolean> {
  if (child.exitCode !== null) return true;
  return new Promise((resolveWait) => {
    const timeout = setTimeout(() => resolveWait(false), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolveWait(true);
    });
  });
}

async function stopLogFollower(): Promise<void> {
  if (!logFollower) return;
  if (!(await waitForExit(logFollower, 10_000))) {
    logFollower.kill("SIGKILL");
    if (!(await waitForExit(logFollower, 2_000))) {
      logFollower.stdout?.destroy();
      logFollower.stderr?.destroy();
      logFollower.unref();
    }
  }
  logFollowerStream?.end();
  logFollowerStream = undefined;
  logFollower = undefined;
}

async function copyIfPresent(
  source: string,
  destination: string,
): Promise<void> {
  if (!existsSync(source)) return;
  await pipeline(createReadStream(source), createWriteStream(destination));
}

async function assembleLogs(runContext: RunContext): Promise<void> {
  const sections: Array<[string, string]> = [
    ["RUNNER", runContext.runnerLog],
    ["PLAYWRIGHT", runContext.playwrightLog],
    ["DOCKER STACK", runContext.dockerLog],
    ...runContext.mockLogs.map(
      (path) =>
        [`MOCK: ${basename(path).replace(/\.log$/, "")}`, path] as [
          string,
          string,
        ],
    ),
  ];
  writeFileSync(runContext.combinedLog, "");
  for (const [name, path] of sections) {
    appendFileSync(runContext.combinedLog, `===== ${name} =====\n`);
    if (existsSync(path)) {
      appendFileSync(runContext.combinedLog, readFileSync(path));
    } else {
      appendFileSync(runContext.combinedLog, `(no ${basename(path)} log)\n`);
    }
    appendFileSync(runContext.combinedLog, "\n");
  }

  for (const path of [
    runContext.runnerLog,
    runContext.playwrightLog,
    runContext.dockerLog,
    runContext.combinedLog,
    ...runContext.mockLogs,
  ]) {
    await copyIfPresent(path, join(runContext.runDir, basename(path)));
  }
}

async function cleanup(): Promise<void> {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    if (!context) return;

    if (ephemeralPaddleSettingId) {
      console.log(
        `Deleting ephemeral Paddle notification setting: ${ephemeralPaddleSettingId}`,
      );
      await deleteNotificationSetting(ephemeralPaddleSettingId).catch(
        (error) => {
          appendLog(
            context!.runnerLog,
            `Paddle setting cleanup failed: ${String(error)}\n`,
          );
        },
      );
    }

    console.log("Tearing down E2E Docker stack...");
    const downCode = await runProcess(
      "docker",
      composeArgs(context, ["down", "--volumes", "--remove-orphans"]),
      { env: context.env, logPath: context.runnerLog, timeoutMs: 60_000 },
    ).catch((error) => {
      cleanupFailed = true;
      appendLog(
        context!.runnerLog,
        `Docker teardown failed: ${String(error)}\n`,
      );
      return 1;
    });
    if (downCode !== 0) {
      cleanupFailed = true;
      appendLog(
        context.runnerLog,
        `Docker teardown exited with code ${downCode}\n`,
      );
    }

    await stopLogFollower().catch((error) => {
      cleanupFailed = true;
      appendLog(
        context!.runnerLog,
        `Log follower cleanup failed: ${String(error)}\n`,
      );
    });
    await assembleLogs(context).catch((error) => {
      cleanupFailed = true;
      console.error(`Log assembly failed: ${String(error)}`);
    });
    console.log(`Combined log: ${context.combinedLog}`);
    console.log(`Archived run: ${context.runDir}`);
  })();
  return cleanupPromise;
}

async function main(): Promise<number> {
  loadEnvFile(join(E2E_DIR, ".env"));
  loadEnvFile(join(REPO_ROOT, ".env.local"));

  const rawArgs = process.argv.slice(2);
  const doctorOnly = rawArgs.includes("--doctor");
  const playwrightArgs = toPlaywrightArgs(rawArgs);
  const effectiveArgs = playwrightArgs.length
    ? playwrightArgs
    : ["--project=e2e-web"];
  if (!doctor(effectiveArgs)) return 1;
  throwIfInterrupted();
  if (doctorOnly) return 0;

  const instance = await resolveInstance();
  throwIfInterrupted();
  context = createContext(instance);
  const billing = isBillingRun(effectiveArgs);
  if (!billing) {
    for (const key of [
      "BACKEND_API_PADDLE_KEY",
      "BACKEND_API_PADDLE_URL",
      "BACKEND_API_PADDLE_WEBHOOK_SECRET",
      "VITE_PADDLE_CLIENT_TOKEN",
    ]) {
      context.env[key] = "";
    }
  }

  prepareLogs(context);
  rmSync(join(E2E_DIR, `test-results${context.suffix}`), {
    recursive: true,
    force: true,
  });
  rmSync(join(E2E_DIR, `playwright-report${context.suffix}`), {
    recursive: true,
    force: true,
  });

  if (billing && !context.env.E2E_PADDLE_NOTIFICATION_SETTING_ID) {
    throwIfInterrupted();
    console.log("Creating ephemeral Paddle notification setting...");
    await deleteStaleEphemeralNotificationSettings().catch((error) => {
      appendLog(
        context!.runnerLog,
        `Stale Paddle setting cleanup failed: ${String(error)}\n`,
      );
    });
    throwIfInterrupted();
    const setting = await createNotificationSetting();
    ephemeralPaddleSettingId = setting.id;
    context.env.E2E_PADDLE_NOTIFICATION_SETTING_ID = setting.id;
    context.env.BACKEND_API_PADDLE_WEBHOOK_SECRET = setting.secret;
    console.log(`Created Paddle notification setting: ${setting.id}`);
    throwIfInterrupted();
  }

  console.log(
    `Starting E2E Docker stack (instance: ${instance}, project: ${context.projectName})...`,
  );
  console.log(
    `  backend=${context.env.E2E_BACKEND_PORT} frontend=${context.env.E2E_FRONTEND_PORT} mongo=${context.env.E2E_MONGO_PORT} rss-mock=${context.env.E2E_MOCK_RSS_PORT} discord-mock=${context.env.E2E_MOCK_DISCORD_PORT} smtp-mock=${context.env.E2E_MOCK_SMTP_PORT}/${context.env.E2E_MOCK_SMTP_HTTP_PORT} reddit-mock=${context.env.E2E_MOCK_REDDIT_PORT}`,
  );
  appendLog(
    context.runnerLog,
    `Playwright arguments: ${JSON.stringify(effectiveArgs)}\n`,
  );

  // web-client is not bind-mounted (see docker-compose.e2e.yml) and Vite
  // transforms per-request. A plain `up --build` can reuse a stale COPY
  // layer and silently run old client code, which hides fixes like the
  // keyboard coordinateGetter. Force a no-cache build for web-client so
  // e2e always runs the current source.
  await runProcess(
    "docker",
    composeArgs(context, ["build", "--no-cache", "web-client"]),
    { env: context.env, logPath: context.runnerLog },
  );
  throwIfInterrupted();

  const upCode = await runProcess(
    "docker",
    composeArgs(context, ["up", "-d", "--build", "--wait"]),
    { env: context.env, logPath: context.runnerLog },
  );
  throwIfInterrupted();
  if (upCode !== 0) {
    console.error(
      "E2E stack failed to start; container status and recent logs follow:",
    );
    await runProcess("docker", composeArgs(context, ["ps", "-a"]), {
      env: context.env,
      logPath: context.runnerLog,
    });
    throwIfInterrupted();
    await runProcess(
      "docker",
      composeArgs(context, ["logs", "--no-color", "--tail=200"]),
      { env: context.env, logPath: context.dockerLog },
    );
    throwIfInterrupted();
    return upCode;
  }

  throwIfInterrupted();
  startLogFollower(context);
  console.log(
    `Running E2E tests; live Playwright log: ${context.playwrightLog}`,
  );
  const testEnv = {
    ...context.env,
    E2E_BACKEND_URL: `http://127.0.0.1:${context.env.E2E_BACKEND_PORT}`,
    E2E_BASE_URL: `http://localhost:${context.env.E2E_FRONTEND_PORT}`,
  };
  return runProcess(
    process.execPath,
    [PLAYWRIGHT_CLI, "test", ...effectiveArgs],
    { env: testEnv, logPath: context.playwrightLog },
  );
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    interrupted = true;
    if (activeProcess && !activeProcess.killed) activeProcess.kill(signal);
  });
}

main()
  .then(async (code) => {
    await cleanup();
    const exitCode = interrupted ? 130 : cleanupFailed && code === 0 ? 1 : code;
    // Force exit to avoid hanging on lingering handles (docker log follower,
    // un-closed streams). Node's `process.exitCode` alone relies on the
    // event loop draining, which can keep the runner alive after teardown.
    process.exit(exitCode);
  })
  .catch(async (error) => {
    if (!(error instanceof RunInterruptedError)) {
      console.error(error instanceof Error ? error.message : String(error));
    }
    if (context)
      appendLog(
        context.runnerLog,
        `${error instanceof Error ? error.stack : String(error)}\n`,
      );
    await cleanup();
    process.exit(interrupted ? 130 : 1);
  });
