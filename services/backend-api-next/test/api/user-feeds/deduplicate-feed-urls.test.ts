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

describe("POST /api/v1/user-feeds/deduplicate-feed-urls", () => {
  it("returns 401 without authentication", async () => {
    const response = await ctx.fetch(
      "/api/v1/user-feeds/deduplicate-feed-urls",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: ["https://example.com/feed.xml"] }),
      },
    );
    assert.strictEqual(response.status, 401);
  });

  it("returns 400 when urls field is missing", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(
      "/api/v1/user-feeds/deduplicate-feed-urls",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
        },
        body: JSON.stringify({}),
      },
    );
    assert.strictEqual(response.status, 400);
  });

  it("returns deduplicated URLs (filters out existing)", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    await ctx.container.userFeedRepository.create({
      title: "Existing Feed",
      url: "https://example.com/existing-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(
      "/api/v1/user-feeds/deduplicate-feed-urls",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
        },
        body: JSON.stringify({
          urls: [
            "https://example.com/existing-feed.xml",
            "https://example.com/new-feed.xml",
          ],
        }),
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as { result: { urls: string[] } };
    assert.deepStrictEqual(body.result.urls, [
      "https://example.com/new-feed.xml",
    ]);
  });

  it("returns all URLs if none exist in user's feeds", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(
      "/api/v1/user-feeds/deduplicate-feed-urls",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
        },
        body: JSON.stringify({
          urls: [
            "https://example.com/feed1.xml",
            "https://example.com/feed2.xml",
          ],
        }),
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as { result: { urls: string[] } };
    assert.deepStrictEqual(body.result.urls, [
      "https://example.com/feed1.xml",
      "https://example.com/feed2.xml",
    ]);
  });

  it("returns empty array if all URLs already exist", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    await ctx.container.userFeedRepository.create({
      title: "Feed 1",
      url: "https://example.com/feed1.xml",
      user: { id: generateTestId(), discordUserId },
    });

    await ctx.container.userFeedRepository.create({
      title: "Feed 2",
      url: "https://example.com/feed2.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(
      "/api/v1/user-feeds/deduplicate-feed-urls",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
        },
        body: JSON.stringify({
          urls: [
            "https://example.com/feed1.xml",
            "https://example.com/feed2.xml",
          ],
        }),
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as { result: { urls: string[] } };
    assert.deepStrictEqual(body.result.urls, []);
  });
});
