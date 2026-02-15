import { before, after, describe, it } from "node:test";
import assert from "node:assert";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
import { createMockFeedHandlerPreviewApi } from "../../helpers/mock-apis";
import { UserFeedManagerStatus } from "../../../src/repositories/shared/enums";

const feedHandler = createMockFeedHandlerPreviewApi();
let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext({
    mockApis: { feedHandler },
  });
});

after(async () => {
  await ctx.teardown();
  await feedHandler.stop();
});

function testUrl(feedId: string) {
  return `/api/v1/user-feeds/${feedId}/connections/template-preview`;
}

interface CreateTestFeedOptions {
  discordUserId?: string;
  ownerDiscordUserId?: string;
  shareManageOptions?: {
    invites: Array<{
      discordUserId: string;
      status?: UserFeedManagerStatus;
      connections?: Array<{ connectionId: string }>;
    }>;
  };
}

async function createTestFeed(
  testCtx: AppTestContext,
  options: CreateTestFeedOptions = {},
) {
  const ownerDiscordUserId =
    options.ownerDiscordUserId ?? options.discordUserId ?? generateSnowflake();

  const feed = await testCtx.container.userFeedRepository.create({
    title: "Test Feed",
    url: `https://example.com/feed-${generateTestId()}.xml`,
    user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    shareManageOptions: options.shareManageOptions,
    connections: { discordChannels: [] },
  });

  return { feedId: feed.id };
}

describe(
  "POST /api/v1/user-feeds/:feedId/connections/template-preview",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch(testUrl(generateTestId()), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article: { id: "test" } }),
      });
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for non-existent feed", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(testUrl(generateTestId()), {
        method: "POST",
        body: JSON.stringify({ article: { id: "test" } }),
      });
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 for feed owned by different user", async () => {
      const otherUser = await ctx.asUser(generateSnowflake());
      const { feedId } = await createTestFeed(ctx);

      const response = await otherUser.fetch(testUrl(feedId), {
        method: "POST",
        body: JSON.stringify({ article: { id: "test" } }),
      });
      assert.strictEqual(response.status, 404);
    });

    it("returns 201 for owner with valid article", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId } = await createTestFeed(ctx, { discordUserId });

      const response = await user.fetch(testUrl(feedId), {
        method: "POST",
        body: JSON.stringify({ article: { id: "article-1" } }),
      });

      assert.strictEqual(response.status, 201);
      const body = (await response.json()) as { result: { status: string } };
      assert.strictEqual(body.result.status, "SUCCESS");
    });

    it("returns 201 for shared manager with unrestricted access", async () => {
      const managerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(managerDiscordUserId);
      const { feedId } = await createTestFeed(ctx, {
        shareManageOptions: {
          invites: [
            {
              discordUserId: managerDiscordUserId,
              status: UserFeedManagerStatus.Accepted,
            },
          ],
        },
      });

      const response = await user.fetch(testUrl(feedId), {
        method: "POST",
        body: JSON.stringify({ article: { id: "article-1" } }),
      });

      assert.strictEqual(response.status, 201);
    });

    it("returns 201 for admin accessing other user's feed", async () => {
      const adminUserId = generateTestId();
      const adminDiscordUserId = generateSnowflake();

      const adminCtx = await createAppTestContext({
        mockApis: { feedHandler },
        configOverrides: {
          BACKEND_API_ADMIN_USER_IDS: [adminUserId],
        },
      });

      try {
        const UserModel = adminCtx.connection.model("User");
        await UserModel.create({
          _id: new Types.ObjectId(adminUserId),
          discordUserId: adminDiscordUserId,
        });

        const adminUser = await adminCtx.asUser(adminDiscordUserId);
        const { feedId } = await createTestFeed(adminCtx);

        const response = await adminUser.fetch(testUrl(feedId), {
          method: "POST",
          body: JSON.stringify({ article: { id: "article-1" } }),
        });

        assert.strictEqual(response.status, 201);
      } finally {
        await adminCtx.teardown();
      }
    });

    it("returns 404 when feed handler reports article not found", async (t) => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId } = await createTestFeed(ctx, { discordUserId });

      const articleId = feedHandler.intercept(t, {
        status: 404,
        body: { status: "NOT_FOUND" },
      });

      const response = await user.fetch(testUrl(feedId), {
        method: "POST",
        body: JSON.stringify({ article: { id: articleId } }),
      });

      assert.strictEqual(response.status, 404);
    });

    it("returns 400 when feed handler reports invalid componentsV2", async (t) => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId } = await createTestFeed(ctx, { discordUserId });

      const articleId = feedHandler.intercept(t, {
        status: 400,
        body: {
          message: [{ path: ["componentsV2"], message: "Invalid" }],
        },
      });

      const response = await user.fetch(testUrl(feedId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: articleId },
          componentsV2: [{ type: "invalid" }],
        }),
      });

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when article is missing", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId } = await createTestFeed(ctx, { discordUserId });

      const response = await user.fetch(testUrl(feedId), {
        method: "POST",
        body: JSON.stringify({}),
      });

      assert.strictEqual(response.status, 400);
    });

    it("returns 201 with embeds and content", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId } = await createTestFeed(ctx, { discordUserId });

      const response = await user.fetch(testUrl(feedId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: "article-1" },
          content: "test content",
          embeds: [{ title: "Test Embed" }],
        }),
      });

      assert.strictEqual(response.status, 201);
    });

    it("returns 201 for shared manager with restricted connections", async () => {
      const managerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(managerDiscordUserId);
      const connectionId = new Types.ObjectId().toString();

      const { feedId } = await createTestFeed(ctx, {
        shareManageOptions: {
          invites: [
            {
              discordUserId: managerDiscordUserId,
              status: UserFeedManagerStatus.Accepted,
              connections: [{ connectionId }],
            },
          ],
        },
      });

      const response = await user.fetch(testUrl(feedId), {
        method: "POST",
        body: JSON.stringify({ article: { id: "article-1" } }),
      });

      assert.strictEqual(response.status, 201);
    });

    it("returns 400 for invalid dateTimezone", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId } = await createTestFeed(ctx, { discordUserId });

      const response = await user.fetch(testUrl(feedId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: "article-1" },
          userFeedFormatOptions: {
            dateTimezone: "Invalid/Timezone",
          },
        }),
      });

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 for invalid dateLocale", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId } = await createTestFeed(ctx, { discordUserId });

      const response = await user.fetch(testUrl(feedId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: "article-1" },
          userFeedFormatOptions: {
            dateLocale: "invalid-locale",
          },
        }),
      });

      assert.strictEqual(response.status, 400);
    });

    it("returns 201 with valid dateTimezone and dateLocale", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId } = await createTestFeed(ctx, { discordUserId });

      const response = await user.fetch(testUrl(feedId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: "article-1" },
          userFeedFormatOptions: {
            dateFormat: "YYYY-MM-DD",
            dateTimezone: "America/New_York",
            dateLocale: "en",
          },
        }),
      });

      assert.strictEqual(response.status, 201);
    });

    it("returns 201 with null userFeedFormatOptions", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const { feedId } = await createTestFeed(ctx, { discordUserId });

      const response = await user.fetch(testUrl(feedId), {
        method: "POST",
        body: JSON.stringify({
          article: { id: "article-1" },
          userFeedFormatOptions: null,
        }),
      });

      assert.strictEqual(response.status, 201);
    });
  },
);
