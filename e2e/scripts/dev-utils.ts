import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { createServer } from "node:net";
import { join } from "node:path";

export const DEV_PROJECT_NAME = "monitorss-dev";

export function formatPortInUseError(port: number, service: string): string {
  return `Cannot start the dev stack: port ${port} is already in use. The ${service} needs http://localhost:${port}. Stop the process using that port, then run npm run dev again.`;
}

export async function assertPortAvailable(
  port: number,
  service: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();

    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        reject(new Error(formatPortInUseError(port, service)));
        return;
      }
      reject(error);
    });

    server.listen({ port, host: "0.0.0.0" }, () => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
}

export function parseComposeLockPid(output: string): number | null {
  const match = output.match(/process with PID (\d+) is still running/);
  return match ? Number(match[1]) : null;
}

export function getComposeLockFilePath(
  projectName: string,
  overrides: {
    platform?: NodeJS.Platform;
    localAppData?: string;
    home?: string;
    uid?: number;
  } = {},
): string {
  const platform = overrides.platform ?? process.platform;
  const home = overrides.home ?? homedir();
  if (platform === "win32") {
    const base =
      overrides.localAppData ??
      process.env.LOCALAPPDATA ??
      join(home, "AppData", "Local");
    return join(base, "docker-compose", `${projectName}.pid`);
  }
  if (platform === "darwin") {
    return join(
      home,
      "Library",
      "Application Support",
      "com.docker.compose",
      `${projectName}.pid`,
    );
  }
  const uid = overrides.uid ?? process.getuid?.();
  if (uid !== undefined) {
    return join(`/run/user/${uid}`, "docker-compose", `${projectName}.pid`);
  }
  return join(home, ".docker", "docker-compose", `${projectName}.pid`);
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "EPERM") return true;
    return false;
  }
}

// Compose on Windows only checks PID existence, not the process name, so a
// stale pidfile can point at an unrelated process (conhost, TextInputHost).
// Only treat the lock as live when the holder is actually docker/compose.
export function isDockerComposeProcess(pid: number): boolean {
  try {
    if (process.platform === "win32") {
      const result = spawnSync("tasklist", [
        "/FI",
        `PID eq ${pid}`,
        "/FO",
        "CSV",
        "/NH",
      ]);
      const output = (result.stdout ?? "").toString();
      return /docker|compose/i.test(output);
    }
    const result = spawnSync("ps", ["-p", String(pid), "-o", "comm="]);
    const output = (result.stdout ?? "").toString().trim();
    if (!output) return false;
    return /docker|compose/i.test(output);
  } catch {
    return true;
  }
}

export function shouldClearComposeLock(
  pidRaw: string,
  alive: boolean,
  isDocker: boolean,
): boolean {
  if (!/^\d+$/.test(pidRaw.trim())) return true;
  if (!alive) return true;
  return !isDocker;
}

export function clearStaleComposeLock(projectName: string): {
  cleared: boolean;
  reason: string;
} {
  let lockFile: string;
  try {
    lockFile = getComposeLockFilePath(projectName);
  } catch (error) {
    return {
      cleared: false,
      reason: `could not resolve lock path: ${String(error)}`,
    };
  }
  if (!existsSync(lockFile)) return { cleared: false, reason: "no lock file" };
  let raw: string;
  try {
    raw = readFileSync(lockFile, "utf-8");
  } catch (error) {
    return { cleared: false, reason: `could not read lock: ${String(error)}` };
  }
  const pid = Number(raw.trim());
  const alive = Number.isInteger(pid) ? isPidAlive(pid) : false;
  const isDocker =
    Number.isInteger(pid) && alive ? isDockerComposeProcess(pid) : false;
  if (!shouldClearComposeLock(raw, alive, isDocker)) {
    return { cleared: false, reason: `live compose holder (PID ${pid})` };
  }
  try {
    unlinkSync(lockFile);
  } catch (error) {
    return {
      cleared: false,
      reason: `could not remove stale lock: ${String(error)}`,
    };
  }
  if (!/^\d+$/.test(raw.trim())) return { cleared: true, reason: "bad pid" };
  if (!alive) return { cleared: true, reason: `stale holder PID ${pid}` };
  return { cleared: true, reason: `false-positive holder PID ${pid}` };
}

export function runCompose(
  args: string[],
  cwd: string,
): Promise<{ code: number; output: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn("docker", args, {
      cwd,
      stdio: ["inherit", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      process.stderr.write(chunk);
    });
    child.once("error", rejectRun);
    child.once("close", (code) => resolveRun({ code: code ?? 1, output }));
  });
}
