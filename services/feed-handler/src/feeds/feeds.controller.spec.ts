import { Test, TestingModule } from "@nestjs/testing";
import { FeedsController } from "./feeds.controller";
import { FeedsService } from "./feeds.service";

describe("FeedsController", () => {
  let controller: FeedsController;
  const feedsService = {
    getRateLimitInformation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedsController],
      providers: [
        FeedsService,
        {
          provide: FeedsService,
          useValue: feedsService,
        },
      ],
    }).compile();

    controller = module.get<FeedsController>(FeedsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getLimits", () => {
    it("returns the limits", async () => {
      const returnedInfo = [
        {
          remaining: 1,
          progress: 2,
          max: 3,
        },
        {
          remaining: 4,
          progress: 5,
          max: 6,
        },
      ];
      feedsService.getRateLimitInformation.mockResolvedValue(returnedInfo);

      const result = await controller.getLimits("feed-id");
      expect(result).toEqual({
        results: [
          {
            remaining: 1,
            progress: 2,
            max: 3,
          },
          {
            remaining: 4,
            progress: 5,
            max: 6,
          },
        ],
      });
    });

    it("returns an empty array if no limits", async () => {
      feedsService.getRateLimitInformation.mockResolvedValue([]);

      const result = await controller.getLimits("feed-id");
      expect(result).toEqual({
        results: [],
      });
    });
  });
});
