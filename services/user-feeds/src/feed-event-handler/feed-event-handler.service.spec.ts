process.env.MIKRO_ORM_ALLOW_GLOBAL_CONTEXT = "true";

import { Test, TestingModule } from "@nestjs/testing";
import {
  Article,
  ArticleDeliveryErrorCode,
  ArticleDeliveryRejectedCode,
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  MessageBrokerQueue,
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
import { ArticleDeliveryResult } from "./types/article-delivery-result.type";
import {
  FeedRequestInternalException,
  FeedRequestParseException,
} from "../feed-fetcher/exceptions";
import { FeedDeletedEvent } from "./types";

jest.mock("../shared/utils/logger");

describe("FeedEventHandlerService", () => {
  let service: FeedEventHandlerService;
  const articlesService = {
    getArticlesToDeliverFromXml: jest.fn(),
    deleteInfoForFeed: jest.fn(),
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
    updateDeliveryStatus: jest.fn(),
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
              formatter: {
                formatTables: false,
                stripImages: false,
              },
              splitOptions: {},
              mentions: {},
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

    describe("feed request", () => {
      it("does not deliver anything when request is pending", async () => {
        feedFetcherService.fetch.mockResolvedValue(null);

        await service.handleV2Event(v2Event);

        expect(deliveryService.deliver).not.toHaveBeenCalled();
      });

      it("does not deliver anything when the last request had an internal error", async () => {
        const error = new FeedRequestInternalException("error");
        feedFetcherService.fetch.mockRejectedValue(error);

        await service.handleV2Event(v2Event);

        expect(deliveryService.deliver).not.toHaveBeenCalled();
      });

      it("does not deliver anything when the last request had a feed parse exception", async () => {
        const error = new FeedRequestParseException("error");
        feedFetcherService.fetch.mockRejectedValue(error);

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
          flattened: {
            id: "1",
          },
          raw: {} as never,
        },
        {
          flattened: {
            id: "2",
          },
          raw: {} as never,
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
  });

  describe("onArticleDeliveryResult", () => {
    it("handles error state correctly", async () => {
      const articleDeliveryResult: ArticleDeliveryResult = {
        result: {
          state: "error",
          message: "error message",
        },
        job: {
          id: "job-id",
        } as never,
      };

      await service.onArticleDeliveryResult(articleDeliveryResult);

      expect(deliveryRecordService.updateDeliveryStatus).toHaveBeenCalledWith(
        articleDeliveryResult.job.id,
        {
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.Internal,
          internalMessage: "error message",
        }
      );
    });

    it("handles 400 status correctly", async () => {
      const articleDeliveryResult: ArticleDeliveryResult = {
        result: {
          state: "success",
          status: 400,
          body: {} as never,
        },
        job: {
          id: "job-id",
        } as never,
      };

      await service.onArticleDeliveryResult(articleDeliveryResult);

      expect(deliveryRecordService.updateDeliveryStatus).toHaveBeenCalledWith(
        articleDeliveryResult.job.id,
        {
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryRejectedCode.BadRequest,
          internalMessage: expect.any(String),
        }
      );
    });

    it("emits disable feed event for 400 status", async () => {
      const articleDeliveryResult: ArticleDeliveryResult = {
        result: {
          state: "success",
          status: 400,
          body: {} as never,
        },
        job: {
          id: "job-id",
        } as never,
      };

      jest
        .spyOn(deliveryRecordService, "updateDeliveryStatus")
        .mockResolvedValue({
          medium_id: "medium-id",
          feed_id: "feed-id",
        });

      await service.onArticleDeliveryResult(articleDeliveryResult);

      expect(amqpConnection.publish).toHaveBeenCalledWith(
        "",
        MessageBrokerQueue.FeedRejectedArticleDisableConnection,
        {
          data: {
            rejectedCode: ArticleDeliveryRejectedCode.BadRequest,
            medium: {
              id: "medium-id",
            },
            feed: {
              id: "feed-id",
            },
          },
        }
      );
    });

    it("handles 403 status correctly", async () => {
      const articleDeliveryResult: ArticleDeliveryResult = {
        result: {
          state: "success",
          status: 403,
          body: {} as never,
        },
        job: {
          id: "job-id",
        } as never,
      };

      await service.onArticleDeliveryResult(articleDeliveryResult);

      expect(deliveryRecordService.updateDeliveryStatus).toHaveBeenCalledWith(
        articleDeliveryResult.job.id,
        {
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryRejectedCode.Forbidden,
          internalMessage: expect.any(String),
        }
      );
    });

    it("emits disable feed event for 403 status", async () => {
      const articleDeliveryResult: ArticleDeliveryResult = {
        result: {
          state: "success",
          status: 403,
          body: {} as never,
        },
        job: {
          id: "job-id",
        } as never,
      };

      jest
        .spyOn(deliveryRecordService, "updateDeliveryStatus")
        .mockResolvedValue({
          medium_id: "medium-id",
          feed_id: "feed-id",
        });

      await service.onArticleDeliveryResult(articleDeliveryResult);

      expect(amqpConnection.publish).toHaveBeenCalledWith(
        "",
        MessageBrokerQueue.FeedRejectedArticleDisableConnection,
        {
          data: {
            rejectedCode: ArticleDeliveryRejectedCode.Forbidden,
            medium: {
              id: "medium-id",
            },
            feed: {
              id: "feed-id",
            },
          },
        }
      );
    });

    it("handles 404 status correctly", async () => {
      const articleDeliveryResult: ArticleDeliveryResult = {
        result: {
          state: "success",
          status: 404,
          body: {} as never,
        },
        job: {
          id: "job-id",
        } as never,
      };

      await service.onArticleDeliveryResult(articleDeliveryResult);

      expect(deliveryRecordService.updateDeliveryStatus).toHaveBeenCalledWith(
        articleDeliveryResult.job.id,
        {
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryRejectedCode.MediumNotFound,
          internalMessage: expect.any(String),
        }
      );
    });

    it("emits disable feed event for 404 status", async () => {
      const articleDeliveryResult: ArticleDeliveryResult = {
        result: {
          state: "success",
          status: 404,
          body: {} as never,
        },
        job: {
          id: "job-id",
        } as never,
      };

      jest
        .spyOn(deliveryRecordService, "updateDeliveryStatus")
        .mockResolvedValue({
          medium_id: "medium-id",
          feed_id: "feed-id",
        });

      await service.onArticleDeliveryResult(articleDeliveryResult);

      expect(amqpConnection.publish).toHaveBeenCalledWith(
        "",
        MessageBrokerQueue.FeedRejectedArticleDisableConnection,
        {
          data: {
            rejectedCode: ArticleDeliveryRejectedCode.MediumNotFound,
            medium: {
              id: "medium-id",
            },
            feed: {
              id: "feed-id",
            },
          },
        }
      );
    });

    it("handles 500 status correctly", async () => {
      const articleDeliveryResult: ArticleDeliveryResult = {
        result: {
          state: "success",
          status: 500,
          body: {} as never,
        },
        job: {
          id: "job-id",
        } as never,
      };

      await service.onArticleDeliveryResult(articleDeliveryResult);

      expect(deliveryRecordService.updateDeliveryStatus).toHaveBeenCalledWith(
        articleDeliveryResult.job.id,
        {
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.ThirdPartyInternal,
          internalMessage: expect.any(String),
        }
      );
    });

    it("handles unhandled status codes correctly", async () => {
      const articleDeliveryResult: ArticleDeliveryResult = {
        result: {
          state: "success",
          status: 444,
          body: {} as never,
        },
        job: {
          id: "job-id",
        } as never,
      };

      await service.onArticleDeliveryResult(articleDeliveryResult);

      expect(deliveryRecordService.updateDeliveryStatus).toHaveBeenCalledWith(
        articleDeliveryResult.job.id,
        {
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.Internal,
          internalMessage: expect.any(String),
        }
      );
    });

    it("handles a successful delivery correctly", async () => {
      const articleDeliveryResult: ArticleDeliveryResult = {
        result: {
          state: "success",
          status: 200,
          body: {} as never,
        },
        job: {
          id: "job-id",
        } as never,
      };

      await service.onArticleDeliveryResult(articleDeliveryResult);

      expect(deliveryRecordService.updateDeliveryStatus).toHaveBeenCalledWith(
        articleDeliveryResult.job.id,
        {
          status: ArticleDeliveryStatus.Sent,
        }
      );
    });
  });

  describe("onFeedDeleted", () => {
    it("does not delete info if event validation failed", async () => {
      const event = {
        invalid: "data",
      };

      await service.onFeedDeleted(event as never);

      expect(articlesService.deleteInfoForFeed).not.toHaveBeenCalled();
    });

    it("deletes info for feed on a valid event", async () => {
      const event: FeedDeletedEvent = {
        data: {
          feed: {
            id: "feed-id",
          },
        },
      };

      await service.onFeedDeleted(event as never);

      expect(articlesService.deleteInfoForFeed).toHaveBeenCalledWith("feed-id");
    });
  });
});
