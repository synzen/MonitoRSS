import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { createInMemoryDeliveryRecordStore } from "./delivery-record-store";
import {
  ArticleDeliveryStatus,
  ArticleDeliveryErrorCode,
  ArticleDeliveryContentType,
  type ArticleDeliveryState,
  generateDeliveryId,
} from "../interfaces/delivery-record-store";

describe("Delivery Record Store", { concurrency: true }, () => {
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

      await assert.rejects(
        store.store("feed-1", [state]),
        { message: /No context was started for DeliveryRecordStore/ }
      );
    });

    it("should require context for flushPendingInserts", async () => {
      await assert.rejects(
        store.flushPendingInserts(),
        { message: /No context was started for DeliveryRecordStore/ }
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

      assert.strictEqual(result?.inserted, 2);
      assert.strictEqual(store._records.size, 2);
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
      assert.notStrictEqual(record, undefined);
      assert.strictEqual(record?.status, ArticleDeliveryStatus.Failed);
      assert.strictEqual(record?.errorCode, ArticleDeliveryErrorCode.NoChannelOrWebhook);
      assert.strictEqual(record?.internalMessage, "No channel found");
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
      assert.notStrictEqual(record, undefined);
      assert.strictEqual(record?.status, ArticleDeliveryStatus.Rejected);
      assert.strictEqual(record?.externalDetail, '{"message": "Invalid embed"}');
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
      assert.notStrictEqual(record, undefined);
      assert.strictEqual(record?.status, ArticleDeliveryStatus.PendingDelivery);
      assert.strictEqual(record?.contentType, ArticleDeliveryContentType.DiscordArticleMessage);
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
      assert.notStrictEqual(record, undefined);
      assert.strictEqual(record?.status, ArticleDeliveryStatus.FilteredOut);
      assert.strictEqual(record?.externalDetail, '{"explainBlocked": ["title contains banned"]}');
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

      assert.strictEqual(store._records.get("delivery-1")?.status, ArticleDeliveryStatus.RateLimited);
      assert.strictEqual(store._records.get("delivery-2")?.status, ArticleDeliveryStatus.MediumRateLimitedByUser);
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
        assert.strictEqual(store._records.size, 0);

        await store.store("feed-1", states2, false);
        assert.strictEqual(store._records.size, 0);

        // Now flush
        const { affectedRows } = await store.flushPendingInserts();
        assert.strictEqual(affectedRows, 2);
        assert.strictEqual(store._records.size, 2);
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
        assert.strictEqual(affectedRows, 0);
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
      assert.deepStrictEqual(record?.articleData, { title: "Test Title" });
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

      assert.strictEqual(result.status, ArticleDeliveryStatus.Sent);
      assert.strictEqual(result.feed_id, "feed-1");
      assert.strictEqual(result.medium_id, "medium-1");
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

      assert.strictEqual(result.status, ArticleDeliveryStatus.Failed);
      assert.strictEqual(result.error_code, ArticleDeliveryErrorCode.ThirdPartyInternal);
      assert.strictEqual(result.internal_message, "Discord returned 500");
    });

    it("should throw if record not found", async () => {
      await assert.rejects(
        store.updateDeliveryStatus("non-existent", {
          status: ArticleDeliveryStatus.Sent,
        }),
        { message: /Record not found/ }
      );
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
      assert.strictEqual(count, 2);
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
      assert.strictEqual(count, 1);
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
      assert.strictEqual(count, 1);
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
      assert.strictEqual(count, 1);
    });
  });

  describe("generateDeliveryId", () => {
    it("should generate unique UUIDs", () => {
      const id1 = generateDeliveryId();
      const id2 = generateDeliveryId();

      assert.notStrictEqual(id1, undefined);
      assert.notStrictEqual(id2, undefined);
      assert.notStrictEqual(id1, id2);
      assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id1));
    });
  });
});
