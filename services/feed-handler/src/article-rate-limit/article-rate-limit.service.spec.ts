import { Test, TestingModule } from "@nestjs/testing";
import { DeliveryRecordService } from "../delivery-record/delivery-record.service";
import { ArticleRateLimitService } from "./article-rate-limit.service";

const deliveryRecordService = {
  countDeliveriesInPastTimeframe: jest.fn(),
};

describe("ArticleRateLimitService", () => {
  let service: ArticleRateLimitService;
  let recordService: DeliveryRecordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleRateLimitService,
        {
          provide: DeliveryRecordService,
          useValue: deliveryRecordService,
        },
      ],
    }).compile();

    service = module.get<ArticleRateLimitService>(ArticleRateLimitService);
    recordService = module.get<DeliveryRecordService>(DeliveryRecordService);
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
});
