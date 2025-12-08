import { describe, it, expect, beforeEach } from "bun:test";
import {
  inMemoryResponseHashStore,
  clearResponseHashStore,
  parseFeedDeletedEvent,
  handleFeedDeletedEvent,
  type ResponseHashStore,
} from "../src/feeds/feed-event-handler";
import {
  clearArticleFieldStore,
  type ArticleFieldStore,
} from "../src/articles/comparison";

describe("response-hash", () => {
  describe("inMemoryResponseHashStore", () => {
    beforeEach(() => {
      clearResponseHashStore();
    });

    it("returns null for non-existent feed", async () => {
      const result = await inMemoryResponseHashStore.get("non-existent-feed");
      expect(result).toBeNull();
    });

    it("stores and retrieves a hash", async () => {
      await inMemoryResponseHashStore.set("feed-1", "hash-abc");
      const result = await inMemoryResponseHashStore.get("feed-1");
      expect(result).toBe("hash-abc");
    });

    it("overwrites existing hash", async () => {
      await inMemoryResponseHashStore.set("feed-1", "hash-abc");
      await inMemoryResponseHashStore.set("feed-1", "hash-xyz");
      const result = await inMemoryResponseHashStore.get("feed-1");
      expect(result).toBe("hash-xyz");
    });

    it("removes a hash", async () => {
      await inMemoryResponseHashStore.set("feed-1", "hash-abc");
      await inMemoryResponseHashStore.remove("feed-1");
      const result = await inMemoryResponseHashStore.get("feed-1");
      expect(result).toBeNull();
    });

    it("remove is idempotent for non-existent feed", async () => {
      // Should not throw
      await inMemoryResponseHashStore.remove("non-existent-feed");
    });

    it("throws error when setting empty hash", async () => {
      await expect(inMemoryResponseHashStore.set("feed-1", "")).rejects.toThrow(
        "Hash is required"
      );
    });

    it("isolates hashes by feed ID", async () => {
      await inMemoryResponseHashStore.set("feed-1", "hash-a");
      await inMemoryResponseHashStore.set("feed-2", "hash-b");

      expect(await inMemoryResponseHashStore.get("feed-1")).toBe("hash-a");
      expect(await inMemoryResponseHashStore.get("feed-2")).toBe("hash-b");

      await inMemoryResponseHashStore.remove("feed-1");
      expect(await inMemoryResponseHashStore.get("feed-1")).toBeNull();
      expect(await inMemoryResponseHashStore.get("feed-2")).toBe("hash-b");
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
      expect(result).toEqual(event);
    });

    it("returns null for invalid event (missing feed)", () => {
      const event = {
        data: {},
      };

      const result = parseFeedDeletedEvent(event);
      expect(result).toBeNull();
    });

    it("returns null for invalid event (missing data)", () => {
      const event = {};

      const result = parseFeedDeletedEvent(event);
      expect(result).toBeNull();
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
      expect(result).toBeNull();
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

      expect(removedFeedIds).toEqual(["feed-to-delete"]);
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

      expect(clearedFeedIds).toEqual(["feed-to-delete"]);
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
      expect(await inMemoryResponseHashStore.get("feed-xyz")).toBeNull();
    });
  });
});
