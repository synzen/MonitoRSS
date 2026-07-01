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
// Sandbox subscription webhooks routinely take well over 30s — sometimes past
// 90s — to land. The in-test current-plan waits already budget 120s for the
// same webhook, so give fixture setup at least that much to stop it flaking out
// before the test even starts. Callers set a beforeEach timeout above this.
const POLL_TIMEOUT_MS = process.env.CI ? 150000 : 120000;

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

// Tears down a workspace that holds a live sandbox subscription. Deletion is now
// gated on the subscription being cancelled first (a workspace with a blocking
// subscription returns 409), so cancel billing before deleting. The cancel
// schedules at the next billing period and sets a cancellationDate, which clears
// the delete guard; the cancel handler polls until that lands before returning.
export async function cancelAndDeleteWorkspace(
  page: Page,
  workspaceSlug: string,
): Promise<void> {
  // The backend's cancel handler blocks on the Paddle API call AND then polls
  // the local record until the webhook writes cancellationDate (~1s x up to 50
  // tries). Against the sandbox this routinely runs past Playwright's default
  // 15s actionTimeout, so the request must be given the same webhook-scale
  // budget the setup helpers use, or teardown flakes out on an otherwise green
  // test. Same reasoning applies to the delete, which runs the guard re-check.
  const cancelRes = await page.request.post(
    `/api/v1/workspaces/${workspaceSlug}/billing/cancel`,
    { timeout: POLL_TIMEOUT_MS },
  );

  // 204 = cancelled; 409/404 = nothing to cancel (never subscribed). Either way
  // the subscription is no longer blocking, so proceed to delete.
  if (![204, 404, 409].includes(cancelRes.status())) {
    throw new Error(
      `Unexpected status cancelling workspace billing: ${cancelRes.status()}`,
    );
  }

  const deleteRes = await page.request.delete(`/api/v1/workspaces/${workspaceSlug}`, {
    timeout: POLL_TIMEOUT_MS,
  });

  if (deleteRes.status() !== 204) {
    throw new Error(
      `Failed to delete workspace ${workspaceSlug}: ${deleteRes.status()}`,
    );
  }
}
