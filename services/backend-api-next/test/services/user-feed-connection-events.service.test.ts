import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { UserFeedConnectionEventsService } from "../../src/services/user-feed-connection-events/user-feed-connection-events.service";
import type { IUserFeedRepository } from "../../src/repositories/interfaces/user-feed.types";

describe("UserFeedConnectionEventsService", () => {
  let service: UserFeedConnectionEventsService;
  let userFeedRepository: {
    bulkAddConnectionsToInvites: ReturnType<typeof mock.fn>;
    removeConnectionsFromInvites: ReturnType<typeof mock.fn>;
  };

  beforeEach(() => {
    userFeedRepository = {
      bulkAddConnectionsToInvites: mock.fn(() => Promise.resolve()),
      removeConnectionsFromInvites: mock.fn(() => Promise.resolve()),
    };

    service = new UserFeedConnectionEventsService({
      userFeedRepository: userFeedRepository as unknown as IUserFeedRepository,
    });
  });

  describe("handleCreatedEvents", () => {
    it("calls repository with mapped operations", async () => {
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

      await service.handleCreatedEvents(events);

      assert.strictEqual(
        userFeedRepository.bulkAddConnectionsToInvites.mock.calls.length,
        1
      );
      assert.deepStrictEqual(
        userFeedRepository.bulkAddConnectionsToInvites.mock.calls[0]?.arguments[0],
        [
          { feedId: "feed-1", connectionId: "conn-1", discordUserId: "user-1" },
          { feedId: "feed-2", connectionId: "conn-2", discordUserId: "user-2" },
        ]
      );
    });

    it("handles empty events array", async () => {
      await service.handleCreatedEvents([]);

      assert.strictEqual(
        userFeedRepository.bulkAddConnectionsToInvites.mock.calls.length,
        1
      );
      assert.deepStrictEqual(
        userFeedRepository.bulkAddConnectionsToInvites.mock.calls[0]?.arguments[0],
        []
      );
    });

    it("does not throw when repository throws", async () => {
      userFeedRepository.bulkAddConnectionsToInvites.mock.mockImplementation(
        () => Promise.reject(new Error("DB error"))
      );

      await assert.doesNotReject(async () => {
        await service.handleCreatedEvents([
          {
            feedId: "feed-1",
            connectionId: "conn-1",
            creator: { discordUserId: "user-1" },
          },
        ]);
      });
    });
  });

  describe("handleDeletedEvent", () => {
    it("calls repository with feedId and connectionIds when shareManageOptions has invites", async () => {
      await service.handleDeletedEvent({
        feedId: "feed-1",
        deletedConnectionIds: ["conn-1", "conn-2"],
        shareManageOptions: {
          invites: [{ discordUserId: "user-1", connections: [{ connectionId: "conn-1" }] }],
        },
      });

      assert.strictEqual(
        userFeedRepository.removeConnectionsFromInvites.mock.calls.length,
        1
      );
      assert.deepStrictEqual(
        userFeedRepository.removeConnectionsFromInvites.mock.calls[0]?.arguments[0],
        { feedId: "feed-1", connectionIds: ["conn-1", "conn-2"] }
      );
    });

    it("handles empty connectionIds array when shareManageOptions has invites", async () => {
      await service.handleDeletedEvent({
        feedId: "feed-1",
        deletedConnectionIds: [],
        shareManageOptions: {
          invites: [{ discordUserId: "user-1" }],
        },
      });

      assert.strictEqual(
        userFeedRepository.removeConnectionsFromInvites.mock.calls.length,
        1
      );
      assert.deepStrictEqual(
        userFeedRepository.removeConnectionsFromInvites.mock.calls[0]?.arguments[0],
        { feedId: "feed-1", connectionIds: [] }
      );
    });

    it("does not call repository when shareManageOptions is undefined", async () => {
      await service.handleDeletedEvent({
        feedId: "feed-1",
        deletedConnectionIds: ["conn-1"],
        shareManageOptions: undefined,
      });

      assert.strictEqual(
        userFeedRepository.removeConnectionsFromInvites.mock.calls.length,
        0
      );
    });

    it("does not call repository when shareManageOptions.invites is undefined", async () => {
      await service.handleDeletedEvent({
        feedId: "feed-1",
        deletedConnectionIds: ["conn-1"],
        shareManageOptions: { invites: undefined },
      });

      assert.strictEqual(
        userFeedRepository.removeConnectionsFromInvites.mock.calls.length,
        0
      );
    });

    it("calls repository when shareManageOptions.invites is empty array", async () => {
      await service.handleDeletedEvent({
        feedId: "feed-1",
        deletedConnectionIds: ["conn-1"],
        shareManageOptions: { invites: [] },
      });

      assert.strictEqual(
        userFeedRepository.removeConnectionsFromInvites.mock.calls.length,
        1
      );
    });

    it("does not throw when repository throws", async () => {
      userFeedRepository.removeConnectionsFromInvites.mock.mockImplementation(
        () => Promise.reject(new Error("DB error"))
      );

      await assert.doesNotReject(async () => {
        await service.handleDeletedEvent({
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
