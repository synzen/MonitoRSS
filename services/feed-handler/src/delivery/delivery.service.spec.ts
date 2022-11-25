import { Test, TestingModule } from "@nestjs/testing";
import { ArticleFiltersService } from "../article-filters/article-filters.service";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";
import {
  Article,
  ArticleDeliveryErrorCode,
  FeedV2Event,
  MediumKey,
} from "../shared";
import { DeliveryService } from "./delivery.service";
import { DiscordMediumService } from "./mediums/discord-medium.service";
import { ArticleDeliveryState, ArticleDeliveryStatus } from "./types";

describe("DeliveryService", () => {
  let service: DeliveryService;
  const discordMediumService = {
    deliverArticle: jest.fn(),
  };
  const articleFiltersService = {
    buildReferences: jest.fn(),
    getArticleFilterResults: jest.fn(),
  };
  const articleRateLimitService = {
    getUnderLimitCheck: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryService,
        {
          provide: DiscordMediumService,
          useValue: discordMediumService,
        },
        {
          provide: ArticleFiltersService,
          useValue: articleFiltersService,
        },
        {
          provide: ArticleRateLimitService,
          useValue: articleRateLimitService,
        },
      ],
    }).compile();

    service = module.get<DeliveryService>(DeliveryService);
    articleFiltersService.getArticleFilterResults.mockResolvedValue(true);
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    articleRateLimitService.getUnderLimitCheck.mockResolvedValue({
      remaining: Number.MAX_SAFE_INTEGER,
    });
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("deliver", () => {
    const event: FeedV2Event = {
      articleDayLimit: 1,
      feed: {
        id: "1",
        url: "url",
        blockingComparisons: [],
        passingComparisons: [],
      },
      mediums: [
        {
          id: "1",
          key: MediumKey.Discord,
          details: {
            guildId: "1",
            channel: { id: "channel 1" },
            webhook: null,
          },
        },
        {
          id: "2",
          key: MediumKey.Discord,
          details: {
            guildId: "2",
            channel: { id: "channel 2" },
            webhook: null,
          },
        },
      ],
    };
    const articles: Article[] = [
      {
        id: "article 1",
      },
      {
        id: "article 2",
      },
    ];

    it("calls deliver on the mediums", async () => {
      await service.deliver(event, articles);

      expect(discordMediumService.deliverArticle).toHaveBeenCalledTimes(4);
      expect(discordMediumService.deliverArticle).toHaveBeenCalledWith(
        articles[0],
        {
          mediumId: event.mediums[0].id,
          deliverySettings: event.mediums[0].details,
          feedDetails: event.feed,
        }
      );
      expect(discordMediumService.deliverArticle).toHaveBeenCalledWith(
        articles[0],
        {
          mediumId: event.mediums[1].id,
          deliverySettings: event.mediums[1].details,
          feedDetails: event.feed,
        }
      );
      expect(discordMediumService.deliverArticle).toHaveBeenCalledWith(
        articles[1],
        {
          mediumId: event.mediums[0].id,
          deliverySettings: event.mediums[0].details,
          feedDetails: event.feed,
        }
      );
      expect(discordMediumService.deliverArticle).toHaveBeenCalledWith(
        articles[1],
        {
          mediumId: event.mediums[1].id,
          deliverySettings: event.mediums[1].details,
          feedDetails: event.feed,
        }
      );
    });

    it("does not deliver articles that exceed rate limits", async () => {
      const remainingCalls = 2;
      articleRateLimitService.getUnderLimitCheck.mockResolvedValue({
        remaining: remainingCalls,
      });

      await service.deliver(event, articles);

      expect(discordMediumService.deliverArticle).toHaveBeenCalledTimes(
        remainingCalls
      );
    });

    it("logs errors if some mediums fail", async () => {
      const deliveryError = new Error("delivery err");
      articleFiltersService.getArticleFilterResults.mockRejectedValue(
        deliveryError
      );
      const eventWithFilters = {
        ...event,
        mediums: [
          {
            id: "1",
            key: MediumKey.Discord,
            filters: {
              expression: {} as never,
            },
            details: {
              guildId: "1",
              channel: { id: "channel 1" },
              webhook: null,
            },
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      await service.deliver(eventWithFilters, articles);

      expect(consoleSpy).toHaveBeenCalled();
    });

    describe("article states", () => {
      it("returns success states", async () => {
        const event: FeedV2Event = {
          articleDayLimit: 1,
          feed: {
            id: "1",
            url: "url",
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [
            {
              id: "1",
              key: MediumKey.Discord,
              details: {
                guildId: "1",
                channel: { id: "channel 1" },
                webhook: null,
              },
            },
          ],
        };
        const articles: Article[] = [
          {
            id: "article 1",
          },
        ];

        const resolvedState: ArticleDeliveryState = {
          mediumId: "1",
          status: ArticleDeliveryStatus.Sent,
        };

        discordMediumService.deliverArticle.mockResolvedValue(resolvedState);

        const result = await service.deliver(event, articles);

        expect(result).toEqual([resolvedState]);
      });

      it("returns failed states", async () => {
        const event: FeedV2Event = {
          feed: {
            id: "1",
            url: "url",
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [
            {
              id: "1",
              key: MediumKey.Discord,
              filters: {
                expression: {} as never,
              },
              details: {
                guildId: "1",
                channel: { id: "channel 1" },
                webhook: null,
              },
            },
          ],
          articleDayLimit: 1,
        };
        const articles: Article[] = [
          {
            id: "article 1",
          },
        ];

        const mockError = new Error("mock delivery error");
        articleFiltersService.getArticleFilterResults.mockRejectedValue(
          mockError
        );

        const result = await service.deliver(event, articles);

        expect(result).toEqual([
          {
            mediumId: "1",
            status: ArticleDeliveryStatus.Failed,
            errorCode: ArticleDeliveryErrorCode.Internal,
            internalMessage: mockError.message,
          },
        ]);
      });

      it("returns filtered states", async () => {
        const event: FeedV2Event = {
          articleDayLimit: 1,
          feed: {
            id: "1",
            url: "url",
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [
            {
              id: "1",
              key: MediumKey.Discord,
              filters: {
                expression: {} as never,
              },
              details: {
                guildId: "1",
                channel: { id: "channel 1" },
                webhook: null,
              },
            },
          ],
        };
        const articles: Article[] = [
          {
            id: "article 1",
          },
        ];

        articleFiltersService.getArticleFilterResults.mockResolvedValue(false);

        const result = await service.deliver(event, articles);

        expect(result).toEqual([
          {
            mediumId: "1",
            status: ArticleDeliveryStatus.FilteredOut,
          },
        ]);
      });
    });
  });
});
