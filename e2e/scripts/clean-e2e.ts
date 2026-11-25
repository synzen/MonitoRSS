// Reclaims disk space accumulated by local E2E runs and repeated dev-stack
// recreations. `npm run e2e` already bounds its own growth (teardown removes
// project images, prunes old run logs and caps the Docker build cache); this
// is the explicit catch-up command for machines that ran older versions or
// accumulated dangling volumes from dev container recreations.
import { execFileSync, spawnSync } from "child_process";
import { join, resolve } from "path";
import { pruneOldRunDirs } from "./run-e2e-utils";

const E2E_DIR = resolve(__dirname, "..");
const LOG_DIR = join(E2E_DIR, "logs");
const parsedKeep = Number(process.env.E2E_RUN_LOGS_TO_KEEP);

const KEPT_RUN_LOGS =
  Number.isFinite(parsedKeep) && parsedKeep >= 0 ? Math.floor(parsedKeep) : 20;

function docker(args: string[], tolerateFailure = false): boolean {
  console.log(`> docker ${args.join(" ")}`);
  const result = spawnSync("docker", args, {
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.status !== 0 && !tolerateFailure) {
    console.error(`docker ${args.join(" ")} exited with code ${result.status}`);
    return false;
  }

  return result.status === 0;
}

function dockerOutput(args: string[]): string {
  try {
    return execFileSync("docker", args, {
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

function main(): number {
  const removedLogs = pruneOldRunDirs(join(LOG_DIR, "runs"), KEPT_RUN_LOGS);
  console.log(
    `Pruned ${removedLogs.length} old run log director${removedLogs.length === 1 ? "y" : "ies"}.`,
  );

  // Compose-built e2e images from instance-specific projects (e.g.
  // monitorss-e2e-1-*) are not referenced by anything after teardown.
  const e2eImageIds = [
    ...new Set(
      dockerOutput([
        "images",
        "--filter",
        "reference=monitorss-e2e*",
        "--format",
        "{{.ID}}",
      ])
        .split(/\r?\n/)
        .filter(Boolean),
    ),
  ];
  if (e2eImageIds.length > 0) {
    docker(["image", "rm", ...e2eImageIds], true);
  }

  docker(["image", "prune", "-f"]);
  // Keep a small warm cache for the next build; the runner enforces the same
  // bound after every run.
  docker(["builder", "prune", "-f", "--keep-storage", "5GB"]);
  // Dangling anonymous volumes: repeated dev-stack container recreations leave
  // one node_modules volume per service behind. Volumes referenced by any
  // container (running or stopped) are not touched.
  docker(["volume", "prune", "-f"]);

  console.log("\nDocker disk usage now:");
  docker(["system", "df"]);
  return 0;
}

process.exit(main());
