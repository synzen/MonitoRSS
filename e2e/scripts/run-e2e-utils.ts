import { ChildProcess, spawn, SpawnOptions } from "child_process";
import { createWriteStream, readdirSync, rmSync, statSync } from "fs";
import { createServer } from "net";
import { join } from "path";

export type RunProcessOptions = {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  logPath?: string;
  echo?: boolean;
  timeoutMs?: number;
  onStart?: (child: ChildProcess) => void;
  onFinish?: (child: ChildProcess) => void;
  spawnProcess?: (
    command: string,
    args: string[],
    options: SpawnOptions,
  ) => ChildProcess;
};

export function toPlaywrightArgs(args: string[]): string[] {
  return args.filter((arg) => arg !== "--doctor" && arg !== "--");
}

/**
 * Deletes archived run directories beyond the newest `keep` entries. The
 * runner archives every run's logs under logs/runs/<timestamp>; without this
 * bound a developer machine accumulates a full log copy per run forever.
 */
export function pruneOldRunDirs(runsDir: string, keep: number): string[] {
  let names: string[];

  try {
    names = readdirSync(runsDir);
  } catch {
    return [];
  }

  const keptCount = Math.max(0, Math.floor(keep));
  const dirs = names
    .map((name) => {
      const path = join(runsDir, name);
      try {
        const stats = statSync(path);

        return stats.isDirectory() ? { path, mtimeMs: stats.mtimeMs } : null;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is { path: string; mtimeMs: number } => !!entry)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const removed: string[] = [];
  for (const dir of dirs.slice(keptCount)) {
    rmSync(dir.path, { recursive: true, force: true });
    removed.push(dir.path);
  }

  return removed;
}

export function classifyPortBindError(
  error: NodeJS.ErrnoException,
): "busy" | "unsupported" | "fatal" {
  if (error.code === "EADDRINUSE" || error.code === "EACCES") return "busy";
  if (
    error.code === "EAFNOSUPPORT" ||
    error.code === "EADDRNOTAVAIL" ||
    error.code === "EPROTONOSUPPORT"
  ) {
    return "unsupported";
  }
  return "fatal";
}

export function isPortFree(port: number, host: string): Promise<boolean> {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.unref();
    server.once("error", (error: NodeJS.ErrnoException) => {
      const classification = classifyPortBindError(error);
      if (classification === "fatal") rejectPort(error);
      else resolvePort(classification === "unsupported");
    });
    server.listen({ port, host, exclusive: true }, () => {
      server.close(() => resolvePort(true));
    });
  });
}

export function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions,
): Promise<number> {
  return new Promise((resolveRun, rejectRun) => {
    const child = (options.spawnProcess ?? spawn)(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["inherit", "pipe", "pipe"],
      windowsHide: true,
    });
    options.onStart?.(child);
    const logStream = options.logPath
      ? createWriteStream(options.logPath, { flags: "a" })
      : undefined;
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;
    let completionError: Error | undefined;

    const settle = (error?: Error, code = 1) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      options.onFinish?.(child);
      const finish = () => (error ? rejectRun(error) : resolveRun(code));
      if (logStream) logStream.end(finish);
      else finish();
    };

    const write = (chunk: Buffer, target: NodeJS.WriteStream) => {
      if (options.echo !== false) target.write(chunk);
      logStream?.write(chunk);
    };

    child.stdout?.on("data", (chunk: Buffer) => write(chunk, process.stdout));
    child.stderr?.on("data", (chunk: Buffer) => write(chunk, process.stderr));
    child.once("error", (error) => {
      completionError = error;
    });
    child.once("close", (code) => settle(completionError, code ?? 1));
    if (options.timeoutMs) {
      timeout = setTimeout(() => {
        completionError = new Error(
          `${command} ${args.join(" ")} timed out after ${options.timeoutMs}ms`,
        );
        child.kill("SIGKILL");
        child.stdout?.destroy();
        child.stderr?.destroy();
        child.unref();
      }, options.timeoutMs);
    }
  });
}
