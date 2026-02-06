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

describe(
  "POST /api/v1/user-feeds/:feedId/get-article-properties",
  { concurrency: true },
  () => {
    beforeEach(() => {
      feedApiMockServer.registerRoute(
        "POST",
        "/v1/user-feeds/get-articles",
        (req) => {
          const body = req.body as { url?: string };

          if (body?.url?.includes("invalid-regex")) {
            return {
              status: 422,
              body: {
                code: "CUSTOM_PLACEHOLDER_REGEX_EVAL",
                errors: [{ message: "Invalid regex" }],
              },
            };
          }

          return {
            status: 200,
            body: {
              result: {
                requestStatus: "SUCCESS",
                articles: [{ title: "Article 1" }],
                totalArticles: 1,
                selectedProperties: ["*"],
              },
            },
          };
        },
      );
    });

    it("returns 401 without authentication", async () => {
      const feedId = generateTestId();
      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/get-article-properties`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for non-existent feed", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);
      const nonExistentId = generateTestId();

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${nonExistentId}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 200 with properties and requestStatus", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/article-properties-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Article Properties Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { properties: string[]; requestStatus: string };
      };
      assert.ok(body.result);
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
      assert.ok(Array.isArray(body.result.properties));
    });

    it("returns 200 with empty body (no customPlaceholders)", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Article Properties Empty Body",
        url: "https://example.com/article-properties-empty.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { properties: string[]; requestStatus: string };
      };
      assert.ok(body.result);
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
    });

    it("returns 404 when feed belongs to another user", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const otherDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(otherDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Other User Article Props Feed",
        url: "https://example.com/other-article-props.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 400 for invalid step type", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Step Validation Feed",
        url: `https://example.com/step-invalid-type-${generateTestId()}.xml`,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            customPlaceholders: [
              {
                referenceName: "test",
                sourcePlaceholder: "title",
                steps: [{ type: "INVALID" }],
              },
            ],
          }),
        },
      );
      assert.strictEqual(response.status, 400);
    });

    it("returns 400 for REGEX step missing regexSearch", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Step Validation Feed",
        url: `https://example.com/step-regex-missing-${generateTestId()}.xml`,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            customPlaceholders: [
              {
                referenceName: "test",
                sourcePlaceholder: "title",
                steps: [{ type: "REGEX" }],
              },
            ],
          }),
        },
      );
      assert.strictEqual(response.status, 400);
    });

    it("returns 400 for DATE_FORMAT step missing format", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Step Validation Feed",
        url: `https://example.com/step-date-missing-${generateTestId()}.xml`,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            customPlaceholders: [
              {
                referenceName: "test",
                sourcePlaceholder: "title",
                steps: [{ type: "DATE_FORMAT" }],
              },
            ],
          }),
        },
      );
      assert.strictEqual(response.status, 400);
    });

    it("returns 200 with valid REGEX step", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/step-regex-valid-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Step Validation Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            customPlaceholders: [
              {
                referenceName: "test",
                sourcePlaceholder: "title",
                steps: [
                  {
                    type: "REGEX",
                    regexSearch: "foo",
                    regexSearchFlags: "gi",
                    replacementString: "bar",
                  },
                ],
              },
            ],
          }),
        },
      );
      assert.strictEqual(response.status, 200);
    });

    it("returns 200 with valid URL_ENCODE step", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/step-urlencode-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Step Validation Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            customPlaceholders: [
              {
                referenceName: "test",
                sourcePlaceholder: "title",
                steps: [{ type: "URL_ENCODE" }],
              },
            ],
          }),
        },
      );
      assert.strictEqual(response.status, 200);
    });

    it("returns 200 with valid UPPERCASE and LOWERCASE steps", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/step-case-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Step Validation Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            customPlaceholders: [
              {
                referenceName: "test",
                sourcePlaceholder: "title",
                steps: [{ type: "UPPERCASE" }, { type: "LOWERCASE" }],
              },
            ],
          }),
        },
      );
      assert.strictEqual(response.status, 200);
    });

    it("returns 200 when user is an accepted shared manager", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/shared-article-props-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Shared Feed Article Props",
        url: feedUrl,
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

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 200);
    });

    it("returns 200 when user is admin accessing another user's feed", async () => {
      const adminDiscordUserId = generateSnowflake();
      const ownerDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(adminDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/admin-article-props-${generateTestId()}.xml`;

      const adminUser =
        await ctx.container.usersService.getOrCreateUserByDiscordId(
          adminDiscordUserId,
        );
      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.push(adminUser.id);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Admin Access Article Props Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);

      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.pop();
    });

    it("returns 200 with explicit null customPlaceholders", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/null-placeholders-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Null Placeholders Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ customPlaceholders: null }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { properties: string[]; requestStatus: string };
      };
      assert.ok(body.result);
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
    });

    it("returns 422 for invalid custom placeholder regex", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/invalid-regex-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Invalid Regex Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            customPlaceholders: [
              {
                referenceName: "test",
                sourcePlaceholder: "title",
                steps: [{ type: "REGEX", regexSearch: "[invalid" }],
              },
            ],
          }),
        },
      );
      assert.strictEqual(response.status, 422);
    });
  },
);
