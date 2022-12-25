import { Test, TestingModule } from "@nestjs/testing";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";
import { FeedsService } from "./feeds.service";

describe("FeedsService", () => {
  let service: FeedsService;
  const articleRateLimitService = {
    getFeedLimitInformation: jest.fn(),
    addOrUpdateFeedLimit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedsService,
        {
          provide: ArticleRateLimitService,
          useValue: articleRateLimitService,
        },
      ],
    }).compile();

    service = module.get<FeedsService>(FeedsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getRateLimitInformation", () => {
    it("returns the limits", async () => {
      const returnedInfo = [
        {
          remaining: 1,
        },
      ];
      articleRateLimitService.getFeedLimitInformation.mockResolvedValue(
        returnedInfo
      );

      const result = await service.getRateLimitInformation("feed-id");
      expect(result).toEqual(returnedInfo);
    });
  });

  describe("initializeFeed", () => {
    it("adds a feed limit", async () => {
      const addOrUpdateFeedLimit = jest.fn();
      articleRateLimitService.addOrUpdateFeedLimit = addOrUpdateFeedLimit;

      await service.initializeFeed("feed-id", {
        rateLimit: {
          limit: 1,
          timeWindowSec: 86400,
        },
      });
      expect(addOrUpdateFeedLimit).toHaveBeenCalledWith("feed-id", {
        limit: 1,
        timeWindowSec: 86400,
      });
    });
  });
});
