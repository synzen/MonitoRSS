import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateTestId } from "../../helpers/test-id";
import type { TestHttpServer } from "../../helpers/test-http-server";
import type { MockApi } from "../../helpers/mock-apis";
import {
  TEST_PADDLE_WEBHOOK_SECRET,
  createWebhookSignature,
  createMockPaddleApi,
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

describe(
  "Workspace creation cap (billing enabled)",
  { concurrency: true },
  () => {
    let ctx: AppTestContext;
    let paddleApi: MockApi & { server: TestHttpServer };

    before(async () => {
      paddleApi = createMockPaddleApi();
      ctx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_PADDLE_WEBHOOK_SECRET: TEST_PADDLE_WEBHOOK_SECRET,
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

    async function createWorkspace(
      user: Awaited<ReturnType<AppTestContext["asUser"]>>,
      name = "Workspace",
    ): Promise<Response> {
      return user.fetch("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug: `ws-${randomUUID().slice(0, 18)}`,
        }),
      });
    }

    async function activateWorkspaceSubscription(
      workspaceId: string,
      subscriptionId = generateTestId(),
    ) {
      const productId = generateTestId();
      const customerId = generateTestId();

      paddleApi.server.registerRoute("GET", `/products/${productId}`, {
        status: 200,
        body: {
          data: {
            id: productId,
            custom_data: { key: SubscriptionProductKey.Tier2 },
          },
        },
      });
      paddleApi.server.registerRoute("GET", `/customers/${customerId}`, {
        status: 200,
        body: { data: { email: "owner-billing@example.com" } },
      });

      const now = new Date().toISOString();
      const event = {
        event_type: "subscription.activated",
        data: {
          id: subscriptionId,
          status: "active",
          customer_id: customerId,
          created_at: now,
          custom_data: { workspaceId },
          updated_at: now,
          items: [
            {
              quantity: 1,
              price: { id: generateTestId(), product_id: productId },
            },
          ],
          billing_cycle: { interval: "month", frequency: 1 },
          currency_code: "USD",
          next_billed_at: now,
          scheduled_change: null,
          current_billing_period: { ends_at: now, starts_at: now },
        },
      };

      const body = JSON.stringify(event);
      const res = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": createWebhookSignature(body),
          },
          body,
        },
      );
      assert.strictEqual(res.status, 200);
    }

    it("rejects a second workspace while the user owns a never-activated one", async () => {
      const discordUserId = randomUUID();
      await seedWorkspaceUser(ctx, discordUserId);
      const user = await ctx.asUser(discordUserId);

      const firstRes = await createWorkspace(user, "First");
      assert.strictEqual(firstRes.status, 201);

      const secondRes = await createWorkspace(user, "Second");
      assert.strictEqual(secondRes.status, 409);
      const body = await readJson<{ code: string }>(secondRes);
      assert.strictEqual(body.code, "WORKSPACE_NEVER_ACTIVATED_EXISTS");
    });

    it("allows another workspace after the first is activated — including after its subscription lapses", async () => {
      const discordUserId = randomUUID();
      await seedWorkspaceUser(ctx, discordUserId);
      const user = await ctx.asUser(discordUserId);

      const firstRes = await createWorkspace(user, "First");
      assert.strictEqual(firstRes.status, 201);
      const first = await readJson<{ result: { id: string } }>(firstRes);

      const subscriptionId = generateTestId();
      await activateWorkspaceSubscription(first.result.id, subscriptionId);

      const secondRes = await createWorkspace(user, "Second");
      assert.strictEqual(secondRes.status, 201);
      const second = await readJson<{ result: { id: string } }>(secondRes);

      // Activate the second and then lapse the FIRST: the lapsed-but-previously-
      // active first workspace must not re-enter the cap.
      await activateWorkspaceSubscription(second.result.id);

      const cancelBody = JSON.stringify({
        event_type: "subscription.canceled",
        data: {
          id: subscriptionId,
          status: "canceled",
          customer_id: generateTestId(),
        },
      });
      const cancelRes = await ctx.fetch(
        "/api/v1/subscription-products/paddle-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": createWebhookSignature(cancelBody),
          },
          body: cancelBody,
        },
      );
      assert.strictEqual(cancelRes.status, 200);

      const thirdRes = await createWorkspace(user, "Third");
      assert.strictEqual(thirdRes.status, 201);
    });

    it("frees the user when the never-activated workspace is deleted", async () => {
      const discordUserId = randomUUID();
      await seedWorkspaceUser(ctx, discordUserId);
      const user = await ctx.asUser(discordUserId);

      const firstRes = await createWorkspace(user, "First");
      assert.strictEqual(firstRes.status, 201);
      const first = await readJson<{ result: { id: string } }>(firstRes);

      // Deletion UX ships separately; remove the workspace and its membership
      // directly to verify the cap derives from live ownership state.
      const { Types } = await import("mongoose");
      const workspaceObjectId = new Types.ObjectId(first.result.id);
      await ctx.connection
        .collection("workspaces")
        .deleteOne({ _id: workspaceObjectId });
      await ctx.connection
        .collection("workspacememberships")
        .deleteMany({ workspaceId: workspaceObjectId });

      const secondRes = await createWorkspace(user, "Second");
      assert.strictEqual(secondRes.status, 201);
    });

    it("does not count never-activated workspaces the user is only an admin of", async () => {
      const ownerDiscordId = randomUUID();
      await seedWorkspaceUser(ctx, ownerDiscordId);
      const owner = await ctx.asUser(ownerDiscordId);

      const otherRes = await createWorkspace(owner, "Someone Elses");
      assert.strictEqual(otherRes.status, 201);
      const other = await readJson<{ result: { id: string } }>(otherRes);

      const adminDiscordId = randomUUID();
      const adminUserId = await seedWorkspaceUser(ctx, adminDiscordId);
      const { Types } = await import("mongoose");
      await ctx.connection.collection("workspacememberships").insertOne({
        workspaceId: new Types.ObjectId(other.result.id),
        userId: new Types.ObjectId(adminUserId),
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const admin = await ctx.asUser(adminDiscordId);
      const res = await createWorkspace(admin, "My Own");
      assert.strictEqual(res.status, 201);
    });
  },
);

describe(
  "Workspace creation cap (billing not configured)",
  { concurrency: true },
  () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext();
    });

    after(async () => {
      await ctx.teardown();
    });

    it("imposes no cap: a user can create multiple never-activated workspaces", async () => {
      const discordUserId = randomUUID();
      await seedWorkspaceUser(ctx, discordUserId);
      const user = await ctx.asUser(discordUserId);

      for (let i = 0; i < 2; i++) {
        const res = await user.fetch("/api/v1/workspaces", {
          method: "POST",
          body: JSON.stringify({
            name: `Workspace ${i}`,
            slug: `ws-${randomUUID().slice(0, 18)}`,
          }),
        });
        assert.strictEqual(res.status, 201);
      }
    });
  },
);
