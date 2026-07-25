import { mkdirSync, rmdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { instanceSuffix } from "./instance";

// Playwright runs each worker in its OWN PROCESS, so an in-process mutex cannot
// serialize anything across them. Directory creation is atomic on every platform
// we run on (POSIX and Windows), and unlike a lock FILE it cannot be left in a
// "created but empty" state, so mkdir doubles as test-and-set.
const lockPath = (name: string) =>
  join(tmpdir(), `monitorss-e2e-${name}${instanceSuffix}.lock`);

const STALE_LOCK_MS = 120_000;
const RETRY_INTERVAL_MS = 250;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// Runs fn while holding a lock shared by every worker in this run. Used for
// operations that contend on a single global Paddle resource, where running two
// at once makes both unreliable.
//
// The lock is advisory and self-healing: a worker killed mid-section would
// otherwise wedge the whole run, so a lock held past STALE_LOCK_MS is forcibly
// reclaimed. That bound is well above how long a guarded section takes and below
// the per-test timeouts that would fail the run anyway.
export async function withCrossWorkerLock<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const path = lockPath(name);
  const startedWaitingAt = Date.now();

  for (;;) {
    try {
      mkdirSync(path);
      break;
    } catch {
      // Held by another worker. Reclaim it if the holder appears to have died,
      // otherwise wait and retry.
      if (Date.now() - startedWaitingAt > STALE_LOCK_MS) {
        try {
          rmdirSync(path);
        } catch {
          // Another worker reclaimed or released it first; retry normally.
        }
      }

      await sleep(RETRY_INTERVAL_MS);
    }
  }

  try {
    return await fn();
  } finally {
    try {
      rmdirSync(path);
    } catch {
      // Already reclaimed as stale by another worker; nothing to release.
    }
  }
}
