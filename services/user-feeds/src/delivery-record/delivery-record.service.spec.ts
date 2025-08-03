import {
  ArticleDeliveryContentType,
  ArticleDeliveryErrorCode,
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  clearDatabase,
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../shared";
import { DeliveryRecordService } from "./delivery-record.service";
import { DeliveryRecord } from "./entities";
import { describe, it, afterEach, before, after } from "node:test";
import { deepStrictEqual } from "node:assert";
import { randomUUID } from "node:crypto";

describe("DeliveryRecordService", () => {
  let service: DeliveryRecordService;

  before(async () => {
    const { init } = await setupIntegrationTests(
      {
        providers: [DeliveryRecordService],
      },
      {
        models: [DeliveryRecord],
      }
    );

    const { module } = await init();

    service = module.get<DeliveryRecordService>(DeliveryRecordService);
  });

  afterEach(async () => {
    await clearDatabase();
  });

  after(async () => {
    await teardownIntegrationTests();
  });

  it("should be defined", () => {
    deepStrictEqual(typeof service, "object");
  });

  const insertItems = async (feedId: string, items: ArticleDeliveryState[]) => {
    return service.startContext(async () => service.store(feedId, items, true));
  };

  describe("store", () => {
    it("stores sent article states correctly", async () => {
      const feedId = "feed-id";
      const articleStates: ArticleDeliveryState[] = [
        {
          id: "1",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.Sent,
          articleIdHash: "hash",
          article: null,
        },
        {
          id: "2",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.Sent,
          articleIdHash: "hash2",
          article: null,
        },
      ];
      const res = await insertItems(feedId, articleStates);

      deepStrictEqual(res?.inserted, 2);
    });

    it("stores failed articles correctly", async () => {
      const feedId = "feed-id";
      const articleStates: ArticleDeliveryState[] = [
        {
          id: "1",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          internalMessage: "internal-message",
          articleIdHash: "hash",
          article: null,
        },
        {
          id: "2",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.Internal,
          internalMessage: "internal-message-2",
          articleIdHash: "hash2",
          article: null,
        },
      ];
      const res = await insertItems(feedId, articleStates);

      deepStrictEqual(res?.inserted, 2);
    });

    it("stores rejected articles correctly", async () => {
      const feedId = "feed-id";
      const articleStates: ArticleDeliveryState[] = [
        {
          id: "1",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryErrorCode.ThirdPartyBadRequest,
          internalMessage: "internal-message",
          articleIdHash: "hash",
          externalDetail: "",
          article: null,
        },
        {
          id: "2",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryErrorCode.ThirdPartyBadRequest,
          internalMessage: "internal-message-2",
          articleIdHash: "hash2",
          externalDetail: "",
          article: null,
        },
      ];
      const res = await insertItems(feedId, articleStates);

      deepStrictEqual(res?.inserted, 2);
    });

    it("stores pending delivery states correctly", async () => {
      const feedId = "feed-id";
      const articleStates: ArticleDeliveryState[] = [
        {
          id: "id-1",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.PendingDelivery,
          contentType: ArticleDeliveryContentType.DiscordArticleMessage,
          articleIdHash: "hash",
          article: null,
        },
        {
          id: "id-2",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.PendingDelivery,
          contentType: ArticleDeliveryContentType.DiscordArticleMessage,
          parent: "id-1",
          articleIdHash: "hash2",
          article: null,
        },
      ];
      const res = await insertItems(feedId, articleStates);

      deepStrictEqual(res?.inserted, 2);
    });

    it("stores other article states correctly", async () => {
      const feedId = "feed-id";
      const articleStates: ArticleDeliveryState[] = [
        {
          id: "id-1",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.FilteredOut,
          articleIdHash: "hash",
          externalDetail: "",
          article: {
            flattened: {
              id: randomUUID(),
              idHash: "hash",
              title: "Test Article",
            },
            raw: {},
          },
        },
        {
          id: "id-2",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.FilteredOut,
          articleIdHash: "hash2",
          externalDetail: "",
          article: null,
        },
      ];
      const res = await insertItems(feedId, articleStates);

      deepStrictEqual(res?.inserted, 2);
    });
  });

  describe("updateDeliveryStatus", () => {
    it("returns the updated record", async () => {
      const recordId = randomUUID();

      await insertItems("feed-id", [
        {
          id: recordId,
          mediumId: "1",
          status: ArticleDeliveryStatus.PendingDelivery,
          articleIdHash: "hash",
          article: null,
          contentType: ArticleDeliveryContentType.DiscordArticleMessage,
        },
      ]);

      const updatedRecord = await service.updateDeliveryStatus(
        recordId,
        {
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          internalMessage: "internal-message",
          articleId: "article-id",
        },
        true
      );

      deepStrictEqual(updatedRecord.medium_id, "1");
      deepStrictEqual(updatedRecord.feed_id, "feed-id");
    });

    it("updates the status of a delivery record", async () => {
      const existingRecord = new DeliveryRecord({
        id: "id-1",
        feed_id: "feed-id",
        status: ArticleDeliveryStatus.PendingDelivery,
        medium_id: "1",
        article_data: null,
      });

      await insertItems("feed-id", [
        {
          id: "id-1",
          status: ArticleDeliveryStatus.PendingDelivery,
          mediumId: "1",
          article: null,
          articleIdHash: "hash",
          contentType: ArticleDeliveryContentType.DiscordArticleMessage,
        },
      ]);

      const updatedRecord = await service.updateDeliveryStatus(
        existingRecord.id,
        {
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          internalMessage: "internal-message",
        },
        true
      );

      deepStrictEqual(updatedRecord.status, ArticleDeliveryStatus.Failed);
      deepStrictEqual(
        updatedRecord.error_code,
        ArticleDeliveryErrorCode.NoChannelOrWebhook
      );
      deepStrictEqual(updatedRecord.internal_message, "internal-message");
    });
  });

  describe("countDeliveriesInPastTimeframe", () => {
    it("returns the correct number of sent and rejected deliveries", async () => {
      const feedId = randomUUID();
      const mediumId = randomUUID();

      await insertItems(feedId, [
        {
          id: "1",
          mediumId,
          articleIdHash: "hash1",
          status: ArticleDeliveryStatus.Sent,
          article: null,
        },
        {
          id: "2",
          mediumId,
          articleIdHash: "hash2",
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          externalDetail: "",
          internalMessage: "internal-message",
          article: null,
        },
        {
          id: "3",
          mediumId,
          articleIdHash: "hash3",
          status: ArticleDeliveryStatus.Sent,
          article: null,
        },
      ]);

      const count = await service.countDeliveriesInPastTimeframe(
        { feedId },
        60 * 60 * 2 // 2 hours
      );

      deepStrictEqual(count, 2);
    });

    it("returns the correct number with duplicate article id hashes", async () => {
      const feedId = randomUUID();
      const mediumId = randomUUID();

      await insertItems(feedId, [
        {
          id: "1",
          mediumId: mediumId,
          articleIdHash: "hash1",
          status: ArticleDeliveryStatus.Sent,
          article: null,
        },
        {
          id: "2",
          mediumId: mediumId,
          articleIdHash: "hash1",
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          externalDetail: "",
          internalMessage: "internal-message",
          article: null,
        },
        {
          id: "3",
          mediumId: mediumId,
          articleIdHash: "hash2",
          status: ArticleDeliveryStatus.Sent,
          article: null,
        },
      ]);

      const count = await service.countDeliveriesInPastTimeframe(
        { feedId },
        60 * 60 * 2 // 2 hours
      );

      deepStrictEqual(count, 2);
    });

    it("returns the correct number with duplicate article id hashes with medium id", async () => {
      const feedId = randomUUID();
      const mediumId = randomUUID();

      await insertItems(feedId, [
        {
          id: "1",
          mediumId: mediumId,
          articleIdHash: "hash1",
          status: ArticleDeliveryStatus.Sent,
          article: null,
        },
        {
          id: "2",
          mediumId: mediumId,
          articleIdHash: "hash1",
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          externalDetail: "",
          internalMessage: "internal-message",
          article: null,
        },
        {
          id: "3",
          mediumId: mediumId,
          articleIdHash: "hash2",
          status: ArticleDeliveryStatus.Sent,
          article: null,
        },
      ]);

      const count = await service.countDeliveriesInPastTimeframe(
        { mediumId: mediumId },
        60 * 60 * 2 // 2 hours
      );

      deepStrictEqual(count, 2);
    });
  });
});
