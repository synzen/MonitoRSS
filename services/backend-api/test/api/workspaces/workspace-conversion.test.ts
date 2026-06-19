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
  TEST_PADDLE_WEBHOOK_SECRET,
  createWebhookSignature,
  createSubscriptionEvent,
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

describe("Workspace conversion (personal → workspace)", { concurrency: true }, () => {
  let ctx: AppTestContext;
  let paddleApi: MockApi & { server: TestHttpServer };

  before(async () => {
    paddleApi = createMockPaddleApi();
    ctx = await createAppTestContext({
      configOverrides: {
        BACKEND_API_PADDLE_WEBHOOK_SECRET: TEST_PADDLE_WEBHOOK_SECRET,
        BACKEND_API_ENABLE_SUPPORTERS: true,
        BACKEND_API_PADDLE_URL: paddleApi.server.host,
        BACKEND_API_PADDLE_KEY: "test-paddle-key",
      },
      mockApis: { paddle: paddleApi },
    });
  });

  after(async () => {
    await ctx.teardown();
    await paddleApi.stop();
  });

  function registerPaddleProduct(productId: string, key: string) {
    paddleApi.server.registerRoute("GET", `/products/${productId}`, {
      status: 200,
      body: { data: { id: productId, custom_data: { key } } },
    });
  }

  function registerPaddleCustomer(customerId: string, email: string) {
    paddleApi.server.registerRoute("GET", `/customers/${customerId}`, {
      status: 200,
      body: { data: { email } },
    });
  }

  async function postWebhook(event: unknown): Promise<Response> {
    const body = JSON.stringify(event);
    return ctx.fetch("/api/v1/subscription-products/paddle-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Paddle-Signature": createWebhookSignature(body),
      },
      body,
    });
  }

  async function createWorkspaceAsUser(discordUserId: string) {
    const user = await ctx.asUser(discordUserId);
    const slug = `ws-${randomUUID().slice(0, 18)}`;
    const res = await user.fetch("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "Conversion Workspace", slug }),
    });
    assert.strictEqual(res.status, 201);
    const created = await readJson<{ result: { id: string } }>(res);
    return { user, workspaceId: created.result.id, slug };
  }

  it("converts a personal Tier 2 plan and all its feeds into the owner's workspace", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, workspaceId, slug } =
      await createWorkspaceAsUser(discordUserId);

    // The owner's personal Tier 2 subscription, recorded on their supporter
    // record exactly as the webhook would have written it.
    const subscriptionId = generateTestId();
    const customerId = generateTestId();
    await ctx.container.supporterRepository.upsertPaddleCustomer(
      discordUserId,
      buildPaddleCustomer({
        subscriptionId,
        customerId,
        productKey: SubscriptionProductKey.Tier2,
      }),
    );

    // Two personal feeds the owner wants to bring along.
    const feedA = await ctx.container.userFeedRepository.create({
      title: "Feed A",
      url: "https://example.com/a.xml",
      user: { id: generateTestId(), discordUserId },
    });
    const feedB = await ctx.container.userFeedRepository.create({
      title: "Feed B",
      url: "https://example.com/b.xml",
      user: { id: generateTestId(), discordUserId },
    });

    // The product/customer lookups the re-emitted webhook will perform.
    const productId = generateTestId();
    registerPaddleProduct(productId, SubscriptionProductKey.Tier2);
    registerPaddleCustomer(customerId, `${discordUserId}@example.com`);

    // Patching custom_data on the live subscription causes Paddle to re-emit
    // subscription.updated; simulate that by posting the real webhook (now
    // carrying the workspace id), which re-homes the subscription record.
    paddleApi.server.registerRoute(
      "PATCH",
      `/subscriptions/${subscriptionId}`,
      () => {
        setTimeout(() => {
          void postWebhook(
            createSubscriptionEvent("subscription.updated", {
              id: subscriptionId,
              customer_id: customerId,
              custom_data: { workspaceId },
              items: [
                {
                  quantity: 1,
                  price: { id: generateTestId(), product_id: productId },
                },
              ],
            }),
          );
        }, 300);

        return {
          status: 200,
          body: { data: { id: subscriptionId, status: "active" } },
        };
      },
    );

    const res = await user.fetch(
      `/api/v1/workspaces/${slug}/billing/convert`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedIds: [feedA.id, feedB.id] }),
      },
    );
    assert.strictEqual(res.status, 204);

    // The workspace now holds the subscription, observable via its read API.
    const detail = await readJson<{
      result: { subscription: { productKey: string } | null };
    }>(await user.fetch(`/api/v1/workspaces/${slug}`));
    assert.ok(detail.result.subscription, "workspace should hold the subscription");
    assert.strictEqual(
      detail.result.subscription.productKey,
      SubscriptionProductKey.Tier2,
    );

    // Both feeds are now the workspace's and remain active (not disabled by
    // the guard-protected enforcement during the move).
    const movedA = await ctx.container.userFeedRepository.findById(feedA.id);
    const movedB = await ctx.container.userFeedRepository.findById(feedB.id);
    assert.strictEqual(movedA?.workspaceId, workspaceId);
    assert.strictEqual(movedB?.workspaceId, workspaceId);
    assert.strictEqual(movedA?.disabledCode, undefined);
    assert.strictEqual(movedB?.disabledCode, undefined);

    // The personal supporter record no longer carries the subscription: one
    // subscription, one owner.
    const supporter =
      await ctx.container.supporterRepository.findById(discordUserId);
    assert.strictEqual(
      supporter?.paddleCustomer?.subscription ?? null,
      null,
      "personal supporter record must no longer hold the converted subscription",
    );
  });

  it("reconciles the lookup key of a moved Reddit feed so it is not orphaned between delivery loops", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, workspaceId, slug } =
      await createWorkspaceAsUser(discordUserId);

    const subscriptionId = generateTestId();
    const customerId = generateTestId();
    await ctx.container.supporterRepository.upsertPaddleCustomer(
      discordUserId,
      buildPaddleCustomer({
        subscriptionId,
        customerId,
        productKey: SubscriptionProductKey.Tier2,
      }),
    );

    // A personal Reddit feed that was credentialed under the owner's personal
    // Reddit connection, so it carries a lookup key (routing it into the
    // credentialed delivery loop). The target workspace has no Reddit
    // connection.
    const redditFeed = await ctx.container.userFeedRepository.create({
      title: "Reddit feed",
      url: "https://www.reddit.com/r/test.rss",
      user: { id: generateTestId(), discordUserId },
      feedRequestLookupKey: randomUUID(),
    });

    const productId = generateTestId();
    registerPaddleProduct(productId, SubscriptionProductKey.Tier2);
    registerPaddleCustomer(customerId, `${discordUserId}@example.com`);

    paddleApi.server.registerRoute(
      "PATCH",
      `/subscriptions/${subscriptionId}`,
      () => {
        setTimeout(() => {
          void postWebhook(
            createSubscriptionEvent("subscription.updated", {
              id: subscriptionId,
              customer_id: customerId,
              custom_data: { workspaceId },
              items: [
                {
                  quantity: 1,
                  price: { id: generateTestId(), product_id: productId },
                },
              ],
            }),
          );
        }, 300);

        return {
          status: 200,
          body: { data: { id: subscriptionId, status: "active" } },
        };
      },
    );

    const res = await user.fetch(
      `/api/v1/workspaces/${slug}/billing/convert`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedIds: [redditFeed.id] }),
      },
    );
    assert.strictEqual(res.status, 204);

    // The feed moved into a workspace with no Reddit credential, so its stale
    // lookup key must be cleared. Otherwise it is excluded from the plain-URL
    // loop (key exists) and dropped by the credentialed loop (no workspace
    // credential resolves), and the feed silently stops being fetched.
    const moved = await ctx.container.userFeedRepository.findById(redditFeed.id);
    assert.strictEqual(moved?.workspaceId, workspaceId);
    assert.strictEqual(
      moved?.feedRequestLookupKey ?? null,
      null,
      "moved Reddit feed must have its lookup key reconciled (cleared) on conversion",
    );
  });

  it("rolls back to personal and leaves the plan untouched when the Paddle patch fails", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, workspaceId, slug } =
      await createWorkspaceAsUser(discordUserId);

    const subscriptionId = generateTestId();
    const customerId = generateTestId();
    await ctx.container.supporterRepository.upsertPaddleCustomer(
      discordUserId,
      buildPaddleCustomer({
        subscriptionId,
        customerId,
        productKey: SubscriptionProductKey.Tier2,
      }),
    );

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed to roll back",
      url: "https://example.com/rollback.xml",
      user: { id: generateTestId(), discordUserId },
    });

    // Paddle rejects the custom_data patch: no re-emitted webhook, the personal
    // subscription was never actually mutated on Paddle's side.
    paddleApi.server.registerRoute(
      "PATCH",
      `/subscriptions/${subscriptionId}`,
      { status: 500, body: { error: { code: "internal_error" } } },
    );

    const res = await user.fetch(
      `/api/v1/workspaces/${slug}/billing/convert`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedIds: [feed.id] }),
      },
    );
    assert.notStrictEqual(res.status, 204);

    // The feed is back to personal (workspaceId unset) and still active.
    const rolledBack = await ctx.container.userFeedRepository.findById(feed.id);
    assert.strictEqual(rolledBack?.workspaceId, undefined);
    assert.strictEqual(rolledBack?.disabledCode, undefined);

    // The guard is cleared, so enforcement is not exempted going forward.
    const workspaceDoc = await ctx.connection
      .collection("workspaces")
      .findOne({ _id: new Types.ObjectId(workspaceId) });
    assert.strictEqual(workspaceDoc?.conversionInProgressAt ?? null, null);

    // The workspace has no subscription, and the personal plan is intact.
    const detail = await readJson<{
      result: { subscription: unknown | null };
    }>(await user.fetch(`/api/v1/workspaces/${slug}`));
    assert.strictEqual(detail.result.subscription, null);

    const supporter =
      await ctx.container.supporterRepository.findById(discordUserId);
    assert.strictEqual(
      supporter?.paddleCustomer?.subscription?.id,
      subscriptionId,
      "the personal subscription must be untouched after a failed conversion",
    );
  });

  async function readConversion(
    user: Awaited<ReturnType<AppTestContext["asUser"]>>,
    slug: string,
  ) {
    const detail = await readJson<{
      result: {
        conversion: {
          eligible: boolean;
          feedLimit?: number;
          ineligibleReason?: string;
        } | null;
      };
    }>(await user.fetch(`/api/v1/workspaces/${slug}`));
    return detail.result.conversion;
  }

  it("reports an owner with a Tier 2/3 personal plan and an unfunded workspace as eligible to convert", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, slug } = await createWorkspaceAsUser(discordUserId);

    await ctx.container.supporterRepository.upsertPaddleCustomer(
      discordUserId,
      buildPaddleCustomer({
        subscriptionId: generateTestId(),
        productKey: SubscriptionProductKey.Tier3,
      }),
    );

    // buildPaddleCustomer stamps Tier 2 benefits (maxUserFeeds 70) regardless of
    // productKey, so the carried feed limit is 70 here.
    assert.deepStrictEqual(await readConversion(user, slug), {
      eligible: true,
      feedLimit: 70,
    });
  });

  it("reports a Free / Tier 1 owner as ineligible with a tier reason (buy a team plan directly)", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, slug } = await createWorkspaceAsUser(discordUserId);

    await ctx.container.supporterRepository.upsertPaddleCustomer(
      discordUserId,
      buildPaddleCustomer({
        subscriptionId: generateTestId(),
        productKey: SubscriptionProductKey.Tier1,
      }),
    );

    assert.deepStrictEqual(await readConversion(user, slug), {
      eligible: false,
      ineligibleReason: "PERSONAL_PLAN_INELIGIBLE",
    });
  });

  it("offers no conversion read model while a conversion is already in flight", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, workspaceId, slug } =
      await createWorkspaceAsUser(discordUserId);

    await ctx.container.supporterRepository.upsertPaddleCustomer(
      discordUserId,
      buildPaddleCustomer({
        subscriptionId: generateTestId(),
        productKey: SubscriptionProductKey.Tier2,
      }),
    );

    // A conversion is mid-flight: the guard is set but the workspace
    // subscription has not landed yet. The convert affordance must not be
    // re-offered (which would let a second tab fire a duplicate conversion).
    await ctx.connection.collection("workspaces").updateOne(
      { _id: new Types.ObjectId(workspaceId) },
      { $set: { conversionInProgressAt: new Date() } },
    );

    assert.strictEqual(await readConversion(user, slug), null);
  });

  it("acquires the conversion guard atomically: a live guard blocks a second acquire, an expired one does not", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { workspaceId } = await createWorkspaceAsUser(discordUserId);

    const ttlMs = 5 * 60 * 1000;

    // First acquire wins.
    assert.strictEqual(
      await ctx.container.workspaceRepository.setConversionInProgress(
        workspaceId,
        ttlMs,
      ),
      true,
    );

    // A second acquire while the guard is live loses (serializes conversions).
    assert.strictEqual(
      await ctx.container.workspaceRepository.setConversionInProgress(
        workspaceId,
        ttlMs,
      ),
      false,
    );

    // Once the guard is older than the TTL it is reclaimable, so a fresh
    // conversion can start (a dropped webhook can't block forever).
    await ctx.connection.collection("workspaces").updateOne(
      { _id: new Types.ObjectId(workspaceId) },
      { $set: { conversionInProgressAt: new Date(Date.now() - ttlMs - 1000) } },
    );
    assert.strictEqual(
      await ctx.container.workspaceRepository.setConversionInProgress(
        workspaceId,
        ttlMs,
      ),
      true,
    );
  });

  it("returns only workspaces with a live (non-expired) conversion guard in one query", async () => {
    const ttlMs = 5 * 60 * 1000;

    const liveOwner = randomUUID();
    await seedWorkspaceUser(ctx, liveOwner);
    const { workspaceId: liveId } = await createWorkspaceAsUser(liveOwner);

    const expiredOwner = randomUUID();
    await seedWorkspaceUser(ctx, expiredOwner);
    const { workspaceId: expiredId } =
      await createWorkspaceAsUser(expiredOwner);

    const noGuardOwner = randomUUID();
    await seedWorkspaceUser(ctx, noGuardOwner);
    const { workspaceId: noGuardId } =
      await createWorkspaceAsUser(noGuardOwner);

    await ctx.connection.collection("workspaces").updateOne(
      { _id: new Types.ObjectId(liveId) },
      { $set: { conversionInProgressAt: new Date() } },
    );
    await ctx.connection.collection("workspaces").updateOne(
      { _id: new Types.ObjectId(expiredId) },
      {
        $set: {
          conversionInProgressAt: new Date(Date.now() - ttlMs - 1000),
        },
      },
    );

    const guarded =
      await ctx.container.workspaceRepository.findWorkspaceIdsWithLiveConversionGuard(
        [liveId, expiredId, noGuardId],
        ttlMs,
      );

    assert.deepStrictEqual(guarded, [liveId]);
  });

  it("offers no conversion read model to a non-owner member", async () => {
    const ownerDiscordId = randomUUID();
    await seedWorkspaceUser(ctx, ownerDiscordId);
    const { workspaceId, slug } = await createWorkspaceAsUser(ownerDiscordId);

    const adminDiscordId = randomUUID();
    const adminUserId = await seedWorkspaceUser(ctx, adminDiscordId);
    await ctx.connection.collection("workspacememberships").insertOne({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(adminUserId),
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const admin = await ctx.asUser(adminDiscordId);

    assert.strictEqual(await readConversion(admin, slug), null);
  });

  it("offers no conversion read model once the workspace already has its own subscription", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(ctx, discordUserId);
    const { user, workspaceId, slug } =
      await createWorkspaceAsUser(discordUserId);

    // Owner has a convertible personal plan, but the workspace is already
    // funded, so conversion would clobber it: not offered.
    await ctx.container.supporterRepository.upsertPaddleCustomer(
      discordUserId,
      buildPaddleCustomer({
        subscriptionId: generateTestId(),
        productKey: SubscriptionProductKey.Tier2,
      }),
    );
    await ctx.container.workspaceRepository.upsertPaddleCustomer(
      workspaceId,
      buildPaddleCustomer({
        subscriptionId: generateTestId(),
        productKey: SubscriptionProductKey.Tier2,
      }),
    );

    assert.strictEqual(await readConversion(user, slug), null);
  });
});
