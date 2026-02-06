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
  UserFeedHealthStatus,
  UserFeedManagerStatus,
} from "../../../src/repositories/shared/enums";
import { GetFeedArticlesFilterReturnType } from "../../../src/services/feed-handler/types";

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
  "POST /api/v1/user-feeds/:feedId/get-articles",
  { concurrency: true },
  () => {
    const capturedBodies = new Map<string, Record<string, unknown>>();

    beforeEach(() => {
      capturedBodies.clear();
      feedApiMockServer.registerRoute(
        "POST",
        "/v1/user-feeds/get-articles",
        (req) => {
          const body = req.body as { url?: string };

          if (body?.url) {
            capturedBodies.set(body.url, req.body as Record<string, unknown>);
          }

          if (body?.url?.includes("invalid-custom-regex")) {
            return {
              status: 422,
              body: {
                code: "CUSTOM_PLACEHOLDER_REGEX_EVAL",
                errors: [{ message: "Invalid regex" }],
              },
            };
          }

          if (body?.url?.includes("invalid-filters-regex")) {
            return {
              status: 422,
              body: {
                code: "FILTERS_REGEX_EVAL",
                errors: [{ message: "Invalid filter regex" }],
              },
            };
          }

          return {
            status: 200,
            body: {
              result: {
                requestStatus: "SUCCESS",
                articles: [{ id: "article-1", title: "Test Article" }],
                totalArticles: 1,
                selectedProperties: ["id", "title"],
              },
            },
          };
        },
      );
    });

    it("returns 401 without authentication", async () => {
      const feedId = generateTestId();
      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/get-articles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for non-existent feed", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);
      const feedId = generateTestId();

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when feed belongs to another user", async () => {
      const ownerDiscordId = generateSnowflake();
      const otherDiscordId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(otherDiscordId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Owner Feed",
        url: "https://example.com/owner-feed-get-articles.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 400 when formatter is missing", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Feed",
        url: "https://example.com/feed-get-articles-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
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

    it("returns 200 with valid request", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Feed",
        url: "https://example.com/feed-get-articles-success.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          articles: Array<Record<string, string>>;
          requestStatus: string;
          totalArticles: number;
          selectedProperties: string[];
        };
      };
      assert.ok(body.result);
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
      assert.strictEqual(body.result.totalArticles, 1);
      assert.ok(Array.isArray(body.result.articles));
      assert.ok(Array.isArray(body.result.selectedProperties));
    });

    it("returns 200 with filters and pagination", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Feed",
        url: "https://example.com/feed-get-articles-filters.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            limit: 5,
            skip: 2,
            filters: {
              returnType:
                GetFeedArticlesFilterReturnType.IncludeEvaluationResults,
              search: "test",
            },
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          articles: Array<Record<string, string>>;
          requestStatus: string;
          totalArticles: number;
        };
      };
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
      assert.ok(Array.isArray(body.result.articles));
    });

    it("merges feed formatOptions into upstream request", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/feed-get-articles-format-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
        formatOptions: {
          dateFormat: "YYYY-MM-DD",
          dateTimezone: "America/New_York",
          dateLocale: "en",
        },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: true,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const capturedBody = capturedBodies.get(feedUrl);
      assert.ok(capturedBody);
      const upstreamBody = capturedBody as {
        formatter: {
          options: {
            dateFormat: string;
            dateTimezone: string;
            dateLocale: string;
            formatTables: boolean;
          };
        };
      };
      assert.strictEqual(
        upstreamBody.formatter.options.dateFormat,
        "YYYY-MM-DD",
      );
      assert.strictEqual(
        upstreamBody.formatter.options.dateTimezone,
        "America/New_York",
      );
      assert.strictEqual(upstreamBody.formatter.options.dateLocale, "en");
      assert.strictEqual(upstreamBody.formatter.options.formatTables, true);
    });

    it("returns 200 when user is an accepted shared manager", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/shared-get-articles-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Shared Feed Get Articles",
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
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );
      assert.strictEqual(response.status, 200);
    });

    it("returns 200 when user is admin accessing another user's feed", async () => {
      const adminDiscordUserId = generateSnowflake();
      const ownerDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(adminDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/admin-get-articles-${generateTestId()}.xml`;

      const adminUser =
        await ctx.container.usersService.getOrCreateUserByDiscordId(
          adminDiscordUserId,
        );
      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.push(adminUser.id);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Admin Access Get Articles Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);

      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.pop();
    });

    it("passes custom placeholders to upstream request", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/feed-get-articles-placeholders-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Custom Placeholders Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
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
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const capturedBody = capturedBodies.get(feedUrl);
      assert.ok(capturedBody);
      const upstreamBody = capturedBody as {
        formatter: {
          customPlaceholders: Array<{
            referenceName: string;
            sourcePlaceholder: string;
            steps: Array<{ type: string; regexSearch: string }>;
          }>;
        };
      };
      assert.strictEqual(upstreamBody.formatter.customPlaceholders.length, 1);
      assert.strictEqual(
        upstreamBody.formatter.customPlaceholders[0]!.referenceName,
        "test",
      );
    });

    it("passes external properties to upstream request", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/feed-get-articles-extprops-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "External Properties Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
              externalProperties: [
                {
                  id: "ext-1",
                  sourceField: "title",
                  label: "Full Text",
                  cssSelector: ".content",
                },
              ],
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const capturedBody = capturedBodies.get(feedUrl);
      assert.ok(capturedBody);
      const upstreamBody = capturedBody as {
        formatter: {
          externalProperties: Array<{
            id: string;
            sourceField: string;
            label: string;
            cssSelector: string;
          }>;
        };
      };
      assert.strictEqual(upstreamBody.formatter.externalProperties.length, 1);
      assert.strictEqual(
        upstreamBody.formatter.externalProperties[0]!.sourceField,
        "title",
      );
    });

    it("passes includeHtmlInErrors to upstream request", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/feed-get-articles-html-errors-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "HTML Errors Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            includeHtmlInErrors: true,
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const capturedBody = capturedBodies.get(feedUrl);
      assert.ok(capturedBody);
      assert.strictEqual(
        (capturedBody as { includeHtmlInErrors: boolean }).includeHtmlInErrors,
        true,
      );
    });

    it("returns 422 for invalid custom placeholder regex from upstream", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Invalid Regex Feed",
        url: `https://example.com/invalid-custom-regex-${generateTestId()}.xml`,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );
      assert.strictEqual(response.status, 422);
    });

    it("returns 422 for invalid filters regex from upstream", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Invalid Filters Feed",
        url: `https://example.com/invalid-filters-regex-${generateTestId()}.xml`,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            filters: {
              returnType:
                GetFeedArticlesFilterReturnType.IncludeEvaluationResults,
              expression: {},
            },
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );
      assert.strictEqual(response.status, 422);
    });

    it("falls back to user preferences for date options when feed has no formatOptions", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/feed-get-articles-user-prefs-${generateTestId()}.xml`;

      await ctx.container.usersService.getOrCreateUserByDiscordId(
        discordUserId,
      );
      await ctx.container.userRepository.updatePreferencesByDiscordId(
        discordUserId,
        {
          dateFormat: "DD/MM/YYYY",
          dateTimezone: "Europe/London",
          dateLocale: "en-GB",
        },
      );

      const feed = await ctx.container.userFeedRepository.create({
        title: "User Prefs Fallback Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const capturedBody = capturedBodies.get(feedUrl);
      assert.ok(capturedBody);
      const upstreamBody = capturedBody as {
        formatter: {
          options: {
            dateFormat: string;
            dateTimezone: string;
            dateLocale: string;
          };
        };
      };
      assert.strictEqual(
        upstreamBody.formatter.options.dateFormat,
        "DD/MM/YYYY",
      );
      assert.strictEqual(
        upstreamBody.formatter.options.dateTimezone,
        "Europe/London",
      );
      assert.strictEqual(upstreamBody.formatter.options.dateLocale, "en-GB");
    });
  },
);
