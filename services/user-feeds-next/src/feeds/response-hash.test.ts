import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  inMemoryResponseHashStore,
  clearResponseHashStore,
  parseFeedDeletedEvent,
  handleFeedDeletedEvent,
  type ResponseHashStore,
} from "./feed-event-handler";
import {
  clearArticleFieldStore,
  type ArticleFieldStore,
} from "../articles/comparison";

describe("response-hash", { concurrency: true }, () => {
  describe("inMemoryResponseHashStore", () => {
    beforeEach(() => {
      clearResponseHashStore();
    });

    it("returns null for non-existent feed", async () => {
      const result = await inMemoryResponseHashStore.get("non-existent-feed");
      assert.strictEqual(result, null);
    });

    it("stores and retrieves a hash", async () => {
      await inMemoryResponseHashStore.set("feed-1", "hash-abc");
      const result = await inMemoryResponseHashStore.get("feed-1");
      assert.strictEqual(result, "hash-abc");
    });

    it("overwrites existing hash", async () => {
      await inMemoryResponseHashStore.set("feed-1", "hash-abc");
      await inMemoryResponseHashStore.set("feed-1", "hash-xyz");
      const result = await inMemoryResponseHashStore.get("feed-1");
      assert.strictEqual(result, "hash-xyz");
    });

    it("removes a hash", async () => {
      await inMemoryResponseHashStore.set("feed-1", "hash-abc");
      await inMemoryResponseHashStore.remove("feed-1");
      const result = await inMemoryResponseHashStore.get("feed-1");
      assert.strictEqual(result, null);
    });

    it("remove is idempotent for non-existent feed", async () => {
      // Should not throw
      await inMemoryResponseHashStore.remove("non-existent-feed");
    });

    it("throws error when setting empty hash", async () => {
      await assert.rejects(
        inMemoryResponseHashStore.set("feed-1", ""),
        { message: /Hash is required/ }
      );
    });

    it("isolates hashes by feed ID", async () => {
      await inMemoryResponseHashStore.set("feed-1", "hash-a");
      await inMemoryResponseHashStore.set("feed-2", "hash-b");

      assert.strictEqual(await inMemoryResponseHashStore.get("feed-1"), "hash-a");
      assert.strictEqual(await inMemoryResponseHashStore.get("feed-2"), "hash-b");

      await inMemoryResponseHashStore.remove("feed-1");
      assert.strictEqual(await inMemoryResponseHashStore.get("feed-1"), null);
      assert.strictEqual(await inMemoryResponseHashStore.get("feed-2"), "hash-b");
    });
  });

  describe("parseFeedDeletedEvent", () => {
    it("parses valid feed deleted event", () => {
      const event = {
        data: {
          feed: {
            id: "feed-123",
          },
        },
      };

      const result = parseFeedDeletedEvent(event);
      assert.deepStrictEqual(result, event);
    });

    it("returns null for invalid event (missing feed)", () => {
      const event = {
        data: {},
      };

      const result = parseFeedDeletedEvent(event);
      assert.strictEqual(result, null);
    });

    it("returns null for invalid event (missing data)", () => {
      const event = {};

      const result = parseFeedDeletedEvent(event);
      assert.strictEqual(result, null);
    });

    it("returns null for invalid event (non-string id)", () => {
      const event = {
        data: {
          feed: {
            id: 123,
          },
        },
      };

      const result = parseFeedDeletedEvent(event);
      assert.strictEqual(result, null);
    });
  });

  describe("handleFeedDeletedEvent", () => {
    let mockResponseHashStore: ResponseHashStore;
    let mockArticleFieldStore: ArticleFieldStore;
    let removedFeedIds: string[];
    let clearedFeedIds: string[];

    beforeEach(() => {
      removedFeedIds = [];
      clearedFeedIds = [];

      mockResponseHashStore = {
        get: async () => null,
        set: async () => {},
        remove: async (feedId: string) => {
          removedFeedIds.push(feedId);
        },
      };

      mockArticleFieldStore = {
        startContext: async <T>(cb: () => Promise<T>) => cb(),
        hasPriorArticlesStored: async () => false,
        findStoredArticleIds: async () => new Set(),
        findStoredArticleIdsPartitioned: async () => new Set(),
        someFieldsExist: async () => false,
        storeArticles: async () => {},
        getStoredComparisonNames: async () => new Set(),
        storeComparisonNames: async () => {},
        clear: async (feedId: string) => {
          clearedFeedIds.push(feedId);
        },
        flushPendingInserts: async () => {
          return { affectedRows: 0 };
        },
      };
    });

    it("removes response hash for the feed", async () => {
      const event = {
        data: {
          feed: {
            id: "feed-to-delete",
          },
        },
      };

      await handleFeedDeletedEvent(event, {
        responseHashStore: mockResponseHashStore,
        articleFieldStore: mockArticleFieldStore,
      });

      assert.deepStrictEqual(removedFeedIds, ["feed-to-delete"]);
    });

    it("clears article field store for the feed", async () => {
      const event = {
        data: {
          feed: {
            id: "feed-to-delete",
          },
        },
      };

      await handleFeedDeletedEvent(event, {
        responseHashStore: mockResponseHashStore,
        articleFieldStore: mockArticleFieldStore,
      });

      assert.deepStrictEqual(clearedFeedIds, ["feed-to-delete"]);
    });

    it("uses default stores when none provided", async () => {
      // Clear the in-memory stores
      clearResponseHashStore();
      clearArticleFieldStore();

      // Set up some data
      await inMemoryResponseHashStore.set("feed-xyz", "some-hash");

      const event = {
        data: {
          feed: {
            id: "feed-xyz",
          },
        },
      };

      await handleFeedDeletedEvent(event);

      // Verify hash was removed
      assert.strictEqual(await inMemoryResponseHashStore.get("feed-xyz"), null);
    });
  });
});
