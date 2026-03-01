import { spawn, type ChildProcess } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

let tunnelProcess: ChildProcess | null = null;

const PID_FILE = join(process.cwd(), "e2e", ".tunnel-pid");

export async function startTunnel(port: number): Promise<string> {
  const cloudflaredPath = process.env.CLOUDFLARED_PATH || "cloudflared";

  return new Promise<string>((resolve, reject) => {
    const proc = spawn(cloudflaredPath, [
      "tunnel",
      "--url",
      `http://localhost:${port}`,
    ]);

    tunnelProcess = proc;
    let resolved = false;

    if (proc.pid) {
      writeFileSync(PID_FILE, String(proc.pid));
    }

    const onData = (data: Buffer) => {
      const output = data.toString();
      const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        console.log(
          `Cloudflare tunnel started: ${match[0]} -> localhost:${port}`,
        );
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

export async function stopTunnel(): Promise<void> {
  if (tunnelProcess) {
    tunnelProcess.kill();
    tunnelProcess = null;
    console.log("Cloudflare tunnel stopped");
  } else if (existsSync(PID_FILE)) {
    const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);

    try {
      process.kill(pid);
      console.log(`Cloudflare tunnel stopped (PID ${pid} from file)`);
    } catch {
      console.log(`Cloudflare tunnel process (PID ${pid}) already exited`);
    }
  }

  try {
    unlinkSync(PID_FILE);
  } catch {
    // file may not exist
  }
}
