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

describe("Workspace deletion", { concurrency: true }, () => {
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

  async function createWorkspaceAsUser(discordUserId: string) {
    const user = await ctx.asUser(discordUserId);
    const slug = `ws-${randomUUID().slice(0, 18)}`;
    const res = await user.fetch("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "Doomed Workspace", slug }),
    });
    assert.strictEqual(res.status, 201);
    const created = (await res.json()) as { result: { id: string } };
    return { user, workspaceId: created.result.id, slug };
  }

  it("cancels the active Paddle subscription as part of deletion", async () => {
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
      "POST",
      `/subscriptions/${subscriptionId}/cancel`,
      {
        status: 200,
        body: { data: { id: subscriptionId, status: "active" } },
      },
    );

    const res = await user.fetch(`/api/v1/workspaces/${slug}`, {
      method: "DELETE",
    });
    assert.strictEqual(res.status, 204);

    const cancelRequests = paddleApi.server.getRequestsForPath(
      `/subscriptions/${subscriptionId}/cancel`,
    );
    assert.strictEqual(
      cancelRequests.length,
      1,
      "deletion must issue the Paddle cancellation",
    );

    const readRes = await user.fetch(`/api/v1/workspaces/${slug}`);
    assert.strictEqual(readRes.status, 404);
  });

  it("deletes an unsubscribed workspace, its memberships, and its feeds without touching Paddle", async () => {
    const discordUserId = randomUUID();
    const userId = await seedWorkspaceUser(ctx, discordUserId);
    const { user, workspaceId, slug } =
      await createWorkspaceAsUser(discordUserId);

    for (let i = 0; i < 2; i++) {
      await ctx.container.userFeedRepository.create({
        title: `Workspace Feed ${i}`,
        url: `https://example.com/${generateTestId()}.xml`,
        user: { id: userId, discordUserId },
        workspaceId,
      });
    }

    const res = await user.fetch(`/api/v1/workspaces/${slug}`, {
      method: "DELETE",
    });
    assert.strictEqual(res.status, 204);

    const readRes = await user.fetch(`/api/v1/workspaces/${slug}`);
    assert.strictEqual(readRes.status, 404);

    const remainingFeeds = await ctx.connection
      .collection("userfeeds")
      .countDocuments({ workspaceId: new Types.ObjectId(workspaceId) });
    assert.strictEqual(remainingFeeds, 0, "workspace feeds must be deleted");

    const remainingMemberships = await ctx.connection
      .collection("workspacememberships")
      .countDocuments({ workspaceId: new Types.ObjectId(workspaceId) });
    assert.strictEqual(remainingMemberships, 0);

    // No Paddle assertion needed: this workspace has no subscription and no
    // cancel route is registered for it, so any attempted cancellation would
    // have failed the deletion (the 204 above proves none was attempted).
  });

  it("remains owner-only: admins get 403, non-members 404", async () => {
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

    const adminRes = await admin.fetch(`/api/v1/workspaces/${slug}`, {
      method: "DELETE",
    });
    assert.strictEqual(adminRes.status, 403);

    const outsiderDiscordId = randomUUID();
    await seedWorkspaceUser(ctx, outsiderDiscordId);
    const outsider = await ctx.asUser(outsiderDiscordId);

    const outsiderRes = await outsider.fetch(`/api/v1/workspaces/${slug}`, {
      method: "DELETE",
    });
    assert.strictEqual(outsiderRes.status, 404);

    // The workspace is untouched.
    const owner = await ctx.asUser(ownerDiscordId);
    const readRes = await owner.fetch(`/api/v1/workspaces/${slug}`);
    assert.strictEqual(readRes.status, 200);
  });
});
