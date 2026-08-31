import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
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
  UserFeedHealthStatus,
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

async function seedWorkspaceUser(discordUserId: string): Promise<string> {
  await ctx.container.userRepository.create({
    discordUserId,
    email: `${discordUserId}@example.com`,
  });
  await ctx.connection.collection("users").updateOne(
    { discordUserId },
    {
      $set: {
        "featureFlags.workspaces": true,
        verifiedEmail: `verified-${discordUserId}@example.com`,
        verifiedEmailVerifiedAt: new Date(),
      },
    },
  );
  const id = await ctx.container.userRepository.findIdByDiscordId(discordUserId);
  return id as string;
}

async function createWorkspace(
  user: Awaited<ReturnType<AppTestContext["asUser"]>>,
  slug: string,
): Promise<string> {
  const res = await user.fetch("/api/v1/workspaces", {
    method: "POST",
    body: JSON.stringify({ name: "Workspace", slug }),
  });
  assert.strictEqual(res.status, 201);
  const body = (await res.json()) as { result: { id: string } };
  return body.result.id;
}

describe("PATCH /api/v1/user-feeds with filters (bulk all-matching)", () => {
  it("returns 400 when both feeds and filters provided", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed",
      url: "https://example.com/both-feed.xml",
      user: { id: generateTestId(), discordUserId: generateSnowflake() },
    });
    const res = await user.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: feed.id }], search: "Feed" },
      }),
    });
    assert.strictEqual(res.status, 400);
  });

  it("returns 400 when neither feeds nor filters provided", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const res = await user.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      body: JSON.stringify({ op: "bulk-delete", data: {} }),
    });
    assert.strictEqual(res.status, 400);
  });

  it("bulk-delete via search filter deletes only matching authorized feeds", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const otherDiscordId = generateSnowflake();

    const match1 = await ctx.container.userFeedRepository.create({
      title: "Alpha Feed",
      url: "https://example.com/alpha1.xml",
      user: { id: generateTestId(), discordUserId },
    });
    const match2 = await ctx.container.userFeedRepository.create({
      title: "Alpha Special",
      url: "https://example.com/alpha2.xml",
      user: { id: generateTestId(), discordUserId },
    });
    const nonMatch = await ctx.container.userFeedRepository.create({
      title: "Beta Feed",
      url: "https://example.com/beta.xml",
      user: { id: generateTestId(), discordUserId },
    });
    const otherUserFeed = await ctx.container.userFeedRepository.create({
      title: "Alpha Other",
      url: "https://example.com/alpha-other.xml",
      user: { id: generateTestId(), discordUserId: otherDiscordId },
    });

    const res = await user.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      body: JSON.stringify({
        op: "bulk-delete",
        data: { search: "Alpha" },
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { results: Array<{ id: string; deleted: boolean }> };
    assert.strictEqual(body.results.length, 2);
    const deletedIds = new Set(body.results.map((r) => r.id));
    assert.ok(deletedIds.has(match1.id));
    assert.ok(deletedIds.has(match2.id));
    assert.ok(!deletedIds.has(nonMatch.id));
    assert.ok(!deletedIds.has(otherUserFeed.id));

    assert.strictEqual(await ctx.container.userFeedRepository.findById(match1.id), null);
    assert.strictEqual(await ctx.container.userFeedRepository.findById(match2.id), null);
    assert.ok(await ctx.container.userFeedRepository.findById(nonMatch.id));
    assert.ok(await ctx.container.userFeedRepository.findById(otherUserFeed.id));
  });

  it("bulk-delete via search is scope-isolated: workspace filter does not delete personal feeds", async () => {
    const discordUserId = generateSnowflake();
    await seedWorkspaceUser(discordUserId);
    const user = await ctx.asUser(discordUserId);
    const workspaceId = await createWorkspace(user, `ws-${discordUserId.slice(0, 8)}`);

    const personalFeed = await ctx.container.userFeedRepository.create({
      title: "SharedTitle Feed",
      url: "https://example.com/personal-shared.xml",
      user: { id: generateTestId(), discordUserId },
    });
    const workspaceFeed = await ctx.container.userFeedRepository.create({
      title: "SharedTitle Workspace",
      url: "https://example.com/ws-shared.xml",
      user: { id: generateTestId(), discordUserId },
      workspaceId,
    });

    const res = await user.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      body: JSON.stringify({
        op: "bulk-delete",
        data: { search: "SharedTitle", workspaceId },
      }),
    });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { results: Array<{ id: string }> };
    assert.strictEqual(body.results.length, 1);
    assert.strictEqual(body.results[0]!.id, workspaceFeed.id);

    assert.ok(await ctx.container.userFeedRepository.findById(personalFeed.id), "personal feed should survive workspace bulk delete");
    assert.strictEqual(await ctx.container.userFeedRepository.findById(workspaceFeed.id), null);
  });

  it("bulk-disable via status filter only disables eligible feeds (partial skip)", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const enabledFeed = await ctx.container.userFeedRepository.create({
      title: "Enabled Feed",
      url: "https://example.com/enabled.xml",
      user: { id: generateTestId(), discordUserId },
    });
    const manualDisabled = await ctx.container.userFeedRepository.create({
      title: "Manual Disabled",
      url: "https://example.com/manual.xml",
      user: { id: generateTestId(), discordUserId },
    });
    await ctx.container.userFeedRepository.disableFeedsByIds([manualDisabled.id], UserFeedDisabledCode.Manual);
    const exceededFeed = await ctx.container.userFeedRepository.create({
      title: "Exceeded Feed",
      url: "https://example.com/exceeded.xml",
      user: { id: generateTestId(), discordUserId },
    });
    await ctx.container.userFeedRepository.disableFeedsByIds([exceededFeed.id], UserFeedDisabledCode.ExceededFeedLimit);

    // Filter that matches all three via search "Feed" - but disable should only affect enabled + exceeded (eligible)
    const res = await user.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      body: JSON.stringify({ op: "bulk-disable", data: { search: "Feed" } }),
    });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { results: Array<{ id: string; disabled: boolean }> };
    // Only enabledFeed and exceededFeed are eligible; manualDisabled is already manually disabled and should be skipped
    // Our eligibility for disable is !disabled or disabledCode in [exceeded]
    // So enabledFeed (no code) -> eligible, exceededFeed -> eligible, manualDisabled -> not eligible
    const disabledIds = new Set(body.results.filter((r) => r.disabled).map((r) => r.id));
    assert.ok(disabledIds.has(enabledFeed.id));
    assert.ok(disabledIds.has(exceededFeed.id));
    assert.ok(!disabledIds.has(manualDisabled.id));
    assert.strictEqual(body.results.length, 2, "only eligible feeds returned as disabled");
  });

  it("bulk-enable via filter only enables manually disabled feeds", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);

    const manual1 = await ctx.container.userFeedRepository.create({
      title: "Manual1",
      url: "https://example.com/manual1.xml",
      user: { id: generateTestId(), discordUserId },
    });
    const manual2 = await ctx.container.userFeedRepository.create({
      title: "Manual2",
      url: "https://example.com/manual2.xml",
      user: { id: generateTestId(), discordUserId },
    });
    await ctx.container.userFeedRepository.disableFeedsByIds([manual1.id, manual2.id], UserFeedDisabledCode.Manual);
    const enabledFeed = await ctx.container.userFeedRepository.create({
      title: "Enabled",
      url: "https://example.com/enabled2.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const res = await user.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      body: JSON.stringify({ op: "bulk-enable", data: { search: "Manual" } }),
    });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { results: Array<{ id: string; enabled: boolean }> };
    assert.strictEqual(body.results.length, 2);
    const enabledIds = new Set(body.results.filter((r) => r.enabled).map((r) => r.id));
    assert.ok(enabledIds.has(manual1.id));
    assert.ok(enabledIds.has(manual2.id));
    assert.ok(!enabledIds.has(enabledFeed.id));
  });

  it("large matching set (60 feeds) deletes all via filter", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const createdIds: string[] = [];
    for (let i = 0; i < 60; i++) {
      const feed = await ctx.container.userFeedRepository.create({
        title: `BulkLarge ${i}`,
        url: `https://example.com/bulk-large-${i}-${generateTestId()}.xml`,
        user: { id: generateTestId(), discordUserId },
      });
      createdIds.push(feed.id);
    }
    const res = await user.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      body: JSON.stringify({ op: "bulk-delete", data: { search: "BulkLarge" } }),
    });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { results: Array<{ id: string }> };
    assert.strictEqual(body.results.length, 60);
    for (const id of createdIds) {
      assert.strictEqual(await ctx.container.userFeedRepository.findById(id), null);
    }
  });

  it("returns 404 for non-member workspace filter", async () => {
    const ownerId = generateSnowflake();
    await seedWorkspaceUser(ownerId);
    const owner = await ctx.asUser(ownerId);
    const workspaceId = await createWorkspace(owner, `ws404-${ownerId.slice(0, 8)}`);
    await ctx.container.userFeedRepository.create({
      title: "WS Feed",
      url: "https://example.com/ws404.xml",
      user: { id: generateTestId(), discordUserId: ownerId },
      workspaceId,
    });
    const outsider = await ctx.asUser(generateSnowflake());
    const res = await outsider.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      body: JSON.stringify({ op: "bulk-delete", data: { workspaceId, search: "WS" } }),
    });
    assert.strictEqual(res.status, 404);
  });

  it("changing-result race: filter re-evaluated at call time, not stale", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await ctx.container.userFeedRepository.create({
      title: "Race Feed",
      url: "https://example.com/race.xml",
      user: { id: generateTestId(), discordUserId },
    });
    // Title matches search initially
    let res = await user.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      body: JSON.stringify({ op: "bulk-delete", data: { search: "Race" } }),
    });
    assert.strictEqual(res.status, 200);
    let body = (await res.json()) as { results: Array<{ id: string }> };
    assert.strictEqual(body.results.length, 1);

    // After deletion, same filter now matches 0
    res = await user.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      body: JSON.stringify({ op: "bulk-delete", data: { search: "Race" } }),
    });
    assert.strictEqual(res.status, 200);
    body = (await res.json()) as { results: Array<{ id: string }> };
    assert.strictEqual(body.results.length, 0);
  });
});
