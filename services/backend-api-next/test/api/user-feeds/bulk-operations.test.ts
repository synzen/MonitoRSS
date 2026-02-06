import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { createMockAccessToken } from "../../helpers/mock-factories";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
import {
  createTestHttpServer,
  type TestHttpServer,
} from "../../helpers/test-http-server";
import {
  UserFeedDisabledCode,
  UserFeedManagerStatus,
} from "../../../src/repositories/shared/enums";

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

describe("PATCH /api/v1/user-feeds", () => {
  it("returns 401 without authentication", async () => {
    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: "feed-1" }] },
      }),
    });
    assert.strictEqual(response.status, 401);
  });

  it("returns 400 when op is missing", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        data: { feeds: [{ id: "feed-1" }] },
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 400 when data is missing", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 400 when data.feeds is missing", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: {},
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 400 when op is invalid value", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "invalid-op",
        data: { feeds: [{ id: "feed-1" }] },
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 400 when feed id is empty string", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: "" }] },
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("bulk-delete returns 200 with deleted results for existing feed", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed to Delete",
      url: "https://example.com/delete-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: feed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; deleted: boolean }>;
    };
    assert.ok(body.results);
    assert.strictEqual(body.results.length, 1);
    assert.strictEqual(body.results[0]!.id, feed.id);
    assert.strictEqual(body.results[0]!.deleted, true);
  });

  it("bulk-delete returns 404 for non-existent feeds", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const nonExistentId = generateTestId();

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: nonExistentId }] },
      }),
    });

    assert.strictEqual(response.status, 404);
  });

  it("bulk-disable returns 200 with disabled results", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed to Disable",
      url: "https://example.com/disable-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-disable",
        data: { feeds: [{ id: feed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; disabled: boolean }>;
    };
    assert.ok(body.results);
    assert.strictEqual(body.results.length, 1);
    assert.strictEqual(body.results[0]!.id, feed.id);
    assert.strictEqual(body.results[0]!.disabled, true);
  });

  it("bulk-enable returns 200 with enabled results", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed to Enable",
      url: "https://example.com/enable-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    await ctx.container.userFeedRepository.disableFeedsByIds(
      [feed.id],
      UserFeedDisabledCode.Manual,
    );

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-enable",
        data: { feeds: [{ id: feed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; enabled: boolean }>;
    };
    assert.ok(body.results);
    assert.strictEqual(body.results.length, 1);
    assert.strictEqual(body.results[0]!.id, feed.id);
    assert.strictEqual(body.results[0]!.enabled, true);
  });

  it("bulk-delete excludes feeds owned by another user from results", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const attackerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(attackerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const ownerFeed = await ctx.container.userFeedRepository.create({
      title: "Owner's Feed",
      url: "https://example.com/owner-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: ownerFeed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; deleted: boolean }>;
    };
    assert.strictEqual(body.results.length, 0);

    const feedStillExists = await ctx.container.userFeedRepository.findById(
      ownerFeed.id,
    );
    assert.ok(feedStillExists, "Feed should not be deleted");
  });

  it("bulk-disable excludes feeds owned by another user from results", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const attackerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(attackerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const ownerFeed = await ctx.container.userFeedRepository.create({
      title: "Owner's Feed",
      url: "https://example.com/owner-disable-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-disable",
        data: { feeds: [{ id: ownerFeed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; disabled: boolean }>;
    };
    assert.strictEqual(body.results.length, 0);

    const feedAfter = await ctx.container.userFeedRepository.findById(
      ownerFeed.id,
    );
    assert.strictEqual(
      feedAfter?.disabledCode,
      undefined,
      "Feed should not be disabled",
    );
  });

  it("bulk-enable excludes feeds owned by another user from results", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const attackerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(attackerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const ownerFeed = await ctx.container.userFeedRepository.create({
      title: "Owner's Feed",
      url: "https://example.com/owner-enable-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    await ctx.container.userFeedRepository.disableFeedsByIds(
      [ownerFeed.id],
      UserFeedDisabledCode.Manual,
    );

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-enable",
        data: { feeds: [{ id: ownerFeed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; enabled: boolean }>;
    };
    assert.strictEqual(body.results.length, 0);

    const feedAfter = await ctx.container.userFeedRepository.findById(
      ownerFeed.id,
    );
    assert.strictEqual(
      feedAfter?.disabledCode,
      UserFeedDisabledCode.Manual,
      "Feed should still be disabled",
    );
  });

  it("shared manager can bulk-delete feeds they have accepted invites to", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const sharedFeed = await ctx.container.userFeedRepository.create({
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

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: sharedFeed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; deleted: boolean }>;
    };
    assert.strictEqual(body.results[0]!.id, sharedFeed.id);
    assert.strictEqual(body.results[0]!.deleted, true);
  });

  it("user with pending invite cannot bulk-delete feeds", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const pendingInviteeDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(pendingInviteeDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const sharedFeed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed",
      url: "https://example.com/pending-invite-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: pendingInviteeDiscordUserId,
            status: UserFeedManagerStatus.Pending,
          },
        ],
      },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: sharedFeed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; deleted: boolean }>;
    };
    assert.strictEqual(body.results.length, 0);

    const feedStillExists = await ctx.container.userFeedRepository.findById(
      sharedFeed.id,
    );
    assert.ok(feedStillExists, "Feed should not be deleted");
  });

  it("returns 404 for invalid ObjectIds", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const invalidId = "not-a-valid-objectid";

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: invalidId }] },
      }),
    });

    assert.strictEqual(response.status, 404);
  });

  it("mixed authorization: returns results only for authorized feeds", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const otherOwnerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(ownerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const ownedFeed = await ctx.container.userFeedRepository.create({
      title: "My Own Feed",
      url: "https://example.com/my-own-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const sharedFeed = await ctx.container.userFeedRepository.create({
      title: "Shared With Me",
      url: "https://example.com/shared-with-me.xml",
      user: { id: generateTestId(), discordUserId: otherOwnerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: ownerDiscordUserId,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });

    const unauthorizedFeed = await ctx.container.userFeedRepository.create({
      title: "Not My Feed",
      url: "https://example.com/not-my-feed.xml",
      user: { id: generateTestId(), discordUserId: otherOwnerDiscordUserId },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: {
          feeds: [
            { id: ownedFeed.id },
            { id: sharedFeed.id },
            { id: unauthorizedFeed.id },
          ],
        },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; deleted: boolean }>;
    };

    assert.strictEqual(body.results.length, 2);

    const ownedResult = body.results.find((r) => r.id === ownedFeed.id);
    const sharedResult = body.results.find((r) => r.id === sharedFeed.id);
    const unauthorizedResult = body.results.find(
      (r) => r.id === unauthorizedFeed.id,
    );

    assert.strictEqual(ownedResult?.deleted, true, "Owned feed should delete");
    assert.strictEqual(
      sharedResult?.deleted,
      true,
      "Shared feed should delete",
    );
    assert.strictEqual(
      unauthorizedResult,
      undefined,
      "Unauthorized feed should not be in results",
    );

    const unauthorizedFeedStillExists =
      await ctx.container.userFeedRepository.findById(unauthorizedFeed.id);
    assert.ok(unauthorizedFeedStillExists, "Unauthorized feed should exist");
  });
});
