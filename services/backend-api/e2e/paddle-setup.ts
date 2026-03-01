import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { MongoClient } from "mongodb";
import { AUTH_STATE_PATH } from "./helpers/constants";
import { startTunnel } from "./helpers/tunnel";
import {
  updateNotificationUrl,
  cancelAllActiveSubscriptions,
  listActiveSubscriptions,
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

async function getSubscriptionState(
  cookieHeader: string,
): Promise<{ key: string } | null> {
  const response = await fetch(`${BASE_URL}/api/v1/users/@me`, {
    headers: { Cookie: cookieHeader },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const subscription = data.result?.subscription;

  if (!subscription || subscription.product?.key === "free") {
    return null;
  }

  return subscription.product;
}

async function waitForFreeState(cookieHeader: string): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    const product = await getSubscriptionState(cookieHeader);

    if (!product) {
      console.log("User is on Free tier - ready for test");
      return;
    }

    console.log(`Waiting for Free tier... current: ${product.key}`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Timed out waiting for user to be on Free tier after ${POLL_TIMEOUT_MS}ms`,
  );
}

async function getDiscordUserId(cookieHeader: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/v1/discord-users/@me`, {
    headers: { Cookie: cookieHeader },
  });

  const data = await response.json();
  return data.id;
}

async function clearStaleSubscriptionFromDb(
  discordUserId: string,
): Promise<boolean> {
  const client = new MongoClient("mongodb://127.0.0.1:27018/rss", {
    directConnection: true,
  });

  try {
    await client.connect();
    const db = client.db();
    const result = await db
      .collection("supporters")
      .updateOne(
        { _id: discordUserId, "paddleCustomer.subscription": { $ne: null } },
        { $set: { "paddleCustomer.subscription": null } },
      );

    if (result.modifiedCount > 0) {
      console.log(
        `Cleared stale subscription from DB for discord user ${discordUserId}`,
      );
      return true;
    }

    return false;
  } finally {
    await client.close();
  }
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

  try {
    await waitForFreeState(cookieHeader);
  } catch {
    const activeSubs = await listActiveSubscriptions();

    if (activeSubs.length === 0) {
      console.log(
        "No active subscriptions in Paddle but backend still has one. Clearing stale DB state...",
      );
      const discordUserId = await getDiscordUserId(cookieHeader);
      await clearStaleSubscriptionFromDb(discordUserId);
      await waitForFreeState(cookieHeader);
    } else {
      throw new Error(
        `Active Paddle subscriptions still exist: ${activeSubs.map((s) => s.id).join(", ")}`,
      );
    }
  }

  writeFileSync(
    PADDLE_STATE_PATH,
    JSON.stringify({ tunnelUrl, cancelledIds }, null, 2),
  );

  console.log("Paddle E2E setup complete");
}

export default paddleSetup;
