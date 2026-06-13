import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake } from "../../helpers/test-id";
import {
  createTestHttpServer,
  type TestHttpServer,
} from "../../helpers/test-http-server";

// Workspace Reddit connections: one member's personal grant backs every Reddit feed in
// the workspace. Workspace feeds resolve ONLY the workspace connection (never the
// creator's personal one, and vice versa), any member can connect/disconnect, and the
// connector leaving revokes the grant.

let ctx: AppTestContext;
let feedApiMockServer: TestHttpServer;

const REDDIT_URL = "https://www.reddit.com/r/gaming/.rss";

before(async () => {
  feedApiMockServer = createTestHttpServer();
  ctx = await createAppTestContext({
    configOverrides: {
      BACKEND_API_USER_FEEDS_API_HOST: feedApiMockServer.host,
      BACKEND_API_FEED_REQUESTS_API_HOST: feedApiMockServer.host,
      BACKEND_API_REDDIT_CLIENT_ID: "test-reddit-client-id",
      BACKEND_API_REDDIT_CLIENT_SECRET: "test-reddit-client-secret",
      BACKEND_API_REDDIT_REDIRECT_URI: "http://localhost:3000/reddit/callback",
      BACKEND_API_ENCRYPTION_KEY_HEX:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
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

function mockFeedFetch(feedUrl: string, feedTitle = "Workspace Feed") {
  feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
    status: 200,
    body: {
      result: {
        requestStatus: "SUCCESS",
        articles: [],
        totalArticles: 0,
        selectedProperties: [],
        url: feedUrl,
        feedTitle,
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
  const id =
    await ctx.container.userRepository.findIdByDiscordId(discordUserId);
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

// Walks the real OAuth handshake: /login stashes { nonce, workspaceId } in the session
// and redirects with state=nonce. The session cookie is rewritten by that response, so
// the callback must be made with the UPDATED cookie, not the one minted at sign-in.
async function startRedditLogin(
  user: Awaited<ReturnType<AppTestContext["asUser"]>>,
  workspaceId?: string,
): Promise<{ state: string; cookie: string }> {
  const res = await user.fetch(
    `/api/v1/reddit/login${workspaceId ? `?workspaceId=${workspaceId}` : ""}`,
    { redirect: "manual" },
  );
  assert.strictEqual(res.status, 303);

  const location = res.headers.get("location");
  assert.ok(location);
  const state = new URL(location).searchParams.get("state");
  assert.ok(state, "login redirect must carry a state nonce");

  const setCookies = res.headers.getSetCookie();
  assert.ok(setCookies.length, "login must rewrite the session cookie");
  const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");

  return { state, cookie };
}

async function completeRedditCallback(
  cookie: string,
  { code = "valid-auth-code", state }: { code?: string; state: string },
) {
  return ctx.fetch(`/api/v1/reddit/callback?code=${code}&state=${state}`, {
    headers: { cookie },
  });
}

function mockRedditTokenExchange() {
  return mock.method(
    ctx.container.redditApiService,
    "getAccessToken",
    async () => ({
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
      token_type: "bearer" as const,
      scope: "read",
    }),
  );
}

async function getWorkspaceResponse(
  user: Awaited<ReturnType<AppTestContext["asUser"]>>,
  slug: string,
) {
  const res = await user.fetch(`/api/v1/workspaces/${slug}`);
  assert.strictEqual(res.status, 200);
  return (await res.json()) as {
    result: {
      redditConnection: {
        status: string;
        connectedBy: { userId: string; discordUserId: string | null };
      } | null;
    };
  };
}

describe("Workspace Reddit connection", { concurrency: false }, () => {
  it("connects via OAuth with ?workspaceId, storing the grant on the workspace (not the user)", async () => {
    const discordId = randomUUID();
    const userId = await seedWorkspaceUser(discordId);
    const user = await ctx.asUser(discordId);
    const slug = `ws-${discordId.slice(0, 8)}`;
    const workspaceId = await createWorkspace(user, slug);

    // No connection yet.
    const initial = await getWorkspaceResponse(user, slug);
    assert.strictEqual(initial.result.redditConnection, null);

    const tokenMock = mockRedditTokenExchange();

    try {
      const { state, cookie } = await startRedditLogin(user, workspaceId);
      const res = await completeRedditCallback(cookie, { state });

      assert.strictEqual(res.status, 200);
      const body = await res.text();
      assert.ok(body.includes("window.opener.postMessage('reddit', '*')"));

      // Attribution surfaces on the workspace detail endpoint.
      const after = await getWorkspaceResponse(user, slug);
      assert.ok(after.result.redditConnection);
      assert.strictEqual(after.result.redditConnection.status, "ACTIVE");
      assert.strictEqual(after.result.redditConnection.connectedBy.userId, userId);
      assert.strictEqual(
        after.result.redditConnection.connectedBy.discordUserId,
        discordId,
      );

      // The grant lives on the workspace only — the member's personal account is untouched.
      const userDoc = await ctx.connection
        .collection("users")
        .findOne({ discordUserId: discordId });
      assert.ok(!userDoc?.externalCredentials?.length);
    } finally {
      tokenMock.mock.restore();
    }
  });

  it("discards the grant when the callback state does not match the session nonce", async () => {
    const discordId = randomUUID();
    await seedWorkspaceUser(discordId);
    const user = await ctx.asUser(discordId);
    const slug = `ws-${discordId.slice(0, 8)}`;
    const workspaceId = await createWorkspace(user, slug);

    const tokenMock = mockRedditTokenExchange();

    try {
      const { cookie } = await startRedditLogin(user, workspaceId);
      const res = await completeRedditCallback(cookie, { state: "tampered-state" });

      assert.strictEqual(res.status, 200);
      const body = await res.text();
      assert.ok(!body.includes("postMessage"), "must not signal success");
      assert.strictEqual(tokenMock.mock.calls.length, 0, "must not exchange the code");

      const after = await getWorkspaceResponse(user, slug);
      assert.strictEqual(after.result.redditConnection, null);
    } finally {
      tokenMock.mock.restore();
    }
  });

  it("rejects the callback for a workspace the caller is not a member of", async () => {
    const ownerDiscordId = randomUUID();
    await seedWorkspaceUser(ownerDiscordId);
    const owner = await ctx.asUser(ownerDiscordId);
    const slug = `ws-${ownerDiscordId.slice(0, 8)}`;
    const workspaceId = await createWorkspace(owner, slug);

    const outsiderDiscordId = randomUUID();
    await seedWorkspaceUser(outsiderDiscordId);
    const outsider = await ctx.asUser(outsiderDiscordId);

    const tokenMock = mockRedditTokenExchange();

    try {
      const { state, cookie } = await startRedditLogin(outsider, workspaceId);
      const res = await completeRedditCallback(cookie, { state });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(tokenMock.mock.calls.length, 0, "must not exchange the code");

      const after = await getWorkspaceResponse(owner, slug);
      assert.strictEqual(after.result.redditConnection, null);
    } finally {
      tokenMock.mock.restore();
    }
  });

  it("gates workspace reddit feeds on the WORKSPACE connection, never the creator's personal one", async () => {
    const discordId = randomUUID();
    const userId = await seedWorkspaceUser(discordId);
    const user = await ctx.asUser(discordId);
    const slug = `ws-${discordId.slice(0, 8)}`;
    const workspaceId = await createWorkspace(user, slug);

    // The creator has an ACTIVE personal connection...
    await ctx.container.usersService.setRedditCredentials({
      userId,
      accessToken: "personal-access",
      refreshToken: "personal-refresh",
      expiresIn: 3600,
    });

    mockFeedFetch(REDDIT_URL, "gaming");

    // ...but the workspace has none, so a workspace reddit feed is still gated.
    const gated = await user.fetch("/api/v1/user-feeds", {
      method: "POST",
      body: JSON.stringify({ url: REDDIT_URL, workspaceId }),
    });
    assert.strictEqual(gated.status, 403);
    const gatedBody = (await gated.json()) as { code: string };
    assert.strictEqual(gatedBody.code, "REDDIT_CONNECTION_REQUIRED");

    // Workspace url-validation is gated the same way.
    const gatedValidation = await user.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      body: JSON.stringify({ url: REDDIT_URL, workspaceId }),
    });
    assert.strictEqual(gatedValidation.status, 403);

    // A PERSONAL reddit feed is allowed (personal connection is active).
    const personal = await user.fetch("/api/v1/user-feeds", {
      method: "POST",
      body: JSON.stringify({ url: REDDIT_URL }),
    });
    assert.strictEqual(personal.status, 201);

    // Connect the workspace; the workspace feed can now be added.
    const tokenMock = mockRedditTokenExchange();

    try {
      const { state, cookie } = await startRedditLogin(user, workspaceId);
      await completeRedditCallback(cookie, { state });
    } finally {
      tokenMock.mock.restore();
    }

    const allowed = await user.fetch("/api/v1/user-feeds", {
      method: "POST",
      body: JSON.stringify({ url: REDDIT_URL, workspaceId }),
    });
    assert.strictEqual(allowed.status, 201);
    const allowedBody = (await allowed.json()) as {
      result: { id: string };
    };

    // The workspace feed's lookup key comes from the workspace connection sync.
    const feedDoc = await ctx.connection
      .collection("userfeeds")
      .findOne({ _id: new Types.ObjectId(allowedBody.result.id) });
    assert.ok(feedDoc?.feedRequestLookupKey);
  });

  it("disconnects via DELETE, revoking at Reddit and unsetting workspace feeds' lookup keys", async () => {
    const discordId = randomUUID();
    await seedWorkspaceUser(discordId);
    const user = await ctx.asUser(discordId);
    const slug = `ws-${discordId.slice(0, 8)}`;
    const workspaceId = await createWorkspace(user, slug);

    const tokenMock = mockRedditTokenExchange();

    try {
      const { state, cookie } = await startRedditLogin(user, workspaceId);
      await completeRedditCallback(cookie, { state });
    } finally {
      tokenMock.mock.restore();
    }

    mockFeedFetch(REDDIT_URL, "gaming");
    const createRes = await user.fetch("/api/v1/user-feeds", {
      method: "POST",
      body: JSON.stringify({ url: REDDIT_URL, workspaceId }),
    });
    assert.strictEqual(createRes.status, 201);
    const { result: feed } = (await createRes.json()) as {
      result: { id: string };
    };

    const revokeMock = mock.method(
      ctx.container.redditApiService,
      "revokeRefreshToken",
      async () => {},
    );

    try {
      const res = await user.fetch(`/api/v1/workspaces/${slug}/reddit-connection`, {
        method: "DELETE",
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(revokeMock.mock.calls.length, 1);
    } finally {
      revokeMock.mock.restore();
    }

    const after = await getWorkspaceResponse(user, slug);
    assert.strictEqual(after.result.redditConnection, null);

    // The dead connection stops powering the workspace's feeds.
    const feedDoc = await ctx.connection
      .collection("userfeeds")
      .findOne({ _id: new Types.ObjectId(feed.id) });
    assert.strictEqual(feedDoc?.feedRequestLookupKey, undefined);
  });

  it("returns 404 disconnecting as a non-member", async () => {
    const ownerDiscordId = randomUUID();
    await seedWorkspaceUser(ownerDiscordId);
    const owner = await ctx.asUser(ownerDiscordId);
    const slug = `ws-${ownerDiscordId.slice(0, 8)}`;
    await createWorkspace(owner, slug);

    const outsiderDiscordId = randomUUID();
    await seedWorkspaceUser(outsiderDiscordId);
    const outsider = await ctx.asUser(outsiderDiscordId);

    const res = await outsider.fetch(
      `/api/v1/workspaces/${slug}/reddit-connection`,
      { method: "DELETE" },
    );
    assert.strictEqual(res.status, 404);
  });

  it("revokes the connection when the member who connected it leaves the workspace", async () => {
    const ownerDiscordId = randomUUID();
    await seedWorkspaceUser(ownerDiscordId);
    const owner = await ctx.asUser(ownerDiscordId);
    const slug = `ws-${ownerDiscordId.slice(0, 8)}`;
    const workspaceId = await createWorkspace(owner, slug);

    // The CONNECTOR is an admin (not the sole owner), so they can leave.
    const connectorDiscordId = randomUUID();
    const connectorUserId = await seedWorkspaceUser(connectorDiscordId);
    await addMembership(workspaceId, connectorUserId, "admin");
    const connector = await ctx.asUser(connectorDiscordId);

    const tokenMock = mockRedditTokenExchange();

    try {
      const { state, cookie } = await startRedditLogin(connector, workspaceId);
      await completeRedditCallback(cookie, { state });
    } finally {
      tokenMock.mock.restore();
    }

    mockFeedFetch(REDDIT_URL, "gaming");
    const createRes = await connector.fetch("/api/v1/user-feeds", {
      method: "POST",
      body: JSON.stringify({ url: REDDIT_URL, workspaceId }),
    });
    assert.strictEqual(createRes.status, 201);
    const { result: feed } = (await createRes.json()) as {
      result: { id: string };
    };

    const revokeMock = mock.method(
      ctx.container.redditApiService,
      "revokeRefreshToken",
      async () => {},
    );

    try {
      const res = await connector.fetch(
        `/api/v1/workspaces/${slug}/members/@me`,
        { method: "DELETE" },
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(
        revokeMock.mock.calls.length,
        1,
        "the departed member's grant must be revoked at Reddit",
      );
    } finally {
      revokeMock.mock.restore();
    }

    // The record stays (REVOKED) so the UI can show the reconnect state.
    const remaining = await getWorkspaceResponse(owner, slug);
    assert.ok(remaining.result.redditConnection);
    assert.strictEqual(remaining.result.redditConnection.status, "REVOKED");

    // Feeds stop fetching with the dead token.
    const feedDoc = await ctx.connection
      .collection("userfeeds")
      .findOne({ _id: new Types.ObjectId(feed.id) });
    assert.strictEqual(feedDoc?.feedRequestLookupKey, undefined);
  });

  it("does NOT revoke the connection when a different member leaves", async () => {
    const ownerDiscordId = randomUUID();
    await seedWorkspaceUser(ownerDiscordId);
    const owner = await ctx.asUser(ownerDiscordId);
    const slug = `ws-${ownerDiscordId.slice(0, 8)}`;
    const workspaceId = await createWorkspace(owner, slug);

    const tokenMock = mockRedditTokenExchange();

    try {
      // The OWNER connects.
      const { state, cookie } = await startRedditLogin(owner, workspaceId);
      await completeRedditCallback(cookie, { state });
    } finally {
      tokenMock.mock.restore();
    }

    // An unrelated admin joins and leaves.
    const adminDiscordId = generateSnowflake();
    const adminUserId = await seedWorkspaceUser(adminDiscordId);
    await addMembership(workspaceId, adminUserId, "admin");
    const admin = await ctx.asUser(adminDiscordId);

    const res = await admin.fetch(`/api/v1/workspaces/${slug}/members/@me`, {
      method: "DELETE",
    });
    assert.strictEqual(res.status, 200);

    const after = await getWorkspaceResponse(owner, slug);
    assert.ok(after.result.redditConnection);
    assert.strictEqual(after.result.redditConnection.status, "ACTIVE");
  });
});
