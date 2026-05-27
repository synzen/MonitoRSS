import { spawn, type ChildProcess } from "child_process";
import {
  writeFileSync,
  readFileSync,
  unlinkSync,
  existsSync,
  openSync,
  closeSync,
  watch,
} from "fs";
import { join } from "path";

let tunnelProcess: ChildProcess | null = null;

const PID_FILE = join(process.cwd(), ".tunnel-pid");
const LOG_FILE = join(process.cwd(), ".cloudflared.log");
const URL_REGEX = /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/;

function startWithFileOutput(
  cloudflaredPath: string,
  port: number,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    writeFileSync(LOG_FILE, "");
    const logFd = openSync(LOG_FILE, "a");

    const proc = spawn(
      cloudflaredPath,
      ["tunnel", "--url", `http://localhost:${port}`],
      { detached: true, stdio: ["ignore", logFd, logFd] },
    );

    tunnelProcess = proc;
    proc.unref();
    closeSync(logFd);

    if (proc.pid) {
      writeFileSync(PID_FILE, String(proc.pid));
    }

    let resolved = false;

    const pollInterval = setInterval(() => {
      try {
        const content = readFileSync(LOG_FILE, "utf-8");
        const match = content.match(URL_REGEX);
        if (match && !resolved) {
          resolved = true;
          clearInterval(pollInterval);
          resolve(match[0]);
        }
      } catch {
        // file not ready yet
      }
    }, 500);

    proc.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearInterval(pollInterval);
        reject(
          new Error(
            `Failed to start cloudflared: ${err.message}. ` +
              "Install it via: winget install cloudflare.cloudflared",
          ),
        );
      }
    });

    proc.on("exit", (code) => {
      if (!resolved) {
        resolved = true;
        clearInterval(pollInterval);
        reject(
          new Error(
            `cloudflared exited with code ${code} before providing a URL`,
          ),
        );
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        clearInterval(pollInterval);
        proc.kill();
        reject(new Error("Timed out waiting for cloudflared tunnel URL (30s)"));
      }
    }, 30000);
  });
}

function startWithPipes(
  cloudflaredPath: string,
  port: number,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(
      cloudflaredPath,
      ["tunnel", "--url", `http://localhost:${port}`],
      { detached: true, stdio: ["ignore", "pipe", "pipe"] },
    );

    tunnelProcess = proc;
    proc.unref();
    let resolved = false;

    if (proc.pid) {
      writeFileSync(PID_FILE, String(proc.pid));
    }

    const onData = (data: Buffer) => {
      const output = data.toString();
      const match = output.match(URL_REGEX);
      if (match && !resolved) {
        resolved = true;
        resolve(match[0]);
      }
    };

    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);

    proc.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        reject(
          new Error(
            `Failed to start cloudflared: ${err.message}. ` +
              "Install it via: winget install cloudflare.cloudflared",
          ),
        );
      }
    });

    proc.on("exit", (code) => {
      if (!resolved) {
        resolved = true;
        reject(
          new Error(
            `cloudflared exited with code ${code} before providing a URL`,
          ),
        );
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        reject(new Error("Timed out waiting for cloudflared tunnel URL (30s)"));
      }
    }, 30000);
  });
}

export async function startTunnel(port: number): Promise<string> {
  const cloudflaredPath = process.env.CLOUDFLARED_PATH || "cloudflared";

  if (process.platform !== "win32") {
    return startWithFileOutput(cloudflaredPath, port);
  }

  return startWithPipes(cloudflaredPath, port);
}

export async function stopTunnel(): Promise<void> {
  if (tunnelProcess) {
    tunnelProcess.kill();
    tunnelProcess = null;
  } else if (existsSync(PID_FILE)) {
    const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);

    try {
      process.kill(pid);
    } catch {
      // process already exited
    }
  }

  try {
    unlinkSync(PID_FILE);
  } catch {
    // file may not exist
  }

  try {
    unlinkSync(LOG_FILE);
  } catch {
    // file may not exist
  }
}
