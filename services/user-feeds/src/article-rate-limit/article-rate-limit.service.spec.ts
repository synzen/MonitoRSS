import { getRepositoryToken } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
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

const feedId = "feed-id";

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
    jest.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getUnderLimitCheck", () => {
    it("returns true if every limit has at least 1 remaining", async () => {
      jest.spyOn(service, "getFeedLimitInformation").mockResolvedValue([
        {
          remaining: 1,
        },
        {
          remaining: 2,
        },
      ] as never);

      const result = await service.getUnderLimitCheck(feedId);

      expect(result).toEqual({
        underLimit: true,
        remaining: 1,
      });
    });

    it("returns false if any limit has 0 remaining", async () => {
      jest.spyOn(service, "getFeedLimitInformation").mockResolvedValue([
        {
          remaining: 1,
        },
        {
          remaining: 0,
        },
      ] as never);

      const result = await service.getUnderLimitCheck(feedId);

      expect(result).toEqual({
        underLimit: false,
        remaining: 0,
      });
    });
  });

  describe("getFeedLimitInformation", () => {
    const boilerplateLimit = {
      created_at: new Date(),
      feed_id: feedId,
      updated_at: new Date(),
      limit: 10,
      time_window_seconds: 60,
    };

    it("should return correctly when currently below limit", async () => {
      const created = deliveryLimitRepo.create({
        ...boilerplateLimit,
      });
      await deliveryLimitRepo.persistAndFlush(created);
      jest
        .spyOn(recordService, "countDeliveriesInPastTimeframe")
        .mockResolvedValue(9);

      const result = await service.getFeedLimitInformation(feedId);
      expect(result).toEqual([
        {
          progress: 9,
          max: 10,
          remaining: 1,
          windowSeconds: 60,
        },
      ]);
    });

    it("should return correctly when currently at limit", async () => {
      const created = deliveryLimitRepo.create({
        ...boilerplateLimit,
      });
      await deliveryLimitRepo.persistAndFlush(created);
      jest
        .spyOn(recordService, "countDeliveriesInPastTimeframe")
        .mockResolvedValue(10);

      const result = await service.getFeedLimitInformation(feedId);
      expect(result).toEqual([
        {
          progress: 10,
          max: 10,
          remaining: 0,
          windowSeconds: 60,
        },
      ]);
    });

    it("should return correctly when currently above limit", async () => {
      const created = deliveryLimitRepo.create({
        ...boilerplateLimit,
      });
      await deliveryLimitRepo.persistAndFlush(created);
      jest
        .spyOn(recordService, "countDeliveriesInPastTimeframe")
        .mockResolvedValue(11);

      const result = await service.getFeedLimitInformation(feedId);
      expect(result).toEqual([
        {
          progress: 11,
          max: 10,
          remaining: 0,
          windowSeconds: 60,
        },
      ]);
    });

    it("works with multiple limits", async () => {
      const created = deliveryLimitRepo.create({
        ...boilerplateLimit,
        limit: 10,
        time_window_seconds: 15,
      });
      const created2 = deliveryLimitRepo.create({
        ...boilerplateLimit,
        limit: 5,
        time_window_seconds: 30,
      });
      await deliveryLimitRepo.persistAndFlush([created, created2]);
      jest
        .spyOn(recordService, "countDeliveriesInPastTimeframe")
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3);

      const result = await service.getFeedLimitInformation(feedId);
      expect(result).toEqual([
        {
          progress: 2,
          max: created.limit,
          remaining: 8,
          windowSeconds: created.time_window_seconds,
        },
        {
          progress: 3,
          max: created2.limit,
          remaining: 2,
          windowSeconds: created2.time_window_seconds,
        },
      ]);
    });
  });
});
