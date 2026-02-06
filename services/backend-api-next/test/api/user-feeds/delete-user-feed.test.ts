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

describe("DELETE /api/v1/user-feeds/:feedId", { concurrency: true }, () => {
  it("returns 401 without authentication", async () => {
    const feedId = generateTestId();
    const response = await ctx.fetch(`/api/v1/user-feeds/${feedId}`, {
      method: "DELETE",
    });
    assert.strictEqual(response.status, 401);
  });

  it("returns 404 for invalid ObjectId", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds/not-valid-id", {
      method: "DELETE",
      headers: { cookie: cookies },
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 404 for non-existent valid ObjectId", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);
    const nonExistentId = generateTestId();

    const response = await ctx.fetch(`/api/v1/user-feeds/${nonExistentId}`, {
      method: "DELETE",
      headers: { cookie: cookies },
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 404 when feed belongs to another user (non-manager)", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const otherDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(otherDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Owner's Feed",
      url: "https://example.com/delete-owner-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "DELETE",
      headers: { cookie: cookies },
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 403 when user is an accepted shared manager (not creator)", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed",
      url: "https://example.com/delete-shared-feed.xml",
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

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "DELETE",
      headers: { cookie: cookies },
    });
    assert.strictEqual(response.status, 403);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "MISSING_SHARED_MANAGER_PERMISSIONS");
  });

  it("returns 204 when user is the creator", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed to Delete",
      url: "https://example.com/delete-my-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "DELETE",
      headers: { cookie: cookies },
    });
    assert.strictEqual(response.status, 204);
  });

  it("actually deletes the feed from the database", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed to Verify Deletion",
      url: "https://example.com/delete-verify-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "DELETE",
      headers: { cookie: cookies },
    });

    const deleted = await ctx.container.userFeedRepository.findById(feed.id);
    assert.strictEqual(deleted, null);
  });
});
