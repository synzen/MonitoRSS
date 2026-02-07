import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
import {
  createTestHttpServer,
  type TestHttpServer,
} from "../../helpers/test-http-server";
import { UserFeedManagerStatus } from "../../../src/repositories/shared/enums";

let ctx: AppTestContext;
let feedApiMockServer: TestHttpServer;

before(async () => {
  feedApiMockServer = createTestHttpServer();

  ctx = await createAppTestContext({
    configOverrides: {
      BACKEND_API_USER_FEEDS_API_HOST: feedApiMockServer.host,
      BACKEND_API_FEED_REQUESTS_API_HOST: feedApiMockServer.host,
    },
  });
});

after(async () => {
  await ctx.teardown();
  await feedApiMockServer.stop();
});

beforeEach(() => {
  feedApiMockServer.clear();
});

describe("GET /api/v1/user-feeds/:feedId", { concurrency: true }, () => {
  it("returns 401 without authentication", async () => {
    const feedId = generateTestId();
    const response = await ctx.fetch(`/api/v1/user-feeds/${feedId}`, {
      method: "GET",
    });
    assert.strictEqual(response.status, 401);
  });

  it("returns 404 for invalid ObjectId", async () => {
    const user = await ctx.asUser(generateSnowflake());

    const response = await user.fetch("/api/v1/user-feeds/not-valid-id", {
      method: "GET",
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 404 for non-existent valid ObjectId", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const nonExistentId = generateTestId();

    const response = await user.fetch(`/api/v1/user-feeds/${nonExistentId}`, {
      method: "GET",
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 404 when feed belongs to another user", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const otherDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(otherDiscordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Owner's Feed",
      url: "https://example.com/owner-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 200 with formatted feed data when user is the owner", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "My Feed",
      url: "https://example.com/my-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        id: string;
        title: string;
        url: string;
        connections: unknown[];
        createdAt: string;
        updatedAt: string;
        healthStatus: string;
        refreshRateSeconds: number;
        refreshRateOptions: unknown[];
      };
    };
    assert.ok(body.result);
    assert.strictEqual(body.result.id, feed.id);
    assert.strictEqual(body.result.title, "My Feed");
    assert.strictEqual(body.result.url, "https://example.com/my-feed.xml");
    assert.ok(Array.isArray(body.result.connections));
    assert.ok(body.result.createdAt);
    assert.ok(body.result.updatedAt);
    assert.ok(body.result.healthStatus);
    assert.ok(body.result.refreshRateSeconds !== undefined);
    assert.ok(Array.isArray(body.result.refreshRateOptions));
  });

  it("returns 200 with sharedAccessDetails.inviteId when user is an accepted shared manager", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(sharedManagerDiscordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed",
      url: "https://example.com/shared-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: sharedManagerDiscordUserId,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        sharedAccessDetails?: { inviteId: string };
      };
    };
    assert.ok(body.result.sharedAccessDetails);
    assert.ok(body.result.sharedAccessDetails.inviteId);
  });

  it("returns 404 when user has a pending (not accepted) invite", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const pendingDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(pendingDiscordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed",
      url: "https://example.com/pending-invite-get-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: pendingDiscordUserId,
            status: UserFeedManagerStatus.Pending,
          },
        ],
      },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
    });
    assert.strictEqual(response.status, 404);
  });

  it("filters connections for shared manager with limited connection IDs", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(sharedManagerDiscordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed With Connections",
      url: "https://example.com/connections-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      connections: {
        discordChannels: [
          {
            id: generateTestId(),
            name: "Connection 1",
            createdAt: new Date(),
            updatedAt: new Date(),
            details: { embeds: [], formatter: {} },
          } as never,
          {
            id: generateTestId(),
            name: "Connection 2",
            createdAt: new Date(),
            updatedAt: new Date(),
            details: { embeds: [], formatter: {} },
          } as never,
        ],
      },
    });

    const createdFeed = await ctx.container.userFeedRepository.findById(
      feed.id,
    );
    const firstConnectionId = createdFeed!.connections.discordChannels[0]!.id;

    await ctx.container.userFeedRepository.findOneAndUpdate(
      { _id: feed.id },
      {
        $set: {
          shareManageOptions: {
            invites: [
              {
                discordUserId: sharedManagerDiscordUserId,
                status: UserFeedManagerStatus.Accepted,
                connections: [{ connectionId: firstConnectionId }],
              },
            ],
          },
        },
      },
    );

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { connections: Array<{ id: string; name: string }> };
    };
    assert.strictEqual(body.result.connections.length, 1);
    assert.strictEqual(body.result.connections[0]!.id, firstConnectionId);
  });

  it("shared manager without connection restrictions sees all connections", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(sharedManagerDiscordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed All Connections",
      url: "https://example.com/all-connections-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      connections: {
        discordChannels: [
          {
            id: generateTestId(),
            name: "Connection 1",
            createdAt: new Date(),
            updatedAt: new Date(),
            details: { embeds: [], formatter: {} },
          } as never,
          {
            id: generateTestId(),
            name: "Connection 2",
            createdAt: new Date(),
            updatedAt: new Date(),
            details: { embeds: [], formatter: {} },
          } as never,
        ],
      },
    });

    await ctx.container.userFeedRepository.findOneAndUpdate(
      { _id: feed.id },
      {
        $set: {
          shareManageOptions: {
            invites: [
              {
                discordUserId: sharedManagerDiscordUserId,
                status: UserFeedManagerStatus.Accepted,
              },
            ],
          },
        },
      },
    );

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { connections: Array<{ id: string }> };
    };
    assert.strictEqual(body.result.connections.length, 2);
  });

  it("does not include shareManageOptions for shared managers", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(sharedManagerDiscordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed Options",
      url: "https://example.com/share-options-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: sharedManagerDiscordUserId,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { shareManageOptions?: unknown };
    };
    assert.strictEqual(body.result.shareManageOptions, undefined);
  });

  it("includes shareManageOptions for owner", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const otherDiscordUserId = generateSnowflake();

    const feed = await ctx.container.userFeedRepository.create({
      title: "Owner Share Options",
      url: "https://example.com/owner-share-options.xml",
      user: { id: generateTestId(), discordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: otherDiscordUserId,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        shareManageOptions?: { invites: unknown[] };
      };
    };
    assert.ok(body.result.shareManageOptions);
    assert.ok(Array.isArray(body.result.shareManageOptions.invites));
  });
});
