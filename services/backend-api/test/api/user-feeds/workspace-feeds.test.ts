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

// Workspace-feed association: feeds carry an optional workspaceId, any workspace member can
// see/manage them, they count against the workspace limit, and personal/workspace scopes
// are strictly separated.

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

function mockFeedFetch(feedUrl: string) {
  feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
    status: 200,
    body: {
      result: {
        requestStatus: "SUCCESS",
        articles: [],
        totalArticles: 0,
        selectedProperties: [],
        url: feedUrl,
        feedTitle: "Workspace Feed",
      },
    },
  });
}

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

async function addMembership(workspaceId: string, userId: string, role = "admin") {
  await ctx.connection.collection("workspacememberships").insertOne({
    workspaceId: new Types.ObjectId(workspaceId),
    userId: new Types.ObjectId(userId),
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("Workspace-associated user feeds", { concurrency: false }, () => {
  it("creates a workspace feed visible in workspace scope but not personal scope", async () => {
    const discordId = randomUUID();
    await seedWorkspaceUser(discordId);
    const user = await ctx.asUser(discordId);
    const workspaceId = await createWorkspace(user, `workspace-${discordId.slice(0, 8)}`);

    const feedUrl = "https://example.com/workspace-feed.xml";
    mockFeedFetch(feedUrl);

    const createRes = await user.fetch("/api/v1/user-feeds", {
      method: "POST",
      body: JSON.stringify({ url: feedUrl, workspaceId }),
    });
    assert.strictEqual(createRes.status, 201);

    // Workspace scope lists the feed.
    const workspaceList = await user.fetch(
      `/api/v1/user-feeds?limit=10&offset=0&workspaceId=${workspaceId}`,
    );
    assert.strictEqual(workspaceList.status, 200);
    const workspaceBody = (await workspaceList.json()) as { total: number };
    assert.strictEqual(workspaceBody.total, 1);

    // Personal scope excludes the workspace feed.
    const personalList = await user.fetch(
      "/api/v1/user-feeds?limit=10&offset=0",
    );
    assert.strictEqual(personalList.status, 200);
    const personalBody = (await personalList.json()) as { total: number };
    assert.strictEqual(personalBody.total, 0);
  });

  it("returns 404 listing a workspace's feeds as a non-member", async () => {
    const ownerId = randomUUID();
    await seedWorkspaceUser(ownerId);
    const owner = await ctx.asUser(ownerId);
    const workspaceId = await createWorkspace(owner, `workspace-${ownerId.slice(0, 8)}`);

    const outsider = await ctx.asUser(generateSnowflake());
    const res = await outsider.fetch(
      `/api/v1/user-feeds?limit=10&offset=0&workspaceId=${workspaceId}`,
    );
    assert.strictEqual(res.status, 404);
  });

  it("lets a site admin list a workspace's feeds without being a member", async () => {
    const adminUserId = new Types.ObjectId().toHexString();
    const adminDiscordId = randomUUID();

    const adminFeedApiMock = createTestHttpServer();
    const adminCtx = await createAppTestContext({
      configOverrides: {
        BACKEND_API_USER_FEEDS_API_HOST: adminFeedApiMock.host,
        BACKEND_API_FEED_REQUESTS_API_HOST: adminFeedApiMock.host,
        BACKEND_API_ADMIN_USER_IDS: [adminUserId],
      },
    });
    adminFeedApiMock.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
          url: "https://example.com/admin-workspace-feed.xml",
          feedTitle: "Workspace Feed",
        },
      },
    });

    try {
      await adminCtx.connection.collection("users").insertOne({
        _id: new Types.ObjectId(adminUserId),
        discordUserId: adminDiscordId,
      });

      // The workspace and its feed belong to a different user; the admin never joins.
      const ownerId = randomUUID();
      await adminCtx.container.userRepository.create({
        discordUserId: ownerId,
        email: `${ownerId}@example.com`,
      });
      await adminCtx.connection.collection("users").updateOne(
        { discordUserId: ownerId },
        {
          $set: {
            "featureFlags.workspaces": true,
            verifiedEmail: `verified-${ownerId}@example.com`,
            verifiedEmailVerifiedAt: new Date(),
          },
        },
      );
      const owner = await adminCtx.asUser(ownerId);
      const createWsRes = await owner.fetch("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name: "Workspace",
          slug: `admin-feeds-${ownerId.slice(0, 8)}`,
        }),
      });
      const workspaceId = (
        (await createWsRes.json()) as { result: { id: string } }
      ).result.id;

      const createFeedRes = await owner.fetch("/api/v1/user-feeds", {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/admin-workspace-feed.xml",
          workspaceId,
        }),
      });
      assert.strictEqual(createFeedRes.status, 201);

      const admin = await adminCtx.asUser(adminDiscordId);
      const listRes = await admin.fetch(
        `/api/v1/user-feeds?limit=10&offset=0&workspaceId=${workspaceId}`,
      );
      assert.strictEqual(listRes.status, 200);
      const body = (await listRes.json()) as {
        total: number;
        results: Array<{ url: string }>;
      };
      assert.strictEqual(body.total, 1);
      assert.strictEqual(
        body.results[0]?.url,
        "https://example.com/admin-workspace-feed.xml",
      );
    } finally {
      await adminCtx.teardown();
      await adminFeedApiMock.stop();
    }
  });

  it("treats an admin configured by discord id (not internal id) as a site admin", async () => {
    const adminDiscordId = randomUUID();

    const adminFeedApiMock = createTestHttpServer();
    const adminCtx = await createAppTestContext({
      configOverrides: {
        BACKEND_API_USER_FEEDS_API_HOST: adminFeedApiMock.host,
        BACKEND_API_FEED_REQUESTS_API_HOST: adminFeedApiMock.host,
        // Configured by DISCORD id, not the internal Mongo id.
        BACKEND_API_ADMIN_USER_IDS: [adminDiscordId],
      },
    });
    adminFeedApiMock.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
          url: "https://example.com/admin-by-discord-feed.xml",
          feedTitle: "Workspace Feed",
        },
      },
    });

    try {
      const ownerId = randomUUID();
      await adminCtx.container.userRepository.create({
        discordUserId: ownerId,
        email: `${ownerId}@example.com`,
      });
      await adminCtx.connection.collection("users").updateOne(
        { discordUserId: ownerId },
        {
          $set: {
            "featureFlags.workspaces": true,
            verifiedEmail: `verified-${ownerId}@example.com`,
            verifiedEmailVerifiedAt: new Date(),
          },
        },
      );
      const owner = await adminCtx.asUser(ownerId);
      const createWsRes = await owner.fetch("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name: "Workspace",
          slug: `admin-bydiscord-${ownerId.slice(0, 8)}`,
        }),
      });
      const workspaceId = (
        (await createWsRes.json()) as { result: { id: string } }
      ).result.id;

      await owner.fetch("/api/v1/user-feeds", {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/admin-by-discord-feed.xml",
          workspaceId,
        }),
      });

      const admin = await adminCtx.asUser(adminDiscordId);
      const listRes = await admin.fetch(
        `/api/v1/user-feeds?limit=10&offset=0&workspaceId=${workspaceId}`,
      );
      assert.strictEqual(listRes.status, 200);
      const body = (await listRes.json()) as { total: number };
      assert.strictEqual(body.total, 1);
    } finally {
      await adminCtx.teardown();
      await adminFeedApiMock.stop();
    }
  });

  it("lets any workspace member view and delete a workspace feed (role-agnostic)", async () => {
    const ownerId = randomUUID();
    const ownerUserId = await seedWorkspaceUser(ownerId);
    const owner = await ctx.asUser(ownerId);
    const workspaceId = await createWorkspace(owner, `workspace-${ownerId.slice(0, 8)}`);

    const feedUrl = "https://example.com/shared-workspace-feed.xml";
    mockFeedFetch(feedUrl);
    const createRes = await owner.fetch("/api/v1/user-feeds", {
      method: "POST",
      body: JSON.stringify({ url: feedUrl, workspaceId }),
    });
    const { result: created } = (await createRes.json()) as {
      result: { id: string };
    };

    // A second member (not the creator) joins the workspace.
    const memberDiscordId = randomUUID();
    const memberUserId = await seedWorkspaceUser(memberDiscordId);
    assert.notStrictEqual(memberUserId, ownerUserId);
    await addMembership(workspaceId, memberUserId, "admin");
    const member = await ctx.asUser(memberDiscordId);

    // The member can read the feed.
    const getRes = await member.fetch(`/api/v1/user-feeds/${created.id}`);
    assert.strictEqual(getRes.status, 200);

    // The member can delete the feed even though they did not create it.
    const deleteRes = await member.fetch(`/api/v1/user-feeds/${created.id}`, {
      method: "DELETE",
    });
    assert.strictEqual(deleteRes.status, 204);

    const afterList = await owner.fetch(
      `/api/v1/user-feeds?limit=10&offset=0&workspaceId=${workspaceId}`,
    );
    const afterBody = (await afterList.json()) as { total: number };
    assert.strictEqual(afterBody.total, 0);
  });

  it("does not let a non-member access a workspace feed by id", async () => {
    const ownerId = randomUUID();
    await seedWorkspaceUser(ownerId);
    const owner = await ctx.asUser(ownerId);
    const workspaceId = await createWorkspace(owner, `workspace-${ownerId.slice(0, 8)}`);

    const feedUrl = "https://example.com/private-workspace-feed.xml";
    mockFeedFetch(feedUrl);
    const createRes = await owner.fetch("/api/v1/user-feeds", {
      method: "POST",
      body: JSON.stringify({ url: feedUrl, workspaceId }),
    });
    const { result: created } = (await createRes.json()) as {
      result: { id: string };
    };

    const outsider = await ctx.asUser(generateSnowflake());
    const res = await outsider.fetch(`/api/v1/user-feeds/${created.id}`);
    assert.strictEqual(res.status, 404);
  });

  it("does not leave an orphaned feed when feed creation races workspace deletion", async () => {
    const discordId = randomUUID();
    await seedWorkspaceUser(discordId);
    const user = await ctx.asUser(discordId);
    const slug = `race-${discordId.slice(0, 8)}`;
    const workspaceId = await createWorkspace(user, slug);

    // URL validation takes real time (a network fetch), so the workspace can
    // be deleted between addFeed's membership pre-check and its insert. The
    // delayed mock holds validation open while the deletion completes.
    const feedUrl = "https://example.com/race-feed.xml";
    feedApiMockServer.registerRoute(
      "POST",
      "/v1/user-feeds/get-articles",
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return {
          status: 200,
          body: {
            result: {
              requestStatus: "SUCCESS",
              articles: [],
              totalArticles: 0,
              selectedProperties: [],
              url: feedUrl,
              feedTitle: "Race Feed",
            },
          },
        };
      },
    );

    const createPromise = user.fetch("/api/v1/user-feeds", {
      method: "POST",
      body: JSON.stringify({ url: feedUrl, workspaceId }),
    });

    // Let the creation pass its membership pre-check and enter URL validation.
    await new Promise((resolve) => setTimeout(resolve, 400));

    const deleteRes = await user.fetch(`/api/v1/workspaces/${slug}`, {
      method: "DELETE",
    });
    assert.strictEqual(deleteRes.status, 204);

    const createRes = await createPromise;
    assert.notStrictEqual(
      createRes.status,
      201,
      "feed creation must not succeed once its workspace is deleted",
    );

    const remaining = await ctx.connection
      .collection("userfeeds")
      .countDocuments({ workspaceId: new Types.ObjectId(workspaceId) });
    assert.strictEqual(
      remaining,
      0,
      "no feed may survive referencing the deleted workspace",
    );
  });
});

describe(
  "Workspace feed quota enforcement",
  { concurrency: false },
  () => {
    // A dedicated context with the workspace feed limit set to 1 so tests can reach
    // the ceiling with a single repository-seeded fixture instead of 140 HTTP calls.
    let quotaCtx: AppTestContext;
    let quotaMockServer: TestHttpServer;

    before(async () => {
      quotaMockServer = createTestHttpServer();
      quotaCtx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_DEFAULT_MAX_WORKSPACE_FEEDS: 1,
          BACKEND_API_DEFAULT_MAX_USER_FEEDS: 1,
          BACKEND_API_USER_FEEDS_API_HOST: quotaMockServer.host,
          BACKEND_API_FEED_REQUESTS_API_HOST: quotaMockServer.host,
        },
      });
    });

    after(async () => {
      await quotaCtx.teardown();
      await quotaMockServer.stop();
    });

    beforeEach(() => {
      quotaMockServer.clear();
    });

    function mockQuotaFeedFetch(feedUrl: string) {
      quotaMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
        status: 200,
        body: {
          result: {
            requestStatus: "SUCCESS",
            articles: [],
            totalArticles: 0,
            selectedProperties: [],
            url: feedUrl,
            feedTitle: "Feed",
          },
        },
      });
    }

    async function seedQuotaWorkspaceUser(discordUserId: string): Promise<string> {
      await quotaCtx.container.userRepository.create({
        discordUserId,
        email: `${discordUserId}@example.com`,
      });
      await quotaCtx.connection.collection("users").updateOne(
        { discordUserId },
        {
          $set: {
            "featureFlags.workspaces": true,
            verifiedEmail: `verified-${discordUserId}@example.com`,
            verifiedEmailVerifiedAt: new Date(),
          },
        },
      );
      const id = await quotaCtx.container.userRepository.findIdByDiscordId(discordUserId);
      return id as string;
    }

    async function createQuotaWorkspace(
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

    it("returns 400 with FEED_LIMIT_REACHED when the workspace already has maxWorkspaceFeeds feeds", async () => {
      const discordId = randomUUID();
      const userId = await seedQuotaWorkspaceUser(discordId);
      const user = await quotaCtx.asUser(discordId);
      const workspaceId = await createQuotaWorkspace(user, `quota-${discordId.slice(0, 8)}`);

      // Seed one workspace feed directly to reach the limit (maxWorkspaceFeeds = 1)
      // without going through the HTTP layer.
      await quotaCtx.container.userFeedRepository.create({
        title: "Existing Workspace Feed",
        url: `https://example.com/${generateTestId()}.xml`,
        user: { id: userId, discordUserId: discordId },
        workspaceId,
      });

      const newFeedUrl = `https://example.com/${generateTestId()}.xml`;
      mockQuotaFeedFetch(newFeedUrl);

      const res = await user.fetch("/api/v1/user-feeds", {
        method: "POST",
        body: JSON.stringify({ url: newFeedUrl, workspaceId }),
      });

      assert.strictEqual(res.status, 400);
      const body = (await res.json()) as { code: string };
      assert.strictEqual(body.code, "FEED_LIMIT_REACHED");

      // Confirm the feed count did not grow: the workspace should still have exactly
      // the one seeded feed.
      const listRes = await user.fetch(
        `/api/v1/user-feeds?limit=10&offset=0&workspaceId=${workspaceId}`,
      );
      const listBody = (await listRes.json()) as { total: number };
      assert.strictEqual(listBody.total, 1);
    });

    it("allows creating a workspace feed even when the user is at their personal feed limit", async () => {
      const discordId = randomUUID();
      const userId = await seedQuotaWorkspaceUser(discordId);
      const user = await quotaCtx.asUser(discordId);
      const workspaceId = await createQuotaWorkspace(user, `scope-${discordId.slice(0, 8)}`);

      // Seed one personal feed (no workspaceId) so the user is at their personal
      // limit (maxUserFeeds = 1). Personal and workspace quotas are tracked
      // independently — countByOwnership excludes workspaceId-bearing feeds, and
      // countByWorkspace only counts feeds for the given workspace.
      await quotaCtx.container.userFeedRepository.create({
        title: "Personal Feed",
        url: `https://example.com/${generateTestId()}.xml`,
        user: { id: userId, discordUserId: discordId },
      });

      const workspaceFeedUrl = `https://example.com/${generateTestId()}.xml`;
      mockQuotaFeedFetch(workspaceFeedUrl);

      const res = await user.fetch("/api/v1/user-feeds", {
        method: "POST",
        body: JSON.stringify({ url: workspaceFeedUrl, workspaceId }),
      });

      assert.strictEqual(res.status, 201);

      // The workspace scope shows exactly the one new workspace feed.
      const workspaceList = await user.fetch(
        `/api/v1/user-feeds?limit=10&offset=0&workspaceId=${workspaceId}`,
      );
      const workspaceBody = (await workspaceList.json()) as { total: number };
      assert.strictEqual(workspaceBody.total, 1);

      // The personal scope still shows exactly the one pre-existing personal feed.
      const personalList = await user.fetch(
        "/api/v1/user-feeds?limit=10&offset=0",
      );
      const personalBody = (await personalList.json()) as { total: number };
      assert.strictEqual(personalBody.total, 1);
    });
  },
);
