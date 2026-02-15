import { describe, it } from "node:test";
import assert from "node:assert";
import { createUserFeedConnectionEventsHarness } from "../helpers/user-feed-connection-events.harness";

describe("UserFeedConnectionEventsService", { concurrency: true }, () => {
  const harness = createUserFeedConnectionEventsHarness();

  describe("handleCreatedEvents", { concurrency: true }, () => {
    it("calls repository with mapped operations", async () => {
      const ctx = harness.createContext();
      const events = [
        {
          feedId: "feed-1",
          connectionId: "conn-1",
          creator: { discordUserId: "user-1" },
        },
        {
          feedId: "feed-2",
          connectionId: "conn-2",
          creator: { discordUserId: "user-2" },
        },
      ];

      await ctx.service.handleCreatedEvents(events);

      assert.strictEqual(
        ctx.userFeedRepository.bulkAddConnectionsToInvites.mock.calls.length,
        1,
      );
      assert.deepStrictEqual(
        ctx.userFeedRepository.bulkAddConnectionsToInvites.mock.calls[0]
          ?.arguments[0],
        [
          { feedId: "feed-1", connectionId: "conn-1", discordUserId: "user-1" },
          { feedId: "feed-2", connectionId: "conn-2", discordUserId: "user-2" },
        ],
      );
    });

    it("handles empty events array", async () => {
      const ctx = harness.createContext();

      await ctx.service.handleCreatedEvents([]);

      assert.strictEqual(
        ctx.userFeedRepository.bulkAddConnectionsToInvites.mock.calls.length,
        1,
      );
      assert.deepStrictEqual(
        ctx.userFeedRepository.bulkAddConnectionsToInvites.mock.calls[0]
          ?.arguments[0],
        [],
      );
    });

    it("does not throw when repository throws", async () => {
      const ctx = harness.createContext({
        userFeedRepository: {
          bulkAddConnectionsToInvites: () =>
            Promise.reject(new Error("DB error")),
        },
      });

      await assert.doesNotReject(async () => {
        await ctx.service.handleCreatedEvents([
          {
            feedId: "feed-1",
            connectionId: "conn-1",
            creator: { discordUserId: "user-1" },
          },
        ]);
      });
    });
  });

  describe("handleDeletedEvent", { concurrency: true }, () => {
    it("calls repository with feedId and connectionIds when shareManageOptions has invites", async () => {
      const ctx = harness.createContext();

      await ctx.service.handleDeletedEvent({
        feedId: "feed-1",
        deletedConnectionIds: ["conn-1", "conn-2"],
        shareManageOptions: {
          invites: [
            {
              discordUserId: "user-1",
              connections: [{ connectionId: "conn-1" }],
            },
          ],
        },
      });

      assert.strictEqual(
        ctx.userFeedRepository.removeConnectionsFromInvites.mock.calls.length,
        1,
      );
      assert.deepStrictEqual(
        ctx.userFeedRepository.removeConnectionsFromInvites.mock.calls[0]
          ?.arguments[0],
        { feedId: "feed-1", connectionIds: ["conn-1", "conn-2"] },
      );
    });

    it("handles empty connectionIds array when shareManageOptions has invites", async () => {
      const ctx = harness.createContext();

      await ctx.service.handleDeletedEvent({
        feedId: "feed-1",
        deletedConnectionIds: [],
        shareManageOptions: {
          invites: [{ discordUserId: "user-1" }],
        },
      });

      assert.strictEqual(
        ctx.userFeedRepository.removeConnectionsFromInvites.mock.calls.length,
        1,
      );
      assert.deepStrictEqual(
        ctx.userFeedRepository.removeConnectionsFromInvites.mock.calls[0]
          ?.arguments[0],
        { feedId: "feed-1", connectionIds: [] },
      );
    });

    it("does not call repository when shareManageOptions is undefined", async () => {
      const ctx = harness.createContext();

      await ctx.service.handleDeletedEvent({
        feedId: "feed-1",
        deletedConnectionIds: ["conn-1"],
        shareManageOptions: undefined,
      });

      assert.strictEqual(
        ctx.userFeedRepository.removeConnectionsFromInvites.mock.calls.length,
        0,
      );
    });

    it("does not call repository when shareManageOptions.invites is undefined", async () => {
      const ctx = harness.createContext();

      await ctx.service.handleDeletedEvent({
        feedId: "feed-1",
        deletedConnectionIds: ["conn-1"],
        shareManageOptions: { invites: undefined },
      });

      assert.strictEqual(
        ctx.userFeedRepository.removeConnectionsFromInvites.mock.calls.length,
        0,
      );
    });

    it("calls repository when shareManageOptions.invites is empty array", async () => {
      const ctx = harness.createContext();

      await ctx.service.handleDeletedEvent({
        feedId: "feed-1",
        deletedConnectionIds: ["conn-1"],
        shareManageOptions: { invites: [] },
      });

      assert.strictEqual(
        ctx.userFeedRepository.removeConnectionsFromInvites.mock.calls.length,
        1,
      );
    });

    it("does not throw when repository throws", async () => {
      const ctx = harness.createContext({
        userFeedRepository: {
          removeConnectionsFromInvites: () =>
            Promise.reject(new Error("DB error")),
        },
      });

      await assert.doesNotReject(async () => {
        await ctx.service.handleDeletedEvent({
          feedId: "feed-1",
          deletedConnectionIds: ["conn-1"],
          shareManageOptions: {
            invites: [{ discordUserId: "user-1" }],
          },
        });
      });
    });
  });
});
