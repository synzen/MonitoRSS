import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { Types } from "mongoose";
import {
  setupTestDatabase,
  teardownTestDatabase,
} from "../helpers/setup-test-database";
import { createTestContext, type TestContext } from "../helpers/test-context";
import type { IUserFeed } from "../../src/repositories/interfaces/user-feed.types";

function objectId(): string {
  return new Types.ObjectId().toHexString();
}

interface TestFeedOptions {
  invites?: Array<{
    discordUserId: string;
    connections?: string[];
  }>;
}

async function createFeed(ctx: TestContext, options: TestFeedOptions = {}): Promise<IUserFeed> {
  return ctx.container.userFeedRepository.create({
    title: "Test Feed",
    url: `https://example.com/feed/${objectId()}`,
    user: { discordUserId: objectId() },
    shareManageOptions: options.invites
      ? {
          invites: options.invites.map((invite) => ({
            discordUserId: invite.discordUserId,
            connections: invite.connections?.map((id) => ({ connectionId: id })),
          })),
        }
      : undefined,
  });
}

async function getFeed(ctx: TestContext, id: string): Promise<IUserFeed | null> {
  return ctx.container.userFeedRepository.findById(id);
}

function getInvite(feed: IUserFeed | null, discordUserId: string) {
  return feed?.shareManageOptions?.invites.find(
    (i) => i.discordUserId === discordUserId
  );
}

describe("UserFeedConnectionEventsService Integration", { concurrency: true }, () => {
  let ctx: TestContext;

  before(async () => {
    const mongoConnection = await setupTestDatabase();
    ctx = await createTestContext({ mongoConnection });
  });

  after(async () => {
    await ctx.close();
    await teardownTestDatabase();
  });

  describe("handleCreatedEvents", { concurrency: true }, () => {
    it("adds connection to matching invite", async () => {
      const newConnectionId = objectId();
      const user1 = objectId();
      const user2 = objectId();

      const feed = await createFeed(ctx, {
        invites: [
          { discordUserId: user1, connections: [] },
          { discordUserId: user2, connections: [] },
        ],
      });

      await ctx.container.userFeedConnectionEventsService.handleCreatedEvents([
        { feedId: feed.id, connectionId: newConnectionId, creator: { discordUserId: user1 } },
      ]);

      const updated = await getFeed(ctx, feed.id);
      const invite1 = getInvite(updated, user1);
      const invite2 = getInvite(updated, user2);

      assert.strictEqual(invite1?.connections?.length, 1);
      assert.strictEqual(invite1?.connections?.[0]?.connectionId, newConnectionId);
      assert.strictEqual(invite2?.connections?.length, 0);
    });

    it("adds multiple connections to different invites in bulk", async () => {
      const conn1 = objectId();
      const conn2 = objectId();
      const user1 = objectId();
      const user2 = objectId();

      const feed = await createFeed(ctx, {
        invites: [
          { discordUserId: user1, connections: [] },
          { discordUserId: user2, connections: [] },
        ],
      });

      await ctx.container.userFeedConnectionEventsService.handleCreatedEvents([
        { feedId: feed.id, connectionId: conn1, creator: { discordUserId: user1 } },
        { feedId: feed.id, connectionId: conn2, creator: { discordUserId: user2 } },
      ]);

      const updated = await getFeed(ctx, feed.id);
      const invite1 = getInvite(updated, user1);
      const invite2 = getInvite(updated, user2);

      assert.strictEqual(invite1?.connections?.length, 1);
      assert.strictEqual(invite1?.connections?.[0]?.connectionId, conn1);
      assert.strictEqual(invite2?.connections?.length, 1);
      assert.strictEqual(invite2?.connections?.[0]?.connectionId, conn2);
    });

    it("does not add connection when discordUserId does not match any invite", async () => {
      const existingUser = objectId();

      const feed = await createFeed(ctx, {
        invites: [{ discordUserId: existingUser, connections: [] }],
      });

      await ctx.container.userFeedConnectionEventsService.handleCreatedEvents([
        { feedId: feed.id, connectionId: objectId(), creator: { discordUserId: objectId() } },
      ]);

      const updated = await getFeed(ctx, feed.id);
      const invite = getInvite(updated, existingUser);

      assert.strictEqual(invite?.connections?.length, 0);
    });

    it("handles empty events array without error", async () => {
      await assert.doesNotReject(() =>
        ctx.container.userFeedConnectionEventsService.handleCreatedEvents([])
      );
    });

    it("handles feed without shareManageOptions", async () => {
      const feed = await createFeed(ctx);

      await assert.doesNotReject(() =>
        ctx.container.userFeedConnectionEventsService.handleCreatedEvents([
          { feedId: feed.id, connectionId: objectId(), creator: { discordUserId: objectId() } },
        ])
      );
    });
  });

  describe("handleDeletedEvent", { concurrency: true }, () => {
    it("removes connections from all invites", async () => {
      const connToDelete = objectId();
      const connToKeep = objectId();
      const anotherToKeep = objectId();
      const user1 = objectId();
      const user2 = objectId();

      const feed = await createFeed(ctx, {
        invites: [
          { discordUserId: user1, connections: [connToDelete, connToKeep] },
          { discordUserId: user2, connections: [connToDelete, anotherToKeep] },
        ],
      });

      await ctx.container.userFeedConnectionEventsService.handleDeletedEvent({
        feedId: feed.id,
        deletedConnectionIds: [connToDelete],
        shareManageOptions: feed.shareManageOptions,
      });

      const updated = await getFeed(ctx, feed.id);
      const invite1 = getInvite(updated, user1);
      const invite2 = getInvite(updated, user2);

      assert.strictEqual(invite1?.connections?.length, 1);
      assert.strictEqual(invite1?.connections?.[0]?.connectionId, connToKeep);
      assert.strictEqual(invite2?.connections?.length, 1);
      assert.strictEqual(invite2?.connections?.[0]?.connectionId, anotherToKeep);
    });

    it("removes multiple connections at once", async () => {
      const delete1 = objectId();
      const delete2 = objectId();
      const keep1 = objectId();
      const user1 = objectId();

      const feed = await createFeed(ctx, {
        invites: [{ discordUserId: user1, connections: [delete1, delete2, keep1] }],
      });

      await ctx.container.userFeedConnectionEventsService.handleDeletedEvent({
        feedId: feed.id,
        deletedConnectionIds: [delete1, delete2],
        shareManageOptions: feed.shareManageOptions,
      });

      const updated = await getFeed(ctx, feed.id);
      const invite = getInvite(updated, user1);

      assert.strictEqual(invite?.connections?.length, 1);
      assert.strictEqual(invite?.connections?.[0]?.connectionId, keep1);
    });

    it("skips database call when shareManageOptions is undefined", async () => {
      const feed = await createFeed(ctx);

      await assert.doesNotReject(() =>
        ctx.container.userFeedConnectionEventsService.handleDeletedEvent({
          feedId: feed.id,
          deletedConnectionIds: [objectId()],
          shareManageOptions: undefined,
        })
      );
    });

    it("skips database call when shareManageOptions.invites is undefined", async () => {
      const feed = await createFeed(ctx);

      await assert.doesNotReject(() =>
        ctx.container.userFeedConnectionEventsService.handleDeletedEvent({
          feedId: feed.id,
          deletedConnectionIds: [objectId()],
          shareManageOptions: { invites: undefined },
        })
      );
    });

    it("handles empty invites array", async () => {
      const feed = await createFeed(ctx, { invites: [] });

      await assert.doesNotReject(() =>
        ctx.container.userFeedConnectionEventsService.handleDeletedEvent({
          feedId: feed.id,
          deletedConnectionIds: [objectId()],
          shareManageOptions: { invites: [] },
        })
      );

      const updated = await getFeed(ctx, feed.id);
      assert.deepStrictEqual(updated?.shareManageOptions?.invites, []);
    });

    it("handles empty deletedConnectionIds array", async () => {
      const existingConn = objectId();
      const user1 = objectId();

      const feed = await createFeed(ctx, {
        invites: [{ discordUserId: user1, connections: [existingConn] }],
      });

      await ctx.container.userFeedConnectionEventsService.handleDeletedEvent({
        feedId: feed.id,
        deletedConnectionIds: [],
        shareManageOptions: feed.shareManageOptions,
      });

      const updated = await getFeed(ctx, feed.id);
      const invite = getInvite(updated, user1);

      assert.strictEqual(invite?.connections?.length, 1);
      assert.strictEqual(invite?.connections?.[0]?.connectionId, existingConn);
    });

    it("handles non-existent connection IDs gracefully", async () => {
      const existingConn = objectId();
      const user1 = objectId();

      const feed = await createFeed(ctx, {
        invites: [{ discordUserId: user1, connections: [existingConn] }],
      });

      await assert.doesNotReject(() =>
        ctx.container.userFeedConnectionEventsService.handleDeletedEvent({
          feedId: feed.id,
          deletedConnectionIds: [objectId()],
          shareManageOptions: feed.shareManageOptions,
        })
      );

      const updated = await getFeed(ctx, feed.id);
      const invite = getInvite(updated, user1);

      assert.strictEqual(invite?.connections?.length, 1);
      assert.strictEqual(invite?.connections?.[0]?.connectionId, existingConn);
    });
  });
});
