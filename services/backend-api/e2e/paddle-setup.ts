import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { AUTH_STATE_PATH } from "./helpers/constants";
import { startTunnel } from "./helpers/tunnel";
import {
  updateNotificationUrl,
  cancelAllActiveSubscriptions,
} from "./helpers/paddle-api";

config({ path: join(process.cwd(), "..", "..", ".env.local") });
config({ path: join(process.cwd(), "..", "..", ".env") });

const BASE_URL = "http://localhost:3000";
const BACKEND_PORT = 8000;
const WEBHOOK_PATH = "/api/v1/subscription-products/paddle-webhook";
const PADDLE_STATE_PATH = join(process.cwd(), "e2e", ".paddle-state.json");
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

async function validateAuth(): Promise<string> {
  if (!existsSync(AUTH_STATE_PATH)) {
    console.error("\nERROR: auth.json not found! Run: npm run e2e:auth\n");
    process.exit(1);
  }

  const authData = JSON.parse(readFileSync(AUTH_STATE_PATH, "utf-8"));
  const cookies = authData.cookies || [];
  const cookieHeader = cookies
    .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
    .join("; ");

  const response = await fetch(
    `${BASE_URL}/api/v1/discord-users/@me/auth-status`,
    {
      headers: { Cookie: cookieHeader },
    },
  );

  if (!response.ok) {
    console.error(
      "\nERROR: Auth status check failed. Is the Docker stack running?\n",
    );
    process.exit(1);
  }

  const data = await response.json();
  if (!data.authenticated) {
    console.error("\nERROR: Session expired! Run: npm run e2e:auth\n");
    process.exit(1);
  }

  console.log("Auth session valid");
  return cookieHeader;
}

async function waitForFreeState(cookieHeader: string): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/discord-users/@me`, {
        headers: { Cookie: cookieHeader },
      });

      if (response.ok) {
        const data = await response.json();
        const subscription = data.result?.subscription;

        if (!subscription || subscription.product?.key === "free") {
          console.log("User is on Free tier - ready for test");
          return;
        }

        console.log(
          `Waiting for Free tier... current: ${subscription.product?.key}`,
        );
      }
    } catch {
      console.log("Waiting for API...");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Timed out waiting for user to be on Free tier after ${POLL_TIMEOUT_MS}ms`,
  );
}

async function paddleSetup() {
  const cookieHeader = await validateAuth();
  const tunnelUrl = await startTunnel(BACKEND_PORT);
  await updateNotificationUrl(`${tunnelUrl}${WEBHOOK_PATH}`);
  const cancelledIds = await cancelAllActiveSubscriptions();

  if (cancelledIds.length > 0) {
    console.log(
      `Cancelled ${cancelledIds.length} subscription(s), waiting for webhook processing...`,
    );
  }

  await waitForFreeState(cookieHeader);

  writeFileSync(
    PADDLE_STATE_PATH,
    JSON.stringify({ tunnelUrl, cancelledIds }, null, 2),
  );

  console.log("Paddle E2E setup complete");
}

export default paddleSetup;
