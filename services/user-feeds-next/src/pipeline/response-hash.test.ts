import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import {
  parseFeedDeletedEvent,
  handleFeedDeletedEvent,
  type ResponseHashStore,
} from "./feed-event-handler";
import { type ArticleFieldStore } from "../articles/comparison";
import { type FeedRetryStore } from "../stores/interfaces/feed-retry-store";
import {
  setupTestDatabase,
  teardownTestDatabase,
  type TestStores,
} from "../../test/helpers/setup-integration-tests";

let stores: TestStores;

before(async () => {
  stores = await setupTestDatabase();
});

after(async () => {
  await teardownTestDatabase();
});

describe("response-hash", () => {
  describe("ResponseHashStore", () => {
    let store: ResponseHashStore;

    beforeEach(async () => {
      await stores.truncate();
      store = stores.responseHashStore;
    });

    it("returns null for non-existent feed", async () => {
      const result = await store.get("non-existent-feed");
      assert.strictEqual(result, null);
    });

    it("stores and retrieves a hash", async () => {
      await store.set("feed-1", "hash-abc");
      const result = await store.get("feed-1");
      assert.strictEqual(result, "hash-abc");
    });

    it("overwrites existing hash", async () => {
      await store.set("feed-1", "hash-abc");
      await store.set("feed-1", "hash-xyz");
      const result = await store.get("feed-1");
      assert.strictEqual(result, "hash-xyz");
    });

    it("removes a hash", async () => {
      await store.set("feed-1", "hash-abc");
      await store.remove("feed-1");
      const result = await store.get("feed-1");
      assert.strictEqual(result, null);
    });

    it("remove is idempotent for non-existent feed", async () => {
      await store.remove("non-existent-feed");
    });

    it("throws error when setting empty hash", async () => {
      await assert.rejects(
        store.set("feed-1", ""),
        { message: /Hash is required/ }
      );
    });

    it("isolates hashes by feed ID", async () => {
      await store.set("feed-1", "hash-a");
      await store.set("feed-2", "hash-b");

      assert.strictEqual(await store.get("feed-1"), "hash-a");
      assert.strictEqual(await store.get("feed-2"), "hash-b");

      await store.remove("feed-1");
      assert.strictEqual(await store.get("feed-1"), null);
      assert.strictEqual(await store.get("feed-2"), "hash-b");
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
    let mockFeedRetryStore: FeedRetryStore;
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
        findStoredArticleDates: async () => new Map(),
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

      mockFeedRetryStore = {
        get: async () => null,
        upsert: async () => {},
        remove: async () => {},
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
        feedRetryStore: mockFeedRetryStore,
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
        feedRetryStore: mockFeedRetryStore,
      });

      assert.deepStrictEqual(clearedFeedIds, ["feed-to-delete"]);
    });
  });
});
