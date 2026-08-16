import { ChildProcess, spawn, SpawnOptions } from "child_process";
import { createWriteStream } from "fs";
import { createServer } from "net";

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
