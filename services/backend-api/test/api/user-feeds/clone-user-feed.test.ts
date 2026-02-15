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

describe("POST /api/v1/user-feeds/:feedId/clone", { concurrency: true }, () => {
  const cloneUrlResponses: Record<string, string> = {
    "https://example.com/clone-url-timeout.xml": "TIMED_OUT",
    "https://example.com/clone-url-parse.xml": "PARSE_ERROR",
    "https://example.com/clone-url-fetch.xml": "FETCH_ERROR",
  };

  beforeEach(() => {
    feedApiMockServer.registerRoute(
      "POST",
      "/v1/user-feeds/get-articles",
      (req) => {
        const reqUrl = (req.body as { url?: string })?.url ?? "";
        const requestStatus = cloneUrlResponses[reqUrl] || "SUCCESS";

        return {
          status: 200,
          body: {
            result: {
              requestStatus,
              articles: [],
              totalArticles: 0,
              selectedProperties: [],
              url: reqUrl,
              feedTitle: "Feed",
            },
          },
        };
      },
    );
  });

  it("returns 401 without authentication", async () => {
    const feedId = generateTestId();
    const response = await ctx.fetch(`/api/v1/user-feeds/${feedId}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.strictEqual(response.status, 401);
  });

  it("returns 404 for non-existent feed ID", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const nonExistentId = generateTestId();

    const response = await user.fetch(
      `/api/v1/user-feeds/${nonExistentId}/clone`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
    assert.strictEqual(response.status, 404);
  });

  it("returns 201 and creates a cloned feed with same URL", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Original Feed",
      url: "https://example.com/clone-source.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as {
      result: { id: string };
    };
    assert.ok(body.result.id);
    assert.notStrictEqual(body.result.id, feed.id);

    const clonedFeed = await ctx.container.userFeedRepository.findById(
      body.result.id,
    );
    assert.ok(clonedFeed);
    assert.strictEqual(clonedFeed.url, feed.url);
    assert.strictEqual(clonedFeed.title, feed.title);
  });

  it("returns 201 and uses custom title when provided", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Original Feed Title",
      url: "https://example.com/clone-title.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      body: JSON.stringify({ title: "Custom Cloned Title" }),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as {
      result: { id: string };
    };
    assert.ok(body.result.id);

    const clonedFeed = await ctx.container.userFeedRepository.findById(
      body.result.id,
    );
    assert.ok(clonedFeed);
    assert.strictEqual(clonedFeed.title, "Custom Cloned Title");
  });

  it("returns 400 with FEED_LIMIT_REACHED when user is at feed limit", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const maxFeeds = ctx.container.config.BACKEND_API_DEFAULT_MAX_USER_FEEDS;
    for (let i = 0; i < maxFeeds; i++) {
      await ctx.container.userFeedRepository.create({
        title: `Feed ${i}`,
        url: `https://example.com/clone-limit-${i}.xml`,
        user: { id: generateTestId(), discordUserId },
      });
    }

    const feedToClone = await ctx.container.userFeedRepository.create({
      title: "Feed to Clone",
      url: "https://example.com/clone-limit-source.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(
      `/api/v1/user-feeds/${feedToClone.id}/clone`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_LIMIT_REACHED");
  });

  it("returns 201 when cloned by accepted shared manager", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(sharedManagerDiscordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed to Clone",
      url: "https://example.com/clone-shared.xml",
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

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as { result: { id: string } };
    assert.ok(body.result.id);
    assert.notStrictEqual(body.result.id, feed.id);
  });

  it("clones feed with discord channel connections", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const connectionName = "Clone Connection";
    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed With Connection",
      url: "https://example.com/clone-connections.xml",
      user: { id: generateTestId(), discordUserId },
      connections: {
        discordChannels: [
          {
            id: generateTestId(),
            name: connectionName,
            createdAt: new Date(),
            updatedAt: new Date(),
            details: { embeds: [], formatter: {} },
          } as never,
        ],
      },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as { result: { id: string } };

    const clonedFeed = await ctx.container.userFeedRepository.findById(
      body.result.id,
    );
    assert.ok(clonedFeed);
    assert.ok(clonedFeed.connections.discordChannels.length > 0);
    assert.strictEqual(
      clonedFeed.connections.discordChannels[0]!.name,
      connectionName,
    );
    assert.notStrictEqual(
      clonedFeed.connections.discordChannels[0]!.id,
      feed.connections.discordChannels[0]!.id,
    );
  });

  it("returns 404 when cloning feed owned by another user", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const otherDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(otherDiscordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Someone Else's Feed",
      url: "https://example.com/clone-not-owned.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    assert.strictEqual(response.status, 404);
  });

  it("strips extraneous body fields and still succeeds", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Extra Fields",
      url: "https://example.com/clone-extra-fields.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      body: JSON.stringify({ title: "Clone", unknownField: "bad" }),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as { result: { id: string } };
    assert.ok(body.result.id);
  });

  it("returns 201 and uses new URL when url is provided", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const newUrl = "https://example.com/clone-new-url.xml";

    const feed = await ctx.container.userFeedRepository.create({
      title: "Original Feed",
      url: "https://example.com/clone-original-url.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      body: JSON.stringify({ url: newUrl }),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as { result: { id: string } };
    assert.ok(body.result.id);

    const clonedFeed = await ctx.container.userFeedRepository.findById(
      body.result.id,
    );
    assert.ok(clonedFeed);
    assert.strictEqual(clonedFeed.url, newUrl);
  });

  it("returns 400 FEED_REQUEST_TIMEOUT when cloning with invalid url", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const newUrl = "https://example.com/clone-url-timeout.xml";

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Clone Timeout",
      url: "https://example.com/clone-url-timeout-old.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      body: JSON.stringify({ url: newUrl }),
    });
    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_REQUEST_TIMEOUT");
  });

  it("returns 400 ADD_FEED_PARSE_FAILED when cloning with unparseable url", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const newUrl = "https://example.com/clone-url-parse.xml";

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Clone Parse Error",
      url: "https://example.com/clone-url-parse-old.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      body: JSON.stringify({ url: newUrl }),
    });
    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "ADD_FEED_PARSE_FAILED");
  });

  it("returns 400 FEED_FETCH_FAILED when cloning with unreachable url", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const newUrl = "https://example.com/clone-url-fetch.xml";

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Clone Fetch Error",
      url: "https://example.com/clone-url-fetch-old.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      body: JSON.stringify({ url: newUrl }),
    });
    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_FETCH_FAILED");
  });

  it("returns 201 when admin clones another user's feed", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const adminDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(adminDiscordUserId);

    const adminUser =
      await ctx.container.usersService.getOrCreateUserByDiscordId(
        adminDiscordUserId,
      );
    ctx.container.config.BACKEND_API_ADMIN_USER_IDS.push(adminUser.id);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed Owned by Another User",
      url: "https://example.com/clone-admin.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as { result: { id: string } };
    assert.ok(body.result.id);

    ctx.container.config.BACKEND_API_ADMIN_USER_IDS.pop();
  });
});
