import { after, before, describe, it } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";

describe("workspace feed refresh rates", () => {
  let ctx: AppTestContext;

  before(async () => {
    ctx = await createAppTestContext();
  });

  after(async () => {
    await ctx.teardown();
  });

  it("validates a feed override against workspace benefits", async () => {
    const discordUserId = generateSnowflake();
    const authenticatedUser = await ctx.asUser(discordUserId);
    const user =
      await ctx.container.usersService.getOrCreateUserByDiscordId(
        discordUserId,
      );
    const workspace =
      await ctx.container.workspaceRepository.createWorkspaceWithOwner({
        name: "Refresh Rate Workspace",
        slug: `refresh-rate-${generateTestId()}`,
        ownerUserId: user.id,
      });
    const feed = await ctx.container.userFeedRepository.create({
      title: "Workspace Refresh Rate Feed",
      url: "https://example.com/workspace-refresh-rate.xml",
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

    const response = await authenticatedUser.fetch(
      `/api/v1/user-feeds/${feed.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ userRefreshRateSeconds: 300 }),
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { userRefreshRateSeconds?: number };
    };
    assert.strictEqual(body.result.userRefreshRateSeconds, 300);
  });

  it("returns the workspace effective rate when the feed has no stamped rate", async () => {
    const discordUserId = generateSnowflake();
    const authenticatedUser = await ctx.asUser(discordUserId);
    const user =
      await ctx.container.usersService.getOrCreateUserByDiscordId(
        discordUserId,
      );
    const workspace =
      await ctx.container.workspaceRepository.createWorkspaceWithOwner({
        name: "Effective Rate Workspace",
        slug: `effective-rate-${generateTestId()}`,
        ownerUserId: user.id,
      });
    const feed = await ctx.container.userFeedRepository.create({
      title: "Workspace Effective Rate Feed",
      url: "https://example.com/workspace-effective-rate.xml",
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

    const response = await authenticatedUser.fetch(
      `/api/v1/user-feeds/${feed.id}`,
      { method: "GET" },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { refreshRateSeconds: number };
    };
    assert.strictEqual(body.result.refreshRateSeconds, 120);
  });
});
