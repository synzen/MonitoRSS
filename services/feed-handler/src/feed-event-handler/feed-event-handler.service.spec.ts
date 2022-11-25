import { Test, TestingModule } from "@nestjs/testing";
import {
  Article,
  ArticleDeliveryRejectedCode,
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  BrokerEvent,
  FeedV2Event,
  MediumKey,
} from "../shared";
import { ArticlesService } from "../articles/articles.service";
import { FeedFetcherService } from "../feed-fetcher/feed-fetcher.service";
import { FeedEventHandlerService } from "./feed-event-handler.service";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";
import { DeliveryRecordService } from "../delivery-record/delivery-record.service";
import { DeliveryService } from "../delivery/delivery.service";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";

describe("FeedEventHandlerService", () => {
  let service: FeedEventHandlerService;
  const articlesService = {
    getArticlesToDeliverFromXml: jest.fn(),
  };
  const feedFetcherService = {
    fetch: jest.fn(),
  };
  const articleRateLimitService = {
    addOrUpdateFeedLimit: jest.fn(),
  };
  const deliveryService = {
    deliver: jest.fn(),
  };
  const deliveryRecordService = {
    store: jest.fn(),
  };
  const amqpConnection = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedEventHandlerService,
        {
          provide: ArticlesService,
          useValue: articlesService,
        },
        {
          provide: FeedFetcherService,
          useValue: feedFetcherService,
        },
        {
          provide: ArticleRateLimitService,
          useValue: articleRateLimitService,
        },
        {
          provide: DeliveryService,
          useValue: deliveryService,
        },
        {
          provide: DeliveryRecordService,
          useValue: deliveryRecordService,
        },
        {
          provide: AmqpConnection,
          useValue: amqpConnection,
        },
      ],
    }).compile();

    service = module.get<FeedEventHandlerService>(FeedEventHandlerService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("handleV2Event", () => {
    const v2Event: FeedV2Event = {
      feed: {
        id: "1",
        blockingComparisons: ["title"],
        passingComparisons: ["description"],
        url: "url",
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
      articleDayLimit: 100,
    };

    describe("schema validation", () => {
      it("throws if there is not at least one medium", async () => {
        await expect(
          service.handleV2Event({
            ...v2Event,
            mediums: [],
          })
        ).rejects.toThrow();
      });

      it("throws if there is not a recognized medium key", async () => {
        await expect(
          service.handleV2Event({
            ...v2Event,
            mediums: [
              {
                id: "1",
                key: "invalid medium key" as MediumKey,
                details: {} as never,
              },
            ],
          })
        ).rejects.toThrow();
      });

      it("throws if feed properties are missing", async () => {
        await expect(
          service.handleV2Event({
            ...v2Event,
            feed: {
              url: "url",
            } as never,
          })
        ).rejects.toThrow();
      });
    });

    describe("when no feed request is pending", () => {
      it("returns no articles", async () => {
        feedFetcherService.fetch.mockResolvedValue(null);

        const returned = await service.handleV2Event(v2Event);
        expect(returned).toEqual([]);
      });
    });

    describe("when feed request succeeded but there are no articles", () => {
      it("returns no articles", async () => {
        feedFetcherService.fetch.mockResolvedValue("feed text");
        articlesService.getArticlesToDeliverFromXml.mockResolvedValue([]);

        const returned = await service.handleV2Event(v2Event);
        expect(returned).toEqual([]);
      });
    });

    describe("when there are articles to deliver", () => {
      const articles: Article[] = [
        {
          id: "1",
        },
        {
          id: "2",
        },
      ];

      beforeEach(() => {
        feedFetcherService.fetch.mockResolvedValue("feed xml");
        articlesService.getArticlesToDeliverFromXml.mockResolvedValue(articles);
      });

      it("returns the articles to deliver", async () => {
        const returned = await service.handleV2Event(v2Event);
        expect(returned).toEqual(articles);
      });

      it("stores the article delivery states", async () => {
        const deliveryStates: ArticleDeliveryState[] = [
          {
            mediumId: "1",
            status: ArticleDeliveryStatus.Sent,
          },
          {
            mediumId: "1",
            status: ArticleDeliveryStatus.FilteredOut,
          },
        ];

        jest
          .spyOn(deliveryService, "deliver")
          .mockResolvedValue(deliveryStates);

        await service.handleV2Event(v2Event);

        expect(deliveryRecordService.store).toHaveBeenCalledWith(
          v2Event.feed.id,
          deliveryStates
        );
      });

      it("does not reject if delivery records failed to get stored", async () => {
        jest
          .spyOn(deliveryRecordService, "store")
          .mockRejectedValue(new Error("error"));

        await expect(service.handleV2Event(v2Event)).resolves.not.toThrow();
      });
    });

    describe("when articles get rejectd with bad requests", () => {
      const articles: Article[] = [
        {
          id: "1",
        },
        {
          id: "2",
        },
      ];

      beforeEach(() => {
        feedFetcherService.fetch.mockResolvedValue("feed xml");
        articlesService.getArticlesToDeliverFromXml.mockResolvedValue(articles);
      });

      it("emits disabled events", async () => {
        const deliveryStates: ArticleDeliveryState[] = [
          {
            mediumId: "1",
            status: ArticleDeliveryStatus.Rejected,
            errorCode: ArticleDeliveryRejectedCode.BadRequest,
            internalMessage: "",
          },
          {
            mediumId: "1",
            status: ArticleDeliveryStatus.FilteredOut,
          },
          {
            mediumId: "2",
            status: ArticleDeliveryStatus.Rejected,
            errorCode: ArticleDeliveryRejectedCode.BadRequest,
            internalMessage: "",
          },
        ];

        jest
          .spyOn(deliveryService, "deliver")
          .mockResolvedValue(deliveryStates);

        await service.handleV2Event(v2Event);

        expect(amqpConnection.publish).toHaveBeenCalledWith(
          "",
          BrokerEvent.FeedRejectedArticleDisable,
          {
            data: {
              medium: {
                id: "1",
              },
              feed: {
                id: v2Event.feed.id,
              },
            },
          }
        );
      });
    });
  });
});
