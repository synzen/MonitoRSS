import { readFileSync } from "fs";
import { Page } from "@playwright/test";
import { AUTH_STATE_PATH } from "./constants";
import {
  cancelAllActiveSubscriptions,
  listActiveSubscriptions,
} from "./paddle-api";

const BASE_URL = "http://localhost:3000";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

function getCookieHeader(): string {
  const authData = JSON.parse(readFileSync(AUTH_STATE_PATH, "utf-8"));
  const cookies = authData.cookies || [];
  return cookies
    .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
    .join("; ");
}

async function waitForFreeState(cookieHeader: string): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    const response = await fetch(`${BASE_URL}/api/v1/discord-users/@me`, {
      headers: { Cookie: cookieHeader },
    });

    if (response.ok) {
      const data = await response.json();
      const subscription = data.result?.subscription;

      if (!subscription || subscription.product?.key === "free") {
        return;
      }

      console.log(
        `Waiting for Free tier... current: ${subscription.product?.key}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Timed out waiting for user to be on Free tier after ${POLL_TIMEOUT_MS}ms`,
  );
}

export async function ensureFreeSubscriptionState(page: Page): Promise<void> {
  const activeSubscriptions = await listActiveSubscriptions();

  if (activeSubscriptions.length === 0) {
    return;
  }

  console.log(
    `Found ${activeSubscriptions.length} active subscription(s), cancelling...`,
  );

  await cancelAllActiveSubscriptions();

  const cookieHeader = getCookieHeader();
  await waitForFreeState(cookieHeader);

  // Force the browser to drop any cached React Query state from previous tests
  // by navigating to about:blank, clearing sessionStorage/localStorage, then
  // letting the test navigate fresh.
  await page.goto("about:blank");
  await page.evaluate(() => {
    try {
      sessionStorage.clear();
      localStorage.clear();
    } catch {
      // may not be available on about:blank in some browsers
    }
  });
}
