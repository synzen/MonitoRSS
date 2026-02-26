import { spawn, type ChildProcess } from "child_process";

let tunnelProcess: ChildProcess | null = null;

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
  }
}
