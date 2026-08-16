import { after, before, describe, it } from "node:test";
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

describe("GET /api/v1/user-feeds/:feedId/daily-limit for workspace feeds", () => {
  let ctx: AppTestContext;
  let feedApiMockServer: TestHttpServer;

  before(async () => {
    feedApiMockServer = createTestHttpServer();
    ctx = await createAppTestContext({
      configOverrides: {
        BACKEND_API_USER_FEEDS_API_HOST: feedApiMockServer.host,
      },
    });
  });

  after(async () => {
    await ctx.teardown();
    await feedApiMockServer.stop();
  });

  it("reports the workspace daily limit instead of the creator's personal limit", async () => {
    const discordUserId = generateSnowflake();
    const authenticatedUser = await ctx.asUser(discordUserId);
    const user =
      await ctx.container.usersService.getOrCreateUserByDiscordId(
        discordUserId,
      );
    const workspace =
      await ctx.container.workspaceRepository.createWorkspaceWithOwner({
        name: "Daily Limit Workspace",
        slug: `daily-limit-${generateTestId()}`,
        ownerUserId: user.id,
      });
    const feed = await ctx.container.userFeedRepository.create({
      title: "Workspace Daily Limit Feed",
      url: "https://example.com/workspace-daily-limit.xml",
      user: { id: user.id, discordUserId },
      workspaceId: workspace.id,
    });
    ctx.container.supportersService.resolveFeedBenefits = async () => ({
      maxFeeds: 10,
      maxDailyArticles: 321,
      refreshRateSeconds: 120,
      allowWebhooks: true,
      allowCustomPlaceholders: true,
      allowExternalProperties: true,
      articleRateLimits: [{ max: 321, timeWindowSeconds: 86400 }],
      dormant: false,
    });
    feedApiMockServer.registerRoute(
      "GET",
      `/v1/user-feeds/${feed.id}/delivery-count`,
      () => ({
        status: 200,
        body: { result: { count: 17 } },
      }),
    );

    const response = await authenticatedUser.fetch(
      `/api/v1/user-feeds/${feed.id}/daily-limit`,
      { method: "GET" },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { current: number; max: number };
    };
    assert.deepStrictEqual(body.result, { current: 17, max: 321 });
  });
});
