import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateTestId } from "../../helpers/test-id";
import type { TestHttpServer } from "../../helpers/test-http-server";
import type { MockApi } from "../../helpers/mock-apis";
import {
  createMockPaddleApi,
  buildPaddleCustomer,
} from "../../helpers/paddle-fixtures";
import { SubscriptionProductKey } from "../../../src/repositories/shared/enums";

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function seedWorkspaceUser(
  ctx: AppTestContext,
  discordUserId: string,
): Promise<string> {
  await ctx.container.userRepository.create({
    discordUserId,
    email: `${discordUserId}@example.com`,
  });

  await ctx.connection.collection("users").updateOne(
    { discordUserId },
    {
      $set: {
        "featureFlags.workspaces": true,
        verifiedEmail: `verified-${discordUserId}@example.com`,
        verifiedEmailVerifiedAt: new Date(),
      },
    },
  );

  const id =
    await ctx.container.userRepository.findIdByDiscordId(discordUserId);
  return id as string;
}

describe("Workspace billing API", { concurrency: true }, () => {
  let ctx: AppTestContext;
  let paddleApi: MockApi & { server: TestHttpServer };

  before(async () => {
    paddleApi = createMockPaddleApi();
    ctx = await createAppTestContext({
      configOverrides: {
        BACKEND_API_PADDLE_URL: paddleApi.server.host,
        BACKEND_API_PADDLE_KEY: "test-paddle-key",
      },
      mockApis: {
        paddle: paddleApi,
      },
    });
  });

  after(async () => {
    await ctx.teardown();
    await paddleApi.stop();
  });

  before(() => {
    // One shared catalog for every concurrently-running test: tests pick the
    // price ids they need rather than re-registering the route (last write
    // would win across tests).
    paddleApi.server.registerRoute("GET", "/products", {
      status: 200,
      body: {
        data: [
          {
            id: "prod_tier1",
            name: "Tier 1",
            custom_data: { key: SubscriptionProductKey.Tier1 },
            prices: [
              {
                id: "price_tier1_month",
                status: "active",
                custom_data: null,
                billing_cycle: { interval: "month", frequency: 1 },
              },
            ],
          },
          {
            id: "prod_tier3",
            name: "Tier 3",
            custom_data: { key: SubscriptionProductKey.Tier3 },
            prices: [
              {
                id: "price_tier3_month",
                status: "active",
                custom_data: null,
                billing_cycle: { interval: "month", frequency: 1 },
              },
            ],
          },
          {
            id: "prod_t3feed",
            name: "Additional Feed",
            custom_data: { key: SubscriptionProductKey.Tier3AdditionalFeed },
            prices: [
              {
                id: "price_t3feed_month",
                status: "active",
                custom_data: null,
                billing_cycle: { interval: "month", frequency: 1 },
              },
            ],
          },
        ],
      },
    });
  });

  async function createWorkspaceAsUser(discordUserId: string) {
    const user = await ctx.asUser(discordUserId);
    const slug = `ws-${randomUUID().slice(0, 18)}`;
    const res = await user.fetch("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "Billing Workspace", slug }),
    });
    assert.strictEqual(res.status, 201);
    const created = await readJson<{ result: { id: string } }>(res);
    return { user, workspaceId: created.result.id, slug };
  }

  async function addMembership(
    workspaceId: string,
    userId: string,
    role: string,
  ) {
    await ctx.connection.collection("workspacememberships").insertOne({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  it("lets the owner cancel: scheduled for period end and readable as cancelling", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, workspaceId, slug } =
      await createWorkspaceAsUser(discordUserId);

    const subscriptionId = generateTestId();
    await ctx.container.workspaceRepository.upsertPaddleCustomer(
      workspaceId,
      buildPaddleCustomer({ subscriptionId }),
    );

    const billingPeriodEnd = new Date("2027-03-31T23:59:59Z");

    paddleApi.server.registerRoute(
      "POST",
      `/subscriptions/${subscriptionId}/cancel`,
      () => {
        // Simulate the webhook landing after Paddle accepts the cancellation:
        // the scheduled change is reflected onto the workspace record, which
        // the endpoint polls before returning.
        setTimeout(() => {
          void ctx.container.workspaceRepository.upsertPaddleCustomer(
            workspaceId,
            buildPaddleCustomer({
              subscriptionId,
              cancellationDate: billingPeriodEnd,
            }),
          );
        }, 300);

        return {
          status: 200,
          body: { data: { id: subscriptionId, status: "active" } },
        };
      },
    );

    const res = await user.fetch(`/api/v1/workspaces/${slug}/billing/cancel`, {
      method: "POST",
    });
    assert.strictEqual(res.status, 204);

    const detail = await readJson<{
      result: {
        subscription: { status: string; cancellationDate: string | null };
      };
    }>(await user.fetch(`/api/v1/workspaces/${slug}`));

    assert.strictEqual(detail.result.subscription.status, "ACTIVE");
    assert.ok(
      detail.result.subscription.cancellationDate,
      "cancellation should be readable as a scheduled (cancelling) state",
    );
  });

  it("rejects every mutating billing endpoint for admins (403), non-members (404), and the unauthenticated (401)", async () => {
    const ownerDiscordId = randomUUID();
    await seedWorkspaceUser(ctx, ownerDiscordId);
    const { workspaceId, slug } = await createWorkspaceAsUser(ownerDiscordId);

    await ctx.container.workspaceRepository.upsertPaddleCustomer(
      workspaceId,
      buildPaddleCustomer({ subscriptionId: generateTestId() }),
    );

    const adminDiscordId = randomUUID();
    const adminUserId = await seedWorkspaceUser(ctx, adminDiscordId);
    await addMembership(workspaceId, adminUserId, "admin");
    const admin = await ctx.asUser(adminDiscordId);

    const outsiderDiscordId = randomUUID();
    await seedWorkspaceUser(ctx, outsiderDiscordId);
    const outsider = await ctx.asUser(outsiderDiscordId);

    const endpoints: Array<{ path: string; body?: unknown }> = [
      {
        path: `/api/v1/workspaces/${slug}/billing/update-preview`,
        body: { prices: [{ priceId: "price_x", quantity: 1 }] },
      },
      {
        path: `/api/v1/workspaces/${slug}/billing/update`,
        body: { prices: [{ priceId: "price_x", quantity: 1 }] },
      },
      { path: `/api/v1/workspaces/${slug}/billing/cancel` },
      { path: `/api/v1/workspaces/${slug}/billing/resume` },
    ];

    for (const endpoint of endpoints) {
      const init = {
        method: "POST",
        ...(endpoint.body
          ? {
              body: JSON.stringify(endpoint.body),
              headers: { "Content-Type": "application/json" },
            }
          : {}),
      };

      const adminRes = await admin.fetch(endpoint.path, init);
      assert.strictEqual(adminRes.status, 403, `admin on ${endpoint.path}`);
      assert.strictEqual(
        (await readJson<{ code: string }>(adminRes)).code,
        "WORKSPACE_INSUFFICIENT_ROLE",
      );

      const outsiderRes = await outsider.fetch(endpoint.path, init);
      assert.strictEqual(
        outsiderRes.status,
        404,
        `non-member on ${endpoint.path}`,
      );

      const anonRes = await ctx.fetch(endpoint.path, init);
      assert.strictEqual(
        anonRes.status,
        401,
        `unauthenticated on ${endpoint.path}`,
      );
    }
  });

  it("lets the owner change tier and add-on quantity via update", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, workspaceId, slug } =
      await createWorkspaceAsUser(discordUserId);

    const subscriptionId = generateTestId();
    const initialUpdatedAt = new Date(Date.now() - 60_000);
    await ctx.container.workspaceRepository.upsertPaddleCustomer(
      workspaceId,
      buildPaddleCustomer({ subscriptionId, updatedAt: initialUpdatedAt }),
    );

    paddleApi.server.registerRoute(
      "PATCH",
      `/subscriptions/${subscriptionId}`,
      () => {
        setTimeout(() => {
          void ctx.container.workspaceRepository.upsertPaddleCustomer(
            workspaceId,
            buildPaddleCustomer({
              subscriptionId,
              productKey: SubscriptionProductKey.Tier3,
              updatedAt: new Date(),
            }),
          );
        }, 300);

        return {
          status: 200,
          body: { data: { id: subscriptionId, status: "active" } },
        };
      },
    );

    const res = await user.fetch(`/api/v1/workspaces/${slug}/billing/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prices: [
          { priceId: "price_tier3_month", quantity: 1 },
          { priceId: "price_t3feed_month", quantity: 5 },
        ],
      }),
    });
    assert.strictEqual(res.status, 204);

    const detail = await readJson<{
      result: { subscription: { productKey: string } };
    }>(await user.fetch(`/api/v1/workspaces/${slug}`));
    assert.strictEqual(
      detail.result.subscription.productKey,
      SubscriptionProductKey.Tier3,
    );
  });

  it("rejects Tier 1 prices for workspace subscription changes", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, workspaceId, slug } =
      await createWorkspaceAsUser(discordUserId);

    await ctx.container.workspaceRepository.upsertPaddleCustomer(
      workspaceId,
      buildPaddleCustomer({ subscriptionId: generateTestId() }),
    );

    const res = await user.fetch(`/api/v1/workspaces/${slug}/billing/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prices: [{ priceId: "price_tier1_month", quantity: 1 }],
      }),
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(
      (await readJson<{ code: string }>(res)).code,
      "WORKSPACE_INVALID_TIER",
    );
  });

  it("rejects an add-on-only update that would drop the base plan from the subscription", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, workspaceId, slug } =
      await createWorkspaceAsUser(discordUserId);

    await ctx.container.workspaceRepository.upsertPaddleCustomer(
      workspaceId,
      buildPaddleCustomer({
        subscriptionId: generateTestId(),
        productKey: SubscriptionProductKey.Tier3,
      }),
    );

    // Paddle replaces the subscription's item set with whatever is sent, so
    // an items array holding only the additional-feed add-on would remove the
    // base Tier 2/3 plan entirely.
    const res = await user.fetch(`/api/v1/workspaces/${slug}/billing/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prices: [{ priceId: "price_t3feed_month", quantity: 5 }],
      }),
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(
      (await readJson<{ code: string }>(res)).code,
      "WORKSPACE_INVALID_TIER",
    );
  });

  it("returns a structured WORKSPACE_NOT_SUBSCRIBED error when mutating billing on a never-subscribed workspace", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, slug } = await createWorkspaceAsUser(discordUserId);

    // No subscription record is seeded: a dormant workspace's owner can still
    // reach these endpoints (e.g. a stale Billing page), so they must reject
    // cleanly rather than 500.
    const endpoints: Array<{ path: string; body?: unknown }> = [
      {
        path: `/api/v1/workspaces/${slug}/billing/update`,
        body: { prices: [{ priceId: "price_tier3_month", quantity: 1 }] },
      },
      { path: `/api/v1/workspaces/${slug}/billing/cancel` },
      { path: `/api/v1/workspaces/${slug}/billing/resume` },
    ];

    for (const endpoint of endpoints) {
      const res = await user.fetch(endpoint.path, {
        method: "POST",
        ...(endpoint.body
          ? {
              body: JSON.stringify(endpoint.body),
              headers: { "Content-Type": "application/json" },
            }
          : {}),
      });

      assert.strictEqual(res.status, 400, endpoint.path);
      assert.strictEqual(
        (await readJson<{ code: string }>(res)).code,
        "WORKSPACE_NOT_SUBSCRIBED",
        endpoint.path,
      );
    }
  });

  it("lets the owner resume a scheduled cancellation", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, workspaceId, slug } =
      await createWorkspaceAsUser(discordUserId);

    const subscriptionId = generateTestId();
    await ctx.container.workspaceRepository.upsertPaddleCustomer(
      workspaceId,
      buildPaddleCustomer({
        subscriptionId,
        cancellationDate: new Date("2027-03-31T23:59:59Z"),
      }),
    );

    paddleApi.server.registerRoute(
      "PATCH",
      `/subscriptions/${subscriptionId}`,
      () => {
        setTimeout(() => {
          void ctx.container.workspaceRepository.upsertPaddleCustomer(
            workspaceId,
            buildPaddleCustomer({ subscriptionId, cancellationDate: null }),
          );
        }, 300);

        return {
          status: 200,
          body: { data: { id: subscriptionId, status: "active" } },
        };
      },
    );

    const res = await user.fetch(`/api/v1/workspaces/${slug}/billing/resume`, {
      method: "POST",
    });
    assert.strictEqual(res.status, 204);

    const detail = await readJson<{
      result: { subscription: { cancellationDate: string | null } };
    }>(await user.fetch(`/api/v1/workspaces/${slug}`));
    assert.strictEqual(detail.result.subscription.cancellationDate, null);
  });

  it("returns a formatted preview of a subscription change", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, workspaceId, slug } =
      await createWorkspaceAsUser(discordUserId);

    const subscriptionId = generateTestId();
    await ctx.container.workspaceRepository.upsertPaddleCustomer(
      workspaceId,
      buildPaddleCustomer({ subscriptionId }),
    );

    paddleApi.server.registerRoute(
      "PATCH",
      `/subscriptions/${subscriptionId}/preview`,
      {
        status: 200,
        body: {
          data: {
            immediate_transaction: {
              billing_period: {
                starts_at: "2027-01-01T00:00:00Z",
                ends_at: "2027-01-31T23:59:59Z",
              },
              details: {
                totals: {
                  subtotal: "500",
                  tax: "50",
                  credit: "100",
                  total: "450",
                  grand_total: "450",
                },
              },
            },
          },
        },
      },
    );

    const res = await user.fetch(
      `/api/v1/workspaces/${slug}/billing/update-preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prices: [{ priceId: "price_tier3_month", quantity: 1 }],
        }),
      },
    );

    assert.strictEqual(res.status, 200);
    const body = await readJson<{
      data: {
        immediateTransaction: {
          billingPeriod: { startsAt: string };
          grandTotal: string;
          grandTotalFormatted: string;
        };
      };
    }>(res);
    assert.strictEqual(
      body.data.immediateTransaction.billingPeriod.startsAt,
      "2027-01-01T00:00:00Z",
    );
    assert.strictEqual(body.data.immediateTransaction.grandTotal, "450");
    assert.ok(body.data.immediateTransaction.grandTotalFormatted);
  });
});

describe(
  "Workspace billing API (Paddle not configured)",
  { concurrency: true },
  () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext();
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns a clear error on every billing endpoint", async () => {
      const discordUserId = randomUUID();
      await seedWorkspaceUser(ctx, discordUserId);
      const user = await ctx.asUser(discordUserId);

      const slug = `ws-${randomUUID().slice(0, 18)}`;
      const createRes = await user.fetch("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: "Self-host Workspace", slug }),
      });
      assert.strictEqual(createRes.status, 201);

      const endpoints: Array<{ path: string; body?: unknown }> = [
        {
          path: `/api/v1/workspaces/${slug}/billing/update-preview`,
          body: { prices: [{ priceId: "price_x", quantity: 1 }] },
        },
        {
          path: `/api/v1/workspaces/${slug}/billing/update`,
          body: { prices: [{ priceId: "price_x", quantity: 1 }] },
        },
        { path: `/api/v1/workspaces/${slug}/billing/cancel` },
        { path: `/api/v1/workspaces/${slug}/billing/resume` },
      ];

      for (const endpoint of endpoints) {
        const res = await user.fetch(endpoint.path, {
          method: "POST",
          ...(endpoint.body
            ? {
                body: JSON.stringify(endpoint.body),
                headers: { "Content-Type": "application/json" },
              }
            : {}),
        });

        assert.strictEqual(res.status, 400, endpoint.path);
        assert.strictEqual(
          (await readJson<{ code: string }>(res)).code,
          "WORKSPACE_BILLING_NOT_CONFIGURED",
          endpoint.path,
        );
      }
    });
  },
);
