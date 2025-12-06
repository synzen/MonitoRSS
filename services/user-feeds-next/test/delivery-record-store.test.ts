import { describe, it, expect, beforeEach } from "bun:test";
import {
  createInMemoryDeliveryRecordStore,
  ArticleDeliveryStatus,
  ArticleDeliveryErrorCode,
  ArticleDeliveryContentType,
  type ArticleDeliveryState,
  generateDeliveryId,
  resultToState,
} from "../src/delivery-record-store";

describe("Delivery Record Store", () => {
  describe("createInMemoryDeliveryRecordStore", () => {
    let store: ReturnType<typeof createInMemoryDeliveryRecordStore>;

    beforeEach(() => {
      store = createInMemoryDeliveryRecordStore();
    });

    it("should require context for store", async () => {
      const state: ArticleDeliveryState = {
        id: "delivery-1",
        status: ArticleDeliveryStatus.Sent,
        mediumId: "medium-1",
        articleIdHash: "hash-1",
        article: null,
      };

      await expect(store.store("feed-1", [state])).rejects.toThrow(
        "No context was started for DeliveryRecordStore"
      );
    });

    it("should require context for flushPendingInserts", async () => {
      await expect(store.flushPendingInserts()).rejects.toThrow(
        "No context was started for DeliveryRecordStore"
      );
    });

    it("should store sent articles correctly", async () => {
      const states: ArticleDeliveryState[] = [
        {
          id: "delivery-1",
          status: ArticleDeliveryStatus.Sent,
          mediumId: "medium-1",
          articleIdHash: "hash-1",
          article: null,
        },
        {
          id: "delivery-2",
          status: ArticleDeliveryStatus.Sent,
          mediumId: "medium-1",
          articleIdHash: "hash-2",
          article: null,
        },
      ];

      const result = await store.startContext(async () => {
        return store.store("feed-1", states, true);
      });

      expect(result?.inserted).toBe(2);
      expect(store._records.size).toBe(2);
    });

    it("should store failed articles correctly", async () => {
      const states: ArticleDeliveryState[] = [
        {
          id: "delivery-1",
          status: ArticleDeliveryStatus.Failed,
          mediumId: "medium-1",
          articleIdHash: "hash-1",
          article: null,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          internalMessage: "No channel found",
        },
      ];

      await store.startContext(async () => {
        await store.store("feed-1", states, true);
      });

      const record = store._records.get("delivery-1");
      expect(record).toBeDefined();
      expect(record?.status).toBe(ArticleDeliveryStatus.Failed);
      expect(record?.errorCode).toBe(
        ArticleDeliveryErrorCode.NoChannelOrWebhook
      );
      expect(record?.internalMessage).toBe("No channel found");
    });

    it("should store rejected articles correctly", async () => {
      const states: ArticleDeliveryState[] = [
        {
          id: "delivery-1",
          status: ArticleDeliveryStatus.Rejected,
          mediumId: "medium-1",
          articleIdHash: "hash-1",
          article: null,
          errorCode: ArticleDeliveryErrorCode.ThirdPartyBadRequest,
          internalMessage: "Bad request body",
          externalDetail: '{"message": "Invalid embed"}',
        },
      ];

      await store.startContext(async () => {
        await store.store("feed-1", states, true);
      });

      const record = store._records.get("delivery-1");
      expect(record).toBeDefined();
      expect(record?.status).toBe(ArticleDeliveryStatus.Rejected);
      expect(record?.externalDetail).toBe('{"message": "Invalid embed"}');
    });

    it("should store pending delivery states correctly", async () => {
      const states: ArticleDeliveryState[] = [
        {
          id: "delivery-1",
          status: ArticleDeliveryStatus.PendingDelivery,
          mediumId: "medium-1",
          articleIdHash: "hash-1",
          article: null,
          contentType: ArticleDeliveryContentType.DiscordArticleMessage,
        },
      ];

      await store.startContext(async () => {
        await store.store("feed-1", states, true);
      });

      const record = store._records.get("delivery-1");
      expect(record).toBeDefined();
      expect(record?.status).toBe(ArticleDeliveryStatus.PendingDelivery);
      expect(record?.contentType).toBe(
        ArticleDeliveryContentType.DiscordArticleMessage
      );
    });

    it("should store filtered out articles correctly", async () => {
      const states: ArticleDeliveryState[] = [
        {
          id: "delivery-1",
          status: ArticleDeliveryStatus.FilteredOut,
          mediumId: "medium-1",
          articleIdHash: "hash-1",
          article: null,
          externalDetail: '{"explainBlocked": ["title contains banned"]}',
        },
      ];

      await store.startContext(async () => {
        await store.store("feed-1", states, true);
      });

      const record = store._records.get("delivery-1");
      expect(record).toBeDefined();
      expect(record?.status).toBe(ArticleDeliveryStatus.FilteredOut);
      expect(record?.externalDetail).toBe(
        '{"explainBlocked": ["title contains banned"]}'
      );
    });

    it("should store rate limited articles correctly", async () => {
      const states: ArticleDeliveryState[] = [
        {
          id: "delivery-1",
          status: ArticleDeliveryStatus.RateLimited,
          mediumId: "medium-1",
          articleIdHash: "hash-1",
          article: null,
        },
        {
          id: "delivery-2",
          status: ArticleDeliveryStatus.MediumRateLimitedByUser,
          mediumId: "medium-1",
          articleIdHash: "hash-2",
          article: null,
        },
      ];

      await store.startContext(async () => {
        await store.store("feed-1", states, true);
      });

      expect(store._records.get("delivery-1")?.status).toBe(
        ArticleDeliveryStatus.RateLimited
      );
      expect(store._records.get("delivery-2")?.status).toBe(
        ArticleDeliveryStatus.MediumRateLimitedByUser
      );
    });

    it("should batch inserts when flush=false", async () => {
      const states1: ArticleDeliveryState[] = [
        {
          id: "delivery-1",
          status: ArticleDeliveryStatus.Sent,
          mediumId: "medium-1",
          articleIdHash: "hash-1",
          article: null,
        },
      ];
      const states2: ArticleDeliveryState[] = [
        {
          id: "delivery-2",
          status: ArticleDeliveryStatus.Sent,
          mediumId: "medium-1",
          articleIdHash: "hash-2",
          article: null,
        },
      ];

      await store.startContext(async () => {
        // Store without flushing
        await store.store("feed-1", states1, false);
        expect(store._records.size).toBe(0); // Not persisted yet

        await store.store("feed-1", states2, false);
        expect(store._records.size).toBe(0); // Still not persisted

        // Now flush
        const { affectedRows } = await store.flushPendingInserts();
        expect(affectedRows).toBe(2);
        expect(store._records.size).toBe(2);
      });
    });

    it("should clear pending inserts after flush", async () => {
      await store.startContext(async () => {
        await store.store(
          "feed-1",
          [
            {
              id: "delivery-1",
              status: ArticleDeliveryStatus.Sent,
              mediumId: "medium-1",
              articleIdHash: "hash-1",
              article: null,
            },
          ],
          false
        );

        await store.flushPendingInserts();

        // Second flush should have nothing
        const { affectedRows } = await store.flushPendingInserts();
        expect(affectedRows).toBe(0);
      });
    });

    it("should store article data when article has title", async () => {
      const states: ArticleDeliveryState[] = [
        {
          id: "delivery-1",
          status: ArticleDeliveryStatus.Sent,
          mediumId: "medium-1",
          articleIdHash: "hash-1",
          article: {
            flattened: {
              id: "article-1",
              idHash: "hash-1",
              title: "Test Title",
            },
            raw: {},
          },
        },
      ];

      await store.startContext(async () => {
        await store.store("feed-1", states, true);
      });

      const record = store._records.get("delivery-1");
      expect(record?.articleData).toEqual({ title: "Test Title" });
    });
  });

  describe("updateDeliveryStatus", () => {
    let store: ReturnType<typeof createInMemoryDeliveryRecordStore>;

    beforeEach(() => {
      store = createInMemoryDeliveryRecordStore();
    });

    it("should update the status of a delivery record", async () => {
      // First insert a record
      await store.startContext(async () => {
        await store.store(
          "feed-1",
          [
            {
              id: "delivery-1",
              status: ArticleDeliveryStatus.PendingDelivery,
              mediumId: "medium-1",
              articleIdHash: "hash-1",
              article: null,
              contentType: ArticleDeliveryContentType.DiscordArticleMessage,
            },
          ],
          true
        );
      });

      // Update the status
      const result = await store.updateDeliveryStatus("delivery-1", {
        status: ArticleDeliveryStatus.Sent,
      });

      expect(result.status).toBe(ArticleDeliveryStatus.Sent);
      expect(result.feed_id).toBe("feed-1");
      expect(result.medium_id).toBe("medium-1");
    });

    it("should update error code and internal message", async () => {
      await store.startContext(async () => {
        await store.store(
          "feed-1",
          [
            {
              id: "delivery-1",
              status: ArticleDeliveryStatus.PendingDelivery,
              mediumId: "medium-1",
              articleIdHash: "hash-1",
              article: null,
              contentType: ArticleDeliveryContentType.DiscordArticleMessage,
            },
          ],
          true
        );
      });

      const result = await store.updateDeliveryStatus("delivery-1", {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyInternal,
        internalMessage: "Discord returned 500",
      });

      expect(result.status).toBe(ArticleDeliveryStatus.Failed);
      expect(result.error_code).toBe(
        ArticleDeliveryErrorCode.ThirdPartyInternal
      );
      expect(result.internal_message).toBe("Discord returned 500");
    });

    it("should throw if record not found", async () => {
      await expect(
        store.updateDeliveryStatus("non-existent", {
          status: ArticleDeliveryStatus.Sent,
        })
      ).rejects.toThrow("Record not found");
    });
  });

  describe("countDeliveriesInPastTimeframe", () => {
    let store: ReturnType<typeof createInMemoryDeliveryRecordStore>;

    beforeEach(() => {
      store = createInMemoryDeliveryRecordStore();
    });

    it("should count only sent deliveries", async () => {
      await store.startContext(async () => {
        await store.store(
          "feed-1",
          [
            {
              id: "delivery-1",
              status: ArticleDeliveryStatus.Sent,
              mediumId: "medium-1",
              articleIdHash: "hash-1",
              article: null,
            },
            {
              id: "delivery-2",
              status: ArticleDeliveryStatus.Failed,
              mediumId: "medium-1",
              articleIdHash: "hash-2",
              article: null,
              errorCode: ArticleDeliveryErrorCode.Internal,
              internalMessage: "Error",
            },
            {
              id: "delivery-3",
              status: ArticleDeliveryStatus.Sent,
              mediumId: "medium-1",
              articleIdHash: "hash-3",
              article: null,
            },
          ],
          true
        );
      });

      const count = await store.countDeliveriesInPastTimeframe({}, 3600);
      expect(count).toBe(2); // Only the 2 sent deliveries
    });

    it("should filter by feedId", async () => {
      await store.startContext(async () => {
        await store.store(
          "feed-1",
          [
            {
              id: "delivery-1",
              status: ArticleDeliveryStatus.Sent,
              mediumId: "medium-1",
              articleIdHash: "hash-1",
              article: null,
            },
          ],
          true
        );
        await store.store(
          "feed-2",
          [
            {
              id: "delivery-2",
              status: ArticleDeliveryStatus.Sent,
              mediumId: "medium-1",
              articleIdHash: "hash-2",
              article: null,
            },
          ],
          true
        );
      });

      const count = await store.countDeliveriesInPastTimeframe(
        { feedId: "feed-1" },
        3600
      );
      expect(count).toBe(1);
    });

    it("should filter by mediumId", async () => {
      await store.startContext(async () => {
        await store.store(
          "feed-1",
          [
            {
              id: "delivery-1",
              status: ArticleDeliveryStatus.Sent,
              mediumId: "medium-1",
              articleIdHash: "hash-1",
              article: null,
            },
            {
              id: "delivery-2",
              status: ArticleDeliveryStatus.Sent,
              mediumId: "medium-2",
              articleIdHash: "hash-2",
              article: null,
            },
          ],
          true
        );
      });

      const count = await store.countDeliveriesInPastTimeframe(
        { mediumId: "medium-1" },
        3600
      );
      expect(count).toBe(1);
    });

    it("should filter by both feedId and mediumId", async () => {
      await store.startContext(async () => {
        await store.store(
          "feed-1",
          [
            {
              id: "delivery-1",
              status: ArticleDeliveryStatus.Sent,
              mediumId: "medium-1",
              articleIdHash: "hash-1",
              article: null,
            },
            {
              id: "delivery-2",
              status: ArticleDeliveryStatus.Sent,
              mediumId: "medium-2",
              articleIdHash: "hash-2",
              article: null,
            },
          ],
          true
        );
        await store.store(
          "feed-2",
          [
            {
              id: "delivery-3",
              status: ArticleDeliveryStatus.Sent,
              mediumId: "medium-1",
              articleIdHash: "hash-3",
              article: null,
            },
          ],
          true
        );
      });

      const count = await store.countDeliveriesInPastTimeframe(
        { feedId: "feed-1", mediumId: "medium-1" },
        3600
      );
      expect(count).toBe(1);
    });
  });

  describe("generateDeliveryId", () => {
    it("should generate unique UUIDs", () => {
      const id1 = generateDeliveryId();
      const id2 = generateDeliveryId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  describe("resultToState", () => {
    const mockArticle = {
      flattened: { id: "article-1", idHash: "hash-1", title: "Test" },
      raw: {},
    };

    it("should convert Sent result to state", () => {
      const state = resultToState({
        status: ArticleDeliveryStatus.Sent,
        article: mockArticle,
        mediumId: "medium-1",
      });

      expect(state.status).toBe(ArticleDeliveryStatus.Sent);
      expect(state.articleIdHash).toBe("hash-1");
      expect(state.mediumId).toBe("medium-1");
      expect(state.id).toBeDefined();
    });

    it("should convert Failed result to state", () => {
      const state = resultToState({
        status: ArticleDeliveryStatus.Failed,
        article: mockArticle,
        mediumId: "medium-1",
        message: "Connection failed",
        errorCode: ArticleDeliveryErrorCode.ThirdPartyInternal,
      });

      expect(state.status).toBe(ArticleDeliveryStatus.Failed);
      if (state.status === ArticleDeliveryStatus.Failed) {
        expect(state.errorCode).toBe(
          ArticleDeliveryErrorCode.ThirdPartyInternal
        );
        expect(state.internalMessage).toBe("Connection failed");
      }
    });

    it("should convert FilteredOut result to state", () => {
      const state = resultToState({
        status: ArticleDeliveryStatus.FilteredOut,
        article: mockArticle,
        mediumId: "medium-1",
        externalDetail: '{"blocked": true}',
      });

      expect(state.status).toBe(ArticleDeliveryStatus.FilteredOut);
      if (state.status === ArticleDeliveryStatus.FilteredOut) {
        expect(state.externalDetail).toBe('{"blocked": true}');
      }
    });

    it("should convert RateLimited result to state", () => {
      const state = resultToState({
        status: ArticleDeliveryStatus.RateLimited,
        article: mockArticle,
        mediumId: "medium-1",
      });

      expect(state.status).toBe(ArticleDeliveryStatus.RateLimited);
    });

    it("should use provided id if given", () => {
      const state = resultToState(
        {
          status: ArticleDeliveryStatus.Sent,
          article: mockArticle,
          mediumId: "medium-1",
        },
        "custom-id-123"
      );

      expect(state.id).toBe("custom-id-123");
    });
  });
});
