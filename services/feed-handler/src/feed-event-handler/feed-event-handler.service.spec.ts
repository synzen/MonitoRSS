process.env.MIKRO_ORM_ALLOW_GLOBAL_CONTEXT = "true";

import { Test, TestingModule } from "@nestjs/testing";
import {
  Article,
  ArticleDeliveryRejectedCode,
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  BrokerQueue,
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
import { MikroORM } from "@mikro-orm/core";

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
    jest.spyOn(console, "error").mockImplementation();
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
        {
          provide: MikroORM,
          useValue: await MikroORM.init(
            {
              // Get past errors related to @UseRequestContext() decorator from MikroORM
              type: "postgresql",
              dbName: "test",
              entities: [],
              discovery: {
                warnWhenNoEntities: false,
              },
            },
            false
          ),
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
      data: {
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
            filters: null,
            details: {
              guildId: "1",
              channel: { id: "channel 1" },
              webhook: null,
            },
          },
        ],
        articleDayLimit: 100,
      },
    };

    describe("schema validation", () => {
      it("throws if there is not at least one medium", async () => {
        await expect(
          service.handleV2Event({
            ...v2Event,
            data: {
              ...v2Event.data,
              mediums: [],
            },
          })
        ).rejects.toThrow();
      });

      it("throws if there is not a recognized medium key", async () => {
        await expect(
          service.handleV2Event({
            ...v2Event,
            data: {
              ...v2Event.data,
              mediums: [
                {
                  id: "1",
                  key: "invalid medium key" as MediumKey,
                  details: {} as never,
                },
              ],
            },
          })
        ).rejects.toThrow();
      });

      it("throws if feed properties are missing", async () => {
        await expect(
          service.handleV2Event({
            ...v2Event,
            data: {
              ...v2Event.data,
              feed: {
                url: "url",
              } as never,
            },
          })
        ).rejects.toThrow();
      });
    });

    describe("when no feed request is pending", () => {
      it("does not deliver anything", async () => {
        feedFetcherService.fetch.mockResolvedValue(null);

        await service.handleV2Event(v2Event);

        expect(deliveryService.deliver).not.toHaveBeenCalled();
      });
    });

    describe("when feed request succeeded but there are no articles", () => {
      it("does not deliver anything", async () => {
        feedFetcherService.fetch.mockResolvedValue("feed text");
        articlesService.getArticlesToDeliverFromXml.mockResolvedValue([]);

        await service.handleV2Event(v2Event);

        expect(deliveryService.deliver).not.toHaveBeenCalled();
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

      it("calls delivery on the the articles", async () => {
        await service.handleV2Event(v2Event);

        expect(deliveryService.deliver).toHaveBeenCalledWith(v2Event, articles);
      });

      it("stores the article delivery states", async () => {
        const deliveryStates: ArticleDeliveryState[] = [
          {
            id: "1",
            mediumId: "1",
            status: ArticleDeliveryStatus.Sent,
          },
          {
            id: "2",
            mediumId: "1",
            status: ArticleDeliveryStatus.FilteredOut,
          },
        ];

        jest
          .spyOn(deliveryService, "deliver")
          .mockResolvedValue(deliveryStates);

        await service.handleV2Event(v2Event);

        expect(deliveryRecordService.store).toHaveBeenCalledWith(
          v2Event.data.feed.id,
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
            id: "1",
            mediumId: "1",
            status: ArticleDeliveryStatus.Rejected,
            errorCode: ArticleDeliveryRejectedCode.BadRequest,
            internalMessage: "",
          },
          {
            id: "2",
            mediumId: "1",
            status: ArticleDeliveryStatus.FilteredOut,
          },
          {
            id: "3",
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
          BrokerQueue.FeedRejectedArticleDisable,
          {
            data: {
              medium: {
                id: "1",
              },
              feed: {
                id: v2Event.data.feed.id,
              },
            },
          }
        );
      });
    });
  });
});
