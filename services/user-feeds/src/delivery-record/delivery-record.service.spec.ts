import { getRepositoryToken } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
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
  let deliveryRecordRepo: EntityRepository<DeliveryRecord>;

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
    deliveryRecordRepo = module.get<EntityRepository<DeliveryRecord>>(
      getRepositoryToken(DeliveryRecord.name)
    );
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
    await service.startContext(async () => service.store(feedId, items));
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
        },
        {
          id: "2",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.Sent,
          articleIdHash: "hash2",
        },
      ];
      await insertItems(feedId, articleStates);

      const records = await deliveryRecordRepo.findAll();

      deepStrictEqual(records.length, 2);

      const ids = records.map((record) => record.id);
      deepStrictEqual(ids, ["1", "2"]);

      const feedIds = records.map((record) => record.feed_id);
      deepStrictEqual(feedIds, [feedId, feedId]);

      const statuses = records.map((record) => record.status);
      deepStrictEqual(statuses, [
        ArticleDeliveryStatus.Sent,
        ArticleDeliveryStatus.Sent,
      ]);
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
        },
        {
          id: "2",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.Internal,
          internalMessage: "internal-message-2",
          articleIdHash: "hash2",
        },
      ];
      await insertItems(feedId, articleStates);

      const records = await deliveryRecordRepo.findAll();

      deepStrictEqual(records.length, 2);

      const noChannelOrWebhookRecord = records.find(
        (record) =>
          record.error_code === ArticleDeliveryErrorCode.NoChannelOrWebhook
      );

      deepStrictEqual(
        noChannelOrWebhookRecord?.internal_message,
        "internal-message"
      );
      deepStrictEqual(
        noChannelOrWebhookRecord.status,
        ArticleDeliveryStatus.Failed
      );
      deepStrictEqual(noChannelOrWebhookRecord.feed_id, feedId);
      deepStrictEqual(noChannelOrWebhookRecord.article_id_hash, "hash");

      const internalErrorRecord = records.find(
        (record) => record.error_code === ArticleDeliveryErrorCode.Internal
      );

      deepStrictEqual(
        internalErrorRecord?.internal_message,
        "internal-message-2"
      );
      deepStrictEqual(internalErrorRecord.status, ArticleDeliveryStatus.Failed);
      deepStrictEqual(internalErrorRecord.feed_id, feedId);
      deepStrictEqual(internalErrorRecord.article_id_hash, "hash2");
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
        },
        {
          id: "2",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryErrorCode.ThirdPartyBadRequest,
          internalMessage: "internal-message-2",
          articleIdHash: "hash2",
          externalDetail: "",
        },
      ];
      await insertItems(feedId, articleStates);

      const records = await deliveryRecordRepo.findAll();

      deepStrictEqual(records.length, 2);

      const record1 = records.find((record) => record.id === "1");
      deepStrictEqual(record1?.status, ArticleDeliveryStatus.Rejected);
      deepStrictEqual(
        record1?.error_code,
        ArticleDeliveryErrorCode.ThirdPartyBadRequest
      );
      deepStrictEqual(record1?.internal_message, "internal-message");
      deepStrictEqual(record1?.feed_id, feedId);
      deepStrictEqual(record1?.article_id_hash, "hash");

      const record2 = records.find((record) => record.id === "2");
      deepStrictEqual(record2?.status, ArticleDeliveryStatus.Rejected);
      deepStrictEqual(
        record2?.error_code,
        ArticleDeliveryErrorCode.ThirdPartyBadRequest
      );
      deepStrictEqual(record2?.internal_message, "internal-message-2");
      deepStrictEqual(record2?.feed_id, feedId);
      deepStrictEqual(record2?.article_id_hash, "hash2");
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
        },
        {
          id: "id-2",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.PendingDelivery,
          contentType: ArticleDeliveryContentType.DiscordArticleMessage,
          parent: "id-1",
          articleIdHash: "hash2",
        },
      ];
      await insertItems(feedId, articleStates);

      const records = await deliveryRecordRepo.findAll();

      deepStrictEqual(records.length, 2);

      const record1 = records.find((record) => record.id === "id-1");
      deepStrictEqual(record1?.status, ArticleDeliveryStatus.PendingDelivery);
      deepStrictEqual(record1?.feed_id, feedId);
      deepStrictEqual(record1?.article_id_hash, "hash");
      deepStrictEqual(
        record1?.content_type,
        ArticleDeliveryContentType.DiscordArticleMessage
      );

      const record2 = records.find((record) => record.id === "id-2");
      deepStrictEqual(record2?.status, ArticleDeliveryStatus.PendingDelivery);
      deepStrictEqual(record2?.feed_id, feedId);
      deepStrictEqual(record2?.article_id_hash, "hash2");
      deepStrictEqual(record2?.parent?.id, "id-1");
      deepStrictEqual(
        record2?.content_type,
        ArticleDeliveryContentType.DiscordArticleMessage
      );
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
        },
        {
          id: "id-2",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.FilteredOut,
          articleIdHash: "hash2",
          externalDetail: "",
        },
      ];
      await insertItems(feedId, articleStates);

      const records = await deliveryRecordRepo.findAll();

      deepStrictEqual(records.length, 2);

      const record1 = records.find((record) => record.id === "id-1");
      deepStrictEqual(record1?.status, ArticleDeliveryStatus.FilteredOut);
      deepStrictEqual(record1?.feed_id, feedId);
      deepStrictEqual(record1?.article_id_hash, "hash");

      const record2 = records.find((record) => record.id === "id-2");
      deepStrictEqual(record2?.status, ArticleDeliveryStatus.FilteredOut);
      deepStrictEqual(record2?.feed_id, feedId);
      deepStrictEqual(record2?.article_id_hash, "hash2");
    });
  });

  describe("updateDeliveryStatus", () => {
    it("returns the updated record", async () => {
      const existingRecord = new DeliveryRecord({
        id: "id-1",
        feed_id: "feed-id",
        status: ArticleDeliveryStatus.PendingDelivery,
        medium_id: "1",
      });

      await deliveryRecordRepo.insert(existingRecord);

      const updatedRecord = await service.updateDeliveryStatus(
        existingRecord.id,
        {
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          internalMessage: "internal-message",
          articleId: "article-id",
        }
      );

      deepStrictEqual(updatedRecord.status, ArticleDeliveryStatus.Failed);
      deepStrictEqual(
        updatedRecord.error_code,
        ArticleDeliveryErrorCode.NoChannelOrWebhook
      );
      deepStrictEqual(updatedRecord.internal_message, "internal-message");
      deepStrictEqual(updatedRecord.feed_id, "feed-id");
    });

    it("updates the status of a delivery record", async () => {
      const existingRecord = new DeliveryRecord({
        id: "id-1",
        feed_id: "feed-id",
        status: ArticleDeliveryStatus.PendingDelivery,
        medium_id: "1",
      });

      await deliveryRecordRepo.insert(existingRecord);

      await service.updateDeliveryStatus(existingRecord.id, {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
        internalMessage: "internal-message",
      });

      const updatedRecord = await deliveryRecordRepo.findOneOrFail(
        existingRecord.id
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
        },
        {
          id: "2",
          mediumId,
          articleIdHash: "hash2",
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          externalDetail: "",
          internalMessage: "internal-message",
        },
        {
          id: "3",
          mediumId,
          articleIdHash: "hash3",
          status: ArticleDeliveryStatus.Sent,
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
        },
        {
          id: "2",
          mediumId: mediumId,
          articleIdHash: "hash1",
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          externalDetail: "",
          internalMessage: "internal-message",
        },
        {
          id: "3",
          mediumId: mediumId,
          articleIdHash: "hash2",
          status: ArticleDeliveryStatus.Sent,
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
        },
        {
          id: "2",
          mediumId: mediumId,
          articleIdHash: "hash1",
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          externalDetail: "",
          internalMessage: "internal-message",
        },
        {
          id: "3",
          mediumId: mediumId,
          articleIdHash: "hash2",
          status: ArticleDeliveryStatus.Sent,
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
