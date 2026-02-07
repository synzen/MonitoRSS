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

describe("PATCH /api/v1/user-feeds/:feedId", { concurrency: true }, () => {
  it("returns 401 without authentication", async () => {
    const feedId = generateTestId();
    const response = await ctx.fetch(`/api/v1/user-feeds/${feedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Title" }),
    });
    assert.strictEqual(response.status, 401);
  });

  it("returns 404 for invalid ObjectId", async () => {
    const user = await ctx.asUser(generateSnowflake());

    const response = await user.fetch("/api/v1/user-feeds/not-valid-id", {
      method: "PATCH",
      body: JSON.stringify({ title: "New Title" }),
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 404 for non-existent valid ObjectId", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const nonExistentId = generateTestId();

    const response = await user.fetch(`/api/v1/user-feeds/${nonExistentId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "New Title" }),
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 404 when feed belongs to another user", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const otherDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(otherDiscordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Owner's Feed",
      url: "https://example.com/patch-owner-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Hacked Title" }),
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 200 and updates title", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Original Title",
      url: "https://example.com/patch-title-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated Title" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { id: string; title: string };
    };
    assert.strictEqual(body.result.id, feed.id);
    assert.strictEqual(body.result.title, "Updated Title");
  });

  it("returns 200 and updates disabledCode to MANUAL", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed to Disable",
      url: "https://example.com/patch-disable-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ disabledCode: "MANUAL" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { disabledCode?: string };
    };
    assert.strictEqual(body.result.disabledCode, "MANUAL");
  });

  it("returns 200 and enables feed (disabledCode null)", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const created = await ctx.container.userFeedRepository.create({
      title: "Disabled Feed",
      url: "https://example.com/patch-enable-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const feed = (await ctx.container.userFeedRepository.findOneAndUpdate(
      { _id: created.id },
      { $set: { disabledCode: UserFeedDisabledCode.Manual } },
    ))!;

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ disabledCode: null }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { disabledCode?: string };
    };
    assert.strictEqual(body.result.disabledCode, undefined);
  });

  it("shared manager can update feed", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(sharedManagerDiscordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed to Update",
      url: "https://example.com/patch-shared-feed.xml",
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
      method: "PATCH",
      body: JSON.stringify({ title: "Updated by Shared Manager" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { title: string };
    };
    assert.strictEqual(body.result.title, "Updated by Shared Manager");
  });

  it("pending invite cannot update feed", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const pendingDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(pendingDiscordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Pending Invite Feed",
      url: "https://example.com/patch-pending-invite-feed.xml",
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
      method: "PATCH",
      body: JSON.stringify({ title: "Should Not Work" }),
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 400 when title is empty string", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Empty Title",
      url: "https://example.com/patch-empty-title-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "" }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 400 for invalid timezone", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Invalid TZ",
      url: "https://example.com/patch-invalid-tz.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        formatOptions: { dateTimezone: "INVALID_TZ" },
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 200 for valid timezone", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Valid TZ",
      url: "https://example.com/patch-valid-tz.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        formatOptions: { dateTimezone: "America/New_York" },
      }),
    });
    assert.strictEqual(response.status, 200);
  });

  it("returns 200 for empty timezone (skips validation)", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Empty TZ",
      url: "https://example.com/patch-empty-tz.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        formatOptions: { dateTimezone: "" },
      }),
    });
    assert.strictEqual(response.status, 200);
  });

  it("returns 400 for invalid locale", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Invalid Locale",
      url: "https://example.com/patch-invalid-locale.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        formatOptions: { dateLocale: "zz-invalid" },
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 200 for valid locale", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Valid Locale",
      url: "https://example.com/patch-valid-locale.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        formatOptions: { dateLocale: "en" },
      }),
    });
    assert.strictEqual(response.status, 200);
  });

  it("returns 400 for duplicate externalProperties labels", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Dupe Labels",
      url: "https://example.com/patch-dupe-labels.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        externalProperties: [
          {
            id: "1",
            sourceField: "field1",
            label: "same-label",
            cssSelector: ".a",
          },
          {
            id: "2",
            sourceField: "field2",
            label: "same-label",
            cssSelector: ".b",
          },
        ],
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 200 for unique externalProperties labels", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Unique Labels",
      url: "https://example.com/patch-unique-labels.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        externalProperties: [
          {
            id: "1",
            sourceField: "field1",
            label: "label-a",
            cssSelector: ".a",
          },
          {
            id: "2",
            sourceField: "field2",
            label: "label-b",
            cssSelector: ".b",
          },
        ],
      }),
    });
    assert.strictEqual(response.status, 200);
  });

  it("strips extraneous fields and still succeeds", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Extra Fields",
      url: "https://example.com/patch-extra-fields-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Valid", unknownField: "bad" }),
    });
    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { title: string };
    };
    assert.strictEqual(body.result.title, "Valid");
  });

  describe("url update", () => {
    const patchUrlResponses: Record<string, string> = {
      "https://example.com/patch-url-valid.xml": "SUCCESS",
      "https://example.com/patch-url-timeout.xml": "TIMED_OUT",
      "https://example.com/patch-url-parse.xml": "PARSE_ERROR",
      "https://example.com/patch-url-fetch.xml": "FETCH_ERROR",
      "https://example.com/patch-url-ssl.xml": "INVALID_SSL_CERTIFICATE",
    };

    beforeEach(() => {
      feedApiMockServer.registerRoute(
        "POST",
        "/v1/user-feeds/get-articles",
        (req) => {
          const reqUrl = (req.body as { url?: string })?.url ?? "";
          const requestStatus = patchUrlResponses[reqUrl] || "SUCCESS";

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

    it("returns 200 and updates url when valid", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const newUrl = "https://example.com/patch-url-valid.xml";

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed for URL Update",
        url: "https://example.com/patch-url-old.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
        method: "PATCH",
        body: JSON.stringify({ url: newUrl }),
      });
      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { result: { url: string } };
      assert.strictEqual(body.result.url, newUrl);
    });

    it("returns 400 FEED_REQUEST_TIMEOUT on url timeout", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const newUrl = "https://example.com/patch-url-timeout.xml";

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed for URL Timeout",
        url: "https://example.com/patch-url-timeout-old.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
        method: "PATCH",
        body: JSON.stringify({ url: newUrl }),
      });
      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string };
      assert.strictEqual(body.code, "FEED_REQUEST_TIMEOUT");
    });

    it("returns 400 ADD_FEED_PARSE_FAILED on url parse error", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const newUrl = "https://example.com/patch-url-parse.xml";

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed for URL Parse Error",
        url: "https://example.com/patch-url-parse-old.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
        method: "PATCH",
        body: JSON.stringify({ url: newUrl }),
      });
      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string };
      assert.strictEqual(body.code, "ADD_FEED_PARSE_FAILED");
    });

    it("returns 400 FEED_FETCH_FAILED on url fetch error", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const newUrl = "https://example.com/patch-url-fetch.xml";

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed for URL Fetch Error",
        url: "https://example.com/patch-url-fetch-old.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
        method: "PATCH",
        body: JSON.stringify({ url: newUrl }),
      });
      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string };
      assert.strictEqual(body.code, "FEED_FETCH_FAILED");
    });

    it("returns 400 FEED_INVALID_SSL_CERT on invalid ssl", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const newUrl = "https://example.com/patch-url-ssl.xml";

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed for URL SSL Error",
        url: "https://example.com/patch-url-ssl-old.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
        method: "PATCH",
        body: JSON.stringify({ url: newUrl }),
      });
      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string };
      assert.strictEqual(body.code, "FEED_INVALID_SSL_CERT");
    });
  });

  it("returns 200 and sets userRefreshRateSeconds", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Refresh Rate",
      url: "https://example.com/patch-refresh-rate.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ userRefreshRateSeconds: 3600 }),
    });
    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { userRefreshRateSeconds: number };
    };
    assert.strictEqual(body.result.userRefreshRateSeconds, 3600);
  });

  it("returns 400 when userRefreshRateSeconds is too high", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for High Refresh",
      url: "https://example.com/patch-refresh-high.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ userRefreshRateSeconds: 86401 }),
    });
    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "USER_REFRESH_RATE_NOT_ALLOWED");
  });

  it("returns 400 when userRefreshRateSeconds is too low", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Low Refresh",
      url: "https://example.com/patch-refresh-low.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ userRefreshRateSeconds: 60 }),
    });
    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "USER_REFRESH_RATE_NOT_ALLOWED");
  });

  it("returns 400 FEED_LIMIT_REACHED when enabling at limit", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const maxFeeds = ctx.container.config.BACKEND_API_DEFAULT_MAX_USER_FEEDS;

    for (let i = 0; i < maxFeeds; i++) {
      await ctx.container.userFeedRepository.create({
        title: `Enabled Feed ${i}`,
        url: `https://example.com/patch-limit-enabled-${i}.xml`,
        user: { id: generateTestId(), discordUserId },
      });
    }

    const disabledFeed = await ctx.container.userFeedRepository.create({
      title: "Disabled Feed at Limit",
      url: "https://example.com/patch-limit-disabled.xml",
      user: { id: generateTestId(), discordUserId },
    });

    await ctx.container.userFeedRepository.updateById(disabledFeed.id, {
      $set: { disabledCode: UserFeedDisabledCode.ExceededFeedLimit },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${disabledFeed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ disabledCode: null }),
    });
    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_LIMIT_REACHED");
  });

  it("returns 200 and updates passingComparisons", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Passing Comparisons",
      url: "https://example.com/patch-passing-comp.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ passingComparisons: ["title"] }),
    });
    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { passingComparisons: string[] };
    };
    assert.deepStrictEqual(body.result.passingComparisons, ["title"]);
  });

  it("returns 200 and updates blockingComparisons", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Blocking Comparisons",
      url: "https://example.com/patch-blocking-comp.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ blockingComparisons: ["guid"] }),
    });
    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { blockingComparisons: string[] };
    };
    assert.deepStrictEqual(body.result.blockingComparisons, ["guid"]);
  });

  it("returns 200 and updates dateCheckOptions", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Date Check Options",
      url: "https://example.com/patch-date-check.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        dateCheckOptions: { oldArticleDateDiffMsThreshold: 86400000 },
      }),
    });
    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        dateCheckOptions: { oldArticleDateDiffMsThreshold: number };
      };
    };
    assert.strictEqual(
      body.result.dateCheckOptions.oldArticleDateDiffMsThreshold,
      86400000,
    );
  });

  it("returns 400 for negative dateCheckOptions threshold", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Negative Date Check",
      url: "https://example.com/patch-date-check-neg.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        dateCheckOptions: { oldArticleDateDiffMsThreshold: -1 },
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 200 and updates shareManageOptions", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Share Options",
      url: "https://example.com/patch-share-opts.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        shareManageOptions: {
          invites: [{ discordUserId: "123456789" }],
        },
      }),
    });
    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        shareManageOptions: {
          invites: Array<{ discordUserId: string }>;
        };
      };
    };
    assert.strictEqual(
      body.result.shareManageOptions.invites[0]!.discordUserId,
      "123456789",
    );
  });

  it("returns 200 for empty dateLocale", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Empty Locale",
      url: "https://example.com/patch-empty-locale.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        formatOptions: { dateLocale: "" },
      }),
    });
    assert.strictEqual(response.status, 200);
  });

  it("filters connections for shared manager with limited connection IDs", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const user = await ctx.asUser(sharedManagerDiscordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Patch Connections Filter",
      url: "https://example.com/patch-conn-filter.xml",
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
      method: "PATCH",
      body: JSON.stringify({ title: "Updated by Limited Manager" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { connections: Array<{ id: string }> };
    };
    assert.strictEqual(body.result.connections.length, 1);
    assert.strictEqual(body.result.connections[0]!.id, firstConnectionId);
  });

  it("unsets userRefreshRateSeconds when null is sent", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Null Refresh Rate",
      url: "https://example.com/patch-null-refresh.xml",
      user: { id: generateTestId(), discordUserId },
    });

    await ctx.container.userFeedRepository.findOneAndUpdate(
      { _id: feed.id },
      { $set: { userRefreshRateSeconds: 3600 } },
    );

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ userRefreshRateSeconds: null }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { userRefreshRateSeconds?: number };
    };
    assert.strictEqual(body.result.userRefreshRateSeconds, undefined);
  });
});
