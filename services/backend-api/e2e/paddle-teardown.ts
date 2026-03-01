import { readFileSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { stopTunnel } from "./helpers/tunnel";
import { cancelAllActiveSubscriptions } from "./helpers/paddle-api";
import { AUTH_STATE_PATH } from "./helpers/constants";

config({ path: join(process.cwd(), "..", "..", ".env.local") });
config({ path: join(process.cwd(), "..", "..", ".env") });

const BASE_URL = "http://localhost:3000";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000;

async function getUserSubscriptionKey(
  cookieHeader: string,
): Promise<string | null> {
  const response = await fetch(`${BASE_URL}/api/v1/users/@me`, {
    headers: { Cookie: cookieHeader },
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.result?.subscription?.product?.key || null;
}

async function waitForCancellationWebhook(cookieHeader: string): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    try {
      const key = await getUserSubscriptionKey(cookieHeader);

      if (!key || key === "free") {
        console.log("User back on Free tier - cleanup complete");
        return;
      }

      console.log(`Waiting for cancellation webhook... current tier: ${key}`);
    } catch {
      // API may be unavailable during teardown
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  console.warn("Warning: timed out waiting for Free tier during teardown");
}

async function paddleTeardown() {
  try {
    const authData = JSON.parse(readFileSync(AUTH_STATE_PATH, "utf-8"));
    const cookies = authData.cookies || [];
    const cookieHeader = cookies
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join("; ");

    const cancelledIds = await cancelAllActiveSubscriptions();

    if (cancelledIds.length > 0) {
      // Keep tunnel alive so Paddle can deliver the cancellation webhook
      await waitForCancellationWebhook(cookieHeader);
    }
  } catch (err) {
    console.warn("Teardown subscription cleanup failed:", err);
  }

  await stopTunnel();

  console.log("Paddle E2E teardown complete");
}

export default paddleTeardown;
