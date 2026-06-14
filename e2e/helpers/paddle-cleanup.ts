import { Page } from "@playwright/test";
import {
  cancelActiveSubscriptionsForEmail,
  createPaddleCustomer,
  simulateSubscriptionCreation,
} from "./paddle-api";

async function getUserEmail(page: Page): Promise<string> {
  const response = await page.request.get("/api/v1/users/@me");
  const data = await response.json();
  return data.result.email;
}

const POLL_INTERVAL_MS = 2000;
// Real Paddle webhook delivery over the cloudflared tunnel occasionally exceeds
// 60s end to end, so give CI generous headroom; the per-test timeout (120s+) caps it.
const POLL_TIMEOUT_MS = process.env.CI ? 90000 : 60000;

async function waitForFreeState(page: Page): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    const response = await page.request.get("/api/v1/users/@me");

    if (response.ok()) {
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

async function waitForPaidState(page: Page): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    const response = await page.request.get("/api/v1/users/@me");

    if (response.ok()) {
      const data = await response.json();
      const key = data.result?.subscription?.product?.key;

      if (key && key !== "free") {
        console.log(`User is on paid tier: ${key}`);
        return;
      }

      console.log("Waiting for paid tier...");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Timed out waiting for user to be on paid tier after ${POLL_TIMEOUT_MS}ms`,
  );
}

export async function ensurePaidSubscriptionState(
  page: Page,
  opts: { customerId?: string; priceId: string; email?: string },
): Promise<void> {
  const response = await page.request.get("/api/v1/users/@me");
  const data = await response.json();
  const key = data.result?.subscription?.product?.key;

  if (key && key !== "free") {
    console.log(`User already on paid tier: ${key}`);
    return;
  }

  let customerId = opts.customerId;

  if (!customerId && opts.email) {
    customerId = await createPaddleCustomer(opts.email);
    console.log(`Created Paddle customer: ${customerId} for ${opts.email}`);
  }

  if (!customerId) {
    throw new Error(
      "ensurePaidSubscriptionState requires either customerId or email",
    );
  }

  // Traffic source is set to "all" once in paddle.setup.ts and left there;
  // toggling it per-test races other parallel tests' webhook delivery.
  await simulateSubscriptionCreation({ customerId, priceId: opts.priceId });
  await waitForPaidState(page);

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

export async function ensureFreeSubscriptionState(page: Page): Promise<void> {
  const email = await getUserEmail(page);
  const cancelledIds = await cancelActiveSubscriptionsForEmail(email);

  if (cancelledIds.length === 0) {
    return;
  }

  console.log(
    `Cancelled ${cancelledIds.length} active subscription(s) for ${email}`,
  );

  await waitForFreeState(page);

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
