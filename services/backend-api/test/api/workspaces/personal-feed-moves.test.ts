import { after, before, describe, it } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx.teardown();
});

async function seedWorkspaceUser(discordUserId: string): Promise<string> {
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

  return (await ctx.container.userRepository.findIdByDiscordId(
    discordUserId,
  )) as string;
}

describe("POST /api/v1/workspaces/:workspaceSlug/personal-feed-moves", () => {
  it("moves an owned personal feed into an active workspace", async () => {
    const discordUserId = randomUUID();
    const userId = await seedWorkspaceUser(discordUserId);
    const user = await ctx.asUser(discordUserId);
    const workspaceSlug = `move-${randomUUID().slice(0, 18)}`;
    const workspaceResponse = await user.fetch("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "Move Destination", slug: workspaceSlug }),
    });
    assert.strictEqual(workspaceResponse.status, 201);
    const workspace = (await workspaceResponse.json()) as {
      result: { id: string };
    };
    const feed = await ctx.container.userFeedRepository.create({
      title: "Personal feed to move",
      url: "https://example.com/personal-feed-to-move.xml",
      user: { id: userId, discordUserId },
    });

    const moveResponse = await user.fetch(
      `/api/v1/workspaces/${workspaceSlug}/personal-feed-moves`,
      {
        method: "POST",
        body: JSON.stringify({ feedIds: [feed.id] }),
      },
    );

    assert.strictEqual(moveResponse.status, 200);
    assert.deepStrictEqual(await moveResponse.json(), {
      result: { movedCount: 1 },
    });

    const workspaceFeedsResponse = await user.fetch(
      `/api/v1/user-feeds?limit=10&offset=0&workspaceId=${workspace.result.id}`,
    );
    assert.strictEqual(workspaceFeedsResponse.status, 200);
    const workspaceFeeds = (await workspaceFeedsResponse.json()) as {
      total: number;
      results: Array<{ id: string; title: string }>;
    };
    assert.strictEqual(workspaceFeeds.total, 1);
    assert.deepStrictEqual(
      workspaceFeeds.results.map(({ id, title }) => ({ id, title })),
      [{ id: feed.id, title: "Personal feed to move" }],
    );

    const personalFeedsResponse = await user.fetch(
      "/api/v1/user-feeds?limit=10&offset=0",
    );
    assert.strictEqual(personalFeedsResponse.status, 200);
    const personalFeeds = (await personalFeedsResponse.json()) as {
      total: number;
    };
    assert.strictEqual(personalFeeds.total, 0);
  });

  it("lets an admin move their feeds and leaves them with the workspace after departure", async () => {
    const ownerDiscordUserId = randomUUID();
    await seedWorkspaceUser(ownerDiscordUserId);
    const owner = await ctx.asUser(ownerDiscordUserId);
    const workspaceSlug = `admin-move-${randomUUID().slice(0, 18)}`;
    const workspaceResponse = await owner.fetch("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({
        name: "Admin Move Destination",
        slug: workspaceSlug,
      }),
    });
    assert.strictEqual(workspaceResponse.status, 201);
    const workspace = (await workspaceResponse.json()) as {
      result: { id: string };
    };

    const adminDiscordUserId = randomUUID();
    const adminUserId = await seedWorkspaceUser(adminDiscordUserId);
    await ctx.connection.collection("workspacememberships").insertOne({
      workspaceId: new Types.ObjectId(workspace.result.id),
      userId: new Types.ObjectId(adminUserId),
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const adminFeed = await ctx.container.userFeedRepository.create({
      title: "Admin feed to move",
      url: "https://example.com/admin-feed-to-move.xml",
      user: { id: adminUserId, discordUserId: adminDiscordUserId },
    });
    const admin = await ctx.asUser(adminDiscordUserId);

    const moveResponse = await admin.fetch(
      `/api/v1/workspaces/${workspaceSlug}/personal-feed-moves`,
      {
        method: "POST",
        body: JSON.stringify({ feedIds: [adminFeed.id] }),
      },
    );
    assert.strictEqual(moveResponse.status, 200);

    await ctx.connection.collection("workspacememberships").deleteOne({
      workspaceId: new Types.ObjectId(workspace.result.id),
      userId: new Types.ObjectId(adminUserId),
    });

    const workspaceFeedsResponse = await owner.fetch(
      `/api/v1/user-feeds?limit=10&offset=0&workspaceId=${workspace.result.id}`,
    );
    assert.strictEqual(workspaceFeedsResponse.status, 200);
    const workspaceFeeds = (await workspaceFeedsResponse.json()) as {
      results: Array<{ id: string }>;
    };
    assert.deepStrictEqual(
      workspaceFeeds.results.map(({ id }) => id),
      [adminFeed.id],
    );
  });

  it("rejects a user who is not a workspace member", async () => {
    const ownerDiscordUserId = randomUUID();
    await seedWorkspaceUser(ownerDiscordUserId);
    const owner = await ctx.asUser(ownerDiscordUserId);
    const workspaceSlug = `nonmember-${randomUUID().slice(0, 18)}`;
    const workspaceResponse = await owner.fetch("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({
        name: "Private Destination",
        slug: workspaceSlug,
      }),
    });
    assert.strictEqual(workspaceResponse.status, 201);

    const outsiderDiscordUserId = randomUUID();
    const outsiderUserId = await seedWorkspaceUser(outsiderDiscordUserId);
    const outsiderFeed = await ctx.container.userFeedRepository.create({
      title: "Outsider feed",
      url: "https://example.com/outsider-feed.xml",
      user: { id: outsiderUserId, discordUserId: outsiderDiscordUserId },
    });
    const outsider = await ctx.asUser(outsiderDiscordUserId);

    const response = await outsider.fetch(
      `/api/v1/workspaces/${workspaceSlug}/personal-feed-moves`,
      {
        method: "POST",
        body: JSON.stringify({ feedIds: [outsiderFeed.id] }),
      },
    );

    assert.strictEqual(response.status, 404);
  });

  it("rejects a dormant destination with the workspace subscription error", async () => {
    const dormantCtx = await createAppTestContext({
      configOverrides: {
        BACKEND_API_ENABLE_SUPPORTERS: true,
        BACKEND_API_PADDLE_KEY: "test-paddle-key",
        BACKEND_API_PADDLE_URL: "http://localhost:1",
      },
    });

    try {
      const discordUserId = randomUUID();
      await dormantCtx.container.userRepository.create({
        discordUserId,
        email: `${discordUserId}@example.com`,
      });
      await dormantCtx.connection.collection("users").updateOne(
        { discordUserId },
        {
          $set: {
            "featureFlags.workspaces": true,
            verifiedEmail: `verified-${discordUserId}@example.com`,
            verifiedEmailVerifiedAt: new Date(),
          },
        },
      );
      const userId =
        (await dormantCtx.container.userRepository.findIdByDiscordId(
          discordUserId,
        )) as string;
      const user = await dormantCtx.asUser(discordUserId);
      const workspaceSlug = `dormant-${randomUUID().slice(0, 18)}`;
      const workspaceResponse = await user.fetch("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name: "Dormant Destination",
          slug: workspaceSlug,
        }),
      });
      assert.strictEqual(workspaceResponse.status, 201);
      const feed = await dormantCtx.container.userFeedRepository.create({
        title: "Personal feed",
        url: "https://example.com/dormant-personal-feed.xml",
        user: { id: userId, discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/workspaces/${workspaceSlug}/personal-feed-moves`,
        {
          method: "POST",
          body: JSON.stringify({ feedIds: [feed.id] }),
        },
      );

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string };
      assert.strictEqual(body.code, "WORKSPACE_NOT_SUBSCRIBED");
    } finally {
      await dormantCtx.teardown();
    }
  });
});
