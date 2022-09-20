import { getRepositoryToken } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import { Test, TestingModule } from "@nestjs/testing";
import { DeliveryRecordService } from "../delivery-record/delivery-record.service";
import {
  clearDatabase,
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../shared";
import { ArticleRateLimitService } from "./article-rate-limit.service";
import { FeedArticleDeliveryLimit } from "./entities";

const deliveryRecordService = {
  countDeliveriesInPastTimeframe: jest.fn(),
};

describe("ArticleRateLimitService", () => {
  let service: ArticleRateLimitService;
  let recordService: DeliveryRecordService;
  let deliveryLimitRepo: EntityRepository<FeedArticleDeliveryLimit>;

  beforeAll(async () => {
    const { init } = await setupIntegrationTests(
      {
        providers: [
          ArticleRateLimitService,
          {
            provide: DeliveryRecordService,
            useValue: deliveryRecordService,
          },
        ],
      },
      {
        models: [FeedArticleDeliveryLimit],
      }
    );

    const { module } = await init();

    service = module.get<ArticleRateLimitService>(ArticleRateLimitService);
    recordService = module.get<DeliveryRecordService>(DeliveryRecordService);
    deliveryLimitRepo = module.get<EntityRepository<FeedArticleDeliveryLimit>>(
      getRepositoryToken(FeedArticleDeliveryLimit)
    );
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getArticlesRemaining", () => {
    it("should return the number of articles remaining", async () => {
      jest
        .spyOn(recordService, "countDeliveriesInPastTimeframe")
        .mockResolvedValue(1);

      const result = await service.getArticlesInLastTimeframe("2", 60);
      expect(result).toEqual(1);
    });
  });

  describe("addOrUpdateFeedLimit", () => {
    it("creates a new limit if it does not already exist", async () => {
      await service.addOrUpdateFeedLimit("feed-id", {
        timeWindowSec: 10,
        limit: 60,
      });

      const limits = await deliveryLimitRepo.findAll();

      expect(limits).toHaveLength(1);
      expect(limits[0].feed_id).toEqual("feed-id");
      expect(limits[0].limit).toEqual(60);
      expect(limits[0].time_window_seconds).toEqual(10);
    });

    it("updates an existing limit if the time window already exists", async () => {
      const createdLimit = await deliveryLimitRepo.create({
        time_window_seconds: 60,
        created_at: new Date(),
        feed_id: "feed-id",
        limit: 10,
        updated_at: new Date(),
      });
      await deliveryLimitRepo.persistAndFlush(createdLimit);

      const newLimit = 1000;

      await service.addOrUpdateFeedLimit(createdLimit.feed_id, {
        limit: newLimit,
        timeWindowSec: createdLimit.time_window_seconds,
      });

      const limits = await deliveryLimitRepo.findAll();

      expect(limits).toHaveLength(1);
      expect(limits[0].feed_id).toEqual(createdLimit.feed_id);
      expect(limits[0].limit).toEqual(newLimit);
      expect(limits[0].time_window_seconds).toEqual(
        createdLimit.time_window_seconds
      );
    });
  });
});
