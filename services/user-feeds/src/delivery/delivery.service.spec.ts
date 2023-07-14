import { Test, TestingModule } from "@nestjs/testing";
import { ArticleFiltersService } from "../article-filters/article-filters.service";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";
import {
  Article,
  ArticleDeliveryErrorCode,
  FeedV2Event,
  MediumKey,
} from "../shared";
import logger from "../shared/utils/logger";
import { DeliveryService } from "./delivery.service";
import { DiscordMediumService } from "./mediums/discord-medium.service";
import { ArticleDeliveryState, ArticleDeliveryStatus } from "./types";

jest.mock("../shared/utils/logger");

describe("DeliveryService", () => {
  let service: DeliveryService;
  const discordMediumService = {
    deliverArticle: jest.fn(),
    formatArticle: jest.fn(),
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
    discordMediumService.deliverArticle.mockResolvedValue([]);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("deliver", () => {
    const event: FeedV2Event = {
      data: {
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
              formatter: {
                formatTables: false,
                stripImages: false,
              },
              splitOptions: {},
              mentions: {},
            },
          },
          {
            id: "2",
            key: MediumKey.Discord,
            details: {
              guildId: "2",
              channel: { id: "channel 2" },
              webhook: null,
              formatter: {
                formatTables: false,
                stripImages: false,
              },
              splitOptions: {},
              mentions: {},
            },
          },
        ],
      },
    };
    const articles: Article[] = [
      {
        flattened: {
          id: "article 1",
        },
        raw: {} as never,
      },
      {
        flattened: {
          id: "article 2",
        },
        raw: {} as never,
      },
    ];

    it("calls deliver on the mediums", async () => {
      discordMediumService.formatArticle
        .mockResolvedValueOnce(articles[0])
        .mockResolvedValueOnce(articles[1])
        .mockResolvedValueOnce(articles[0])
        .mockResolvedValueOnce(articles[1]);

      await service.deliver(event, articles);

      expect(discordMediumService.deliverArticle).toHaveBeenCalledTimes(4);
      expect(discordMediumService.deliverArticle).toHaveBeenCalledWith(
        articles[0],
        {
          deliveryId: expect.any(String),
          mediumId: event.data.mediums[0].id,
          deliverySettings: event.data.mediums[0].details,
          feedDetails: event.data.feed,
        }
      );
      expect(discordMediumService.deliverArticle).toHaveBeenCalledWith(
        articles[0],
        {
          deliveryId: expect.any(String),
          mediumId: event.data.mediums[1].id,
          deliverySettings: event.data.mediums[1].details,
          feedDetails: event.data.feed,
        }
      );
      expect(discordMediumService.deliverArticle).toHaveBeenCalledWith(
        articles[1],
        {
          deliveryId: expect.any(String),
          mediumId: event.data.mediums[0].id,
          deliverySettings: event.data.mediums[0].details,
          feedDetails: event.data.feed,
        }
      );
      expect(discordMediumService.deliverArticle).toHaveBeenCalledWith(
        articles[1],
        {
          deliveryId: expect.any(String),
          mediumId: event.data.mediums[1].id,
          deliverySettings: event.data.mediums[1].details,
          feedDetails: event.data.feed,
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
      const eventWithFilters: FeedV2Event = {
        ...event,
        data: {
          ...event.data,
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
                formatter: {
                  formatTables: false,
                  stripImages: false,
                },
                splitOptions: {},
                mentions: {},
              },
            },
          ],
        },
      };

      const consoleSpy = jest.spyOn(logger, "error").mockImplementation();
      await service.deliver(eventWithFilters, articles);

      expect(consoleSpy).toHaveBeenCalled();
    });

    describe("article states", () => {
      it("returns success states", async () => {
        const event: FeedV2Event = {
          data: {
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
                  splitOptions: {},
                  guildId: "1",
                  channel: { id: "channel 1" },
                  webhook: null,
                  formatter: {
                    formatTables: false,
                    stripImages: false,
                  },
                  mentions: {},
                },
              },
            ],
          },
        };
        const articles: Article[] = [
          {
            flattened: {
              id: "article 1",
            },
            raw: {} as never,
          },
        ];

        const resolvedState: ArticleDeliveryState[] = [
          {
            mediumId: "1",
            status: ArticleDeliveryStatus.Sent,
            id: "delivery id",
          },
        ];

        discordMediumService.deliverArticle.mockResolvedValue(resolvedState);

        const result = await service.deliver(event, articles);

        expect(result).toEqual(resolvedState);
      });

      it("returns failed states", async () => {
        const event: FeedV2Event = {
          data: {
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
                  splitOptions: {},
                  guildId: "1",
                  channel: { id: "channel 1" },
                  webhook: null,
                  formatter: {
                    formatTables: false,
                    stripImages: false,
                  },
                  mentions: {},
                },
              },
            ],
            articleDayLimit: 1,
          },
        };
        const articles: Article[] = [
          {
            flattened: {
              id: "article 1",
            },
            raw: {} as never,
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
            id: expect.any(String),
          },
        ] as ArticleDeliveryState[]);
      });

      it("returns filtered states", async () => {
        const event: FeedV2Event = {
          data: {
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
                  splitOptions: {},
                  guildId: "1",
                  channel: { id: "channel 1" },
                  webhook: null,
                  formatter: {
                    formatTables: false,
                    stripImages: false,
                  },
                  mentions: {},
                },
              },
            ],
          },
        };
        const articles: Article[] = [
          {
            flattened: {
              id: "article 1",
            },
            raw: {} as never,
          },
        ];

        articleFiltersService.getArticleFilterResults.mockResolvedValue(false);

        const result = await service.deliver(event, articles);

        expect(result).toEqual([
          {
            mediumId: "1",
            status: ArticleDeliveryStatus.FilteredOut,
            id: expect.any(String),
          },
        ] as ArticleDeliveryState[]);
      });
    });
  });
});
