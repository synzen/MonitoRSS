import { createHmac } from "node:crypto";
import { generateTestId } from "./test-id";
import { createTestHttpServer, type TestHttpServer } from "./test-http-server";
import type { MockApi } from "./mock-apis";
import {
  SubscriptionProductKey,
  SubscriptionStatus,
} from "../../src/repositories/shared/enums";
import type { IPaddleCustomer } from "../../src/repositories/interfaces/supporter.types";

// Shared Paddle fixtures for app-context tests (the paddle-webhooks harness
// boots its own service-level context and cannot be reused here).

export const TEST_PADDLE_WEBHOOK_SECRET = "test-paddle-webhook-secret";

export function createWebhookSignature(
  requestBody: string,
  secret: string = TEST_PADDLE_WEBHOOK_SECRET,
): string {
  const ts = String(Math.floor(Date.now() / 1000));
  const signedPayload = `${ts}:${requestBody}`;
  const hmac = createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `ts=${ts};h1=${hmac}`;
}

export function createSubscriptionEvent(
  eventType: "subscription.activated" | "subscription.updated",
  overrides: Record<string, unknown> = {},
) {
  const now = new Date().toISOString();
  return {
    event_type: eventType,
    data: {
      id: generateTestId(),
      status: "active",
      customer_id: generateTestId(),
      created_at: now,
      custom_data: {},
      updated_at: now,
      items: [
        {
          quantity: 1,
          price: {
            id: generateTestId(),
            product_id: generateTestId(),
          },
        },
      ],
      billing_cycle: {
        interval: "month",
        frequency: 1,
      },
      currency_code: "USD",
      next_billed_at: now,
      scheduled_change: null,
      current_billing_period: {
        ends_at: now,
        starts_at: now,
      },
      ...overrides,
    },
  };
}

export function createMockPaddleApi(): MockApi & { server: TestHttpServer } {
  const server = createTestHttpServer();

  return {
    server,
    configKey: "BACKEND_API_PADDLE_URL",
    intercept() {
      return generateTestId();
    },
    async stop() {
      await server.stop();
    },
  };
}

export function buildPaddleCustomer(overrides: {
  subscriptionId: string;
  customerId?: string;
  productKey?: SubscriptionProductKey;
  cancellationDate?: Date | null;
  updatedAt?: Date;
}): IPaddleCustomer {
  return {
    customerId: overrides.customerId ?? generateTestId(),
    email: "owner-billing@example.com",
    lastCurrencyCodeUsed: "USD",
    subscription: {
      id: overrides.subscriptionId,
      productKey: overrides.productKey ?? SubscriptionProductKey.Tier2,
      status: SubscriptionStatus.Active,
      currencyCode: "USD",
      billingPeriodStart: new Date(),
      billingPeriodEnd: new Date(),
      billingInterval: "month",
      benefits: {
        maxUserFeeds: 70,
        allowWebhooks: true,
        dailyArticleLimit: 1000,
        refreshRateSeconds: 120,
      },
      cancellationDate: overrides.cancellationDate ?? null,
      createdAt: new Date(),
      updatedAt: overrides.updatedAt ?? new Date(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Price-id → product mapping the additional-feed tier gate resolves against
// when processing subscription update/preview requests.
export function registerDefaultPaddleProductsRoute(
  server: TestHttpServer,
): void {
  server.registerRoute("GET", "/products", {
    status: 200,
    body: {
      data: [
        {
          id: generateTestId(),
          name: "Tier 1",
          custom_data: { key: SubscriptionProductKey.Tier1 },
          prices: [{ id: "price_new_tier", status: "active" }],
        },
        {
          id: generateTestId(),
          name: "Tier 3",
          custom_data: { key: SubscriptionProductKey.Tier3 },
          prices: [
            { id: "price_tier3", status: "active" },
            { id: "price_downgrade", status: "active" },
            { id: "price_change", status: "active" },
          ],
        },
        {
          id: generateTestId(),
          name: "Additional Feed",
          custom_data: { key: SubscriptionProductKey.Tier3AdditionalFeed },
          prices: [{ id: "price_additional_feed", status: "active" }],
        },
      ],
    },
  });
}
