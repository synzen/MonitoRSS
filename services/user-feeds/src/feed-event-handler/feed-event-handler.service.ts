import { Injectable } from "@nestjs/common";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";
import { ArticlesService } from "../articles/articles.service";
import { DeliveryRecordService } from "../delivery-record/delivery-record.service";
import { DeliveryService } from "../delivery/delivery.service";
import { FeedFetcherService } from "../feed-fetcher/feed-fetcher.service";
import {
  ArticleDeliveryErrorCode,
  ArticleDeliveryRejectedCode,
  ArticleDeliveryStatus,
  MessageBrokerQueue,
  FeedV2Event,
  feedV2EventSchema,
  FeedRejectedDisabledCode,
  Article,
  UserFeedFormatOptions,
} from "../shared";
import { RabbitSubscribe, AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  MikroORM,
  UniqueConstraintViolationException,
  UseRequestContext,
} from "@mikro-orm/core";
import { ArticleDeliveryResult } from "./types/article-delivery-result.type";
import logger from "../shared/utils/logger";
import {
  FeedFetchGrpcException,
  FeedRequestBadStatusCodeException,
  FeedRequestFetchException,
  FeedRequestInternalException,
  FeedRequestParseException,
  FeedRequestTimedOutException,
} from "../feed-fetcher/exceptions";
import { FeedDeletedEvent } from "./types";
import { feedDeletedEventSchema } from "./schemas";
import { InvalidFeedException } from "../articles/exceptions";
import pRetry from "p-retry";
import { ResponseHashService } from "../response-hash/response-hash.service";
import { getParserRules } from "./utils";
import { FeedRetryRecord } from "./entities";
import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import { z } from "zod";
import { CacheStorageService } from "../cache-storage/cache-storage.service";
@Injectable()
export class FeedEventHandlerService {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly articleRateLimitService: ArticleRateLimitService,
    private readonly feedFetcherService: FeedFetcherService,
    private readonly deliveryService: DeliveryService,
    private readonly deliveryRecordService: DeliveryRecordService,
    private readonly amqpConnection: AmqpConnection,
    private readonly responseHashService: ResponseHashService,
    @InjectRepository(FeedRetryRecord)
    private readonly feedRetryRecordRepo: EntityRepository<FeedRetryRecord>,
    private readonly cacheStorageService: CacheStorageService,
    private readonly orm: MikroORM // Required for @UseRequestContext()
  ) {}

  @RabbitSubscribe({
    exchange: "",
    queue: MessageBrokerQueue.FeedDeliverArticles,
  })
  async handleV2Event(event: FeedV2Event): Promise<void> {
    try {
      feedV2EventSchema.parse(event);
    } catch (err) {
      if (err instanceof z.ZodError) {
        logger.error(`Validation failed on incoming Feed V2 event`, {
          feedId: event.data.feed.id,
          errors: err.errors,
        });
      } else {
        logger.error(`Failed to parse Feed V2 event`, {
          feedId: event.data.feed.id,
          error: (err as Error).stack,
        });
      }
    }

    const cacheKey = `processing-${event.data.feed.id}`;

    try {
      const oldVal = await this.cacheStorageService.set({
        key: cacheKey,
        body: "1",
        getOldValue: true,
      });

      if (oldVal === "1") {
        logger.info(
          `Feed event for feed ${event.data.feed.id} is already being processed, skipping`,
          {
            feedId: event.data.feed.id,
          }
        );

        return;
      }

      // Require to be separated to use with MikroORM's decorator @UseRequestContext()
      await this.handleV2EventWithDb(event);

      this.logEventFinish(event, {
        success: true,
      });
    } catch (err) {
      this.logEventFinish(event, {
        success: false,
      });
    } finally {
      await this.cacheStorageService.del(cacheKey);
    }
  }

  @RabbitSubscribe({
    queue: MessageBrokerQueue.FeedArticleDeliveryResult,
    createQueueIfNotExists: true,
    queueOptions: {
      durable: true,
    },
    allowNonJsonMessages: true,
  })
  async onArticleDeliveryResult(result: ArticleDeliveryResult) {
    try {
      await pRetry(async () => {
        await this.handleArticleDeliveryResult(result);
      });
    } catch (err) {
      logger.warn(`Failed to handle article delivery result`, {
        err: (err as Error).stack,
        result,
      });
    }
  }

  @RabbitSubscribe({
    queue: MessageBrokerQueue.FeedDeleted,
    createQueueIfNotExists: true,
    queueOptions: {
      durable: true,
    },
    allowNonJsonMessages: true,
  })
  async onFeedDeleted(event: FeedDeletedEvent): Promise<void> {
    logger.debug(`Received feed deleted event`, { event });

    try {
      const data = await feedDeletedEventSchema.parse(event);

      await this.handleFeedDeletedEvent(data);
    } catch (err) {
      logger.error(`Failed to handle feed deleted event`, {
        event,
        detail: err instanceof z.ZodError ? err.issues : (err as Error).stack,
      });
    }
  }

  @UseRequestContext()
  private async handleArticleDeliveryResult({
    result,
    job,
  }: ArticleDeliveryResult) {
    const deliveryRecordId = job.id;
    const articleId = job.meta?.articleID;

    if (result.state === "error") {
      await this.deliveryRecordService.updateDeliveryStatus(deliveryRecordId, {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.Internal,
        internalMessage: result.message,
        articleId,
      });
    } else if (result.status === 400) {
      const responseBody = JSON.stringify(result.body);
      const record = await this.deliveryRecordService.updateDeliveryStatus(
        deliveryRecordId,
        {
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryErrorCode.ThirdPartyBadRequest,
          internalMessage: `Body: ${responseBody}, Request Body: ${job.options.body}`,
          externalDetail: JSON.stringify({
            type: "DISCORD_RESPONSE",
            data: {
              responseBody: result.body,
              requestBody: JSON.parse(job.options.body),
            },
          }),
          articleId,
        }
      );

      this.amqpConnection.publish(
        "",
        MessageBrokerQueue.FeedRejectedArticleDisableConnection,
        {
          data: {
            rejectedCode: ArticleDeliveryRejectedCode.BadRequest,
            articleId,
            rejectedMessage: responseBody,
            medium: {
              id: record.medium_id,
            },
            feed: {
              id: record.feed_id,
            },
          },
        }
      );
    } else if (result.status >= 500) {
      await this.deliveryRecordService.updateDeliveryStatus(deliveryRecordId, {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyInternal,
        internalMessage: `Body: ${JSON.stringify(result.body)}`,
        articleId,
      });
    } else if (result.status === 403) {
      const record = await this.deliveryRecordService.updateDeliveryStatus(
        deliveryRecordId,
        {
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryErrorCode.ThirdPartyForbidden,
          internalMessage: `Body: ${JSON.stringify(result.body)}`,
          articleId,
        }
      );

      this.amqpConnection.publish(
        "",
        MessageBrokerQueue.FeedRejectedArticleDisableConnection,
        {
          data: {
            rejectedCode: ArticleDeliveryRejectedCode.Forbidden,
            medium: {
              id: record.medium_id,
            },
            feed: {
              id: record.feed_id,
            },
          },
        }
      );
    } else if (result.status === 404) {
      const record = await this.deliveryRecordService.updateDeliveryStatus(
        deliveryRecordId,
        {
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryErrorCode.ThirdPartyNotFound,
          internalMessage: `Body: ${JSON.stringify(result.body)}`,
          articleId,
        }
      );

      this.amqpConnection.publish(
        "",
        MessageBrokerQueue.FeedRejectedArticleDisableConnection,
        {
          data: {
            rejectedCode: ArticleDeliveryRejectedCode.MediumNotFound,
            medium: {
              id: record.medium_id,
            },
            feed: {
              id: record.feed_id,
            },
          },
        }
      );
    } else if (result.status < 200 || result.status > 400) {
      await this.deliveryRecordService.updateDeliveryStatus(deliveryRecordId, {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.Internal,
        internalMessage: `Unhandled status code from Discord ${
          result.status
        } received. Body: ${JSON.stringify(result.body)}`,
        articleId,
      });
    } else {
      await this.deliveryRecordService.updateDeliveryStatus(deliveryRecordId, {
        status: ArticleDeliveryStatus.Sent,
        articleId,
      });
    }
  }

  @UseRequestContext()
  private async handleV2EventWithDb(event: FeedV2Event) {
    this.debugLog(
      `Handling event for feed ${event.data.feed.id} with url ${event.data.feed.url}`,
      {
        event,
      },
      event.debug
    );

    try {
      const {
        data: {
          feed: { url, blockingComparisons, passingComparisons },
        },
      } = event;

      this.debugLog(
        `Debug ${event.data.feed.id}: Fetching feed XML from ${url}`,
        {},
        event.debug
      );

      let lastHashSaved: string | null = null;

      if (
        await this.articlesService.hasPriorArticlesStored(event.data.feed.id)
      ) {
        lastHashSaved = await this.responseHashService.get({
          feedId: event.data.feed.id,
        });
      }

      let response: Awaited<
        ReturnType<typeof this.feedFetcherService.fetchWithGrpc>
      > | null = null;

      try {
        response = await this.feedFetcherService.fetchWithGrpc(url, {
          hashToCompare: lastHashSaved || undefined,
        });
      } catch (err) {
        if (
          err instanceof FeedRequestInternalException ||
          err instanceof FeedRequestParseException ||
          err instanceof FeedRequestBadStatusCodeException ||
          err instanceof FeedRequestFetchException ||
          err instanceof FeedRequestTimedOutException ||
          err instanceof FeedFetchGrpcException
        ) {
          this.debugLog(
            `Debug ${event.data.feed.id}: Ignoring feed event due to expected exception`,
            { exceptionName: (err as Error).name },
            event.debug
          );

          response = null;
        }

        return;
      }

      if (!response || !response.body) {
        this.debugLog(
          `Debug ${event.data.feed.id}: no response body. is pending request or` +
            ` matched hash`,
          {
            response,
          },
          event.debug
        );

        return;
      }

      this.debugLog(
        `Debug ${event.data.feed.id}: Parsing feed XML from ${url}`,
        {},
        event.debug
      );

      const { allArticles, articlesToDeliver: articles } =
        await this.articlesService.getArticlesToDeliverFromXml(response.body, {
          id: event.data.feed.id,
          blockingComparisons,
          passingComparisons,
          formatOptions: {
            dateFormat: event.data.feed.formatOptions?.dateFormat,
            dateTimezone: event.data.feed.formatOptions?.dateTimezone,
            disableImageLinkPreviews:
              event.data.feed.formatOptions?.disableImageLinkPreviews,
            dateLocale: event.data.feed.formatOptions?.dateLocale,
          },
          dateChecks: event.data.feed.dateChecks,
          debug: event.debug,
          useParserRules: getParserRules({ url: event.data.feed.url }),
          externalFeedProperties: event.data.feed.externalProperties,
        });

      await this.updateFeedArticlesInCache({ event, articles: allArticles });

      // START TEMPORARY - Should revisit this for a more robust retry strategy

      const foundRetryRecord = await this.feedRetryRecordRepo.findOne(
        {
          feed_id: event.data.feed.id,
        },
        {
          fields: ["id"],
        }
      );

      if (foundRetryRecord) {
        this.debugLog(
          `Debug ${event.data.feed.id}: Found and deleting retry record`,
          {},
          event.debug
        );

        await this.feedRetryRecordRepo.nativeDelete({
          id: foundRetryRecord.id,
        });
      }

      // END TEMPORARY

      if (!articles.length) {
        this.debugLog(
          `Debug ${event.data.feed.id}: Ignoring feed event due to no` +
            ` articles to deliver for url ${url}`,
          {},
          event.debug
        );

        await this.responseHashService.set({
          feedId: event.data.feed.id,
          hash: response.bodyHash,
        });

        return;
      }

      this.debugLog(
        `Debug ${event.data.feed.id}: Delivering ${articles.length} articles`,
        {},
        event.debug
      );

      const deliveryStates = await this.deliveryService.deliver(
        event,
        articles
      );

      this.debugLog(
        `Debug ${event.data.feed.id}: Storing delivery states`,
        {},
        event.debug
      );

      await this.deliveryRecordService.store(
        event.data.feed.id,
        deliveryStates,
        false
      );

      try {
        await this.orm.em.flush();
      } catch (err) {
        if (err instanceof UniqueConstraintViolationException) {
          logger.warn(
            `Failed to flush ORM due to unique constraint violation`,
            {
              event,
              error: (err as Error).stack,
            }
          );
        } else {
          logger.error(`Failed to flush ORM while handling feed event`, {
            event,
            error: (err as Error).stack,
          });
        }
      }

      await this.responseHashService.set({
        feedId: event.data.feed.id,
        hash: response.bodyHash,
      });
    } catch (err) {
      if (err instanceof InvalidFeedException) {
        logger.debug(`Ignoring feed event due to invalid feed`, {
          event,
          stack: (err as Error).stack,
        });

        const retryRecord = await this.feedRetryRecordRepo.findOne(
          {
            feed_id: event.data.feed.id,
          },
          {
            fields: ["id", "attempts_so_far"],
          }
        );

        // Rudimentary retry to alleviate some pressure
        if (retryRecord?.attempts_so_far && retryRecord.attempts_so_far >= 8) {
          this.debugLog(
            `Debug ${event.data.feed.id}: Exceeded retry limit for invalid feed` +
              `, sending disable event`,
            {},
            event.debug
          );

          this.amqpConnection.publish(
            "",
            MessageBrokerQueue.FeedRejectedDisableFeed,
            {
              data: {
                rejectedCode: FeedRejectedDisabledCode.InvalidFeed,
                feed: {
                  id: event.data.feed.id,
                },
              },
            }
          );

          await this.feedRetryRecordRepo.nativeDelete({
            id: retryRecord.id,
          });
        } else {
          this.debugLog(
            `Debug ${event.data.feed.id}: Updating retry record`,
            {
              currentAttempts: retryRecord?.attempts_so_far || 0,
              newAttempts: (retryRecord?.attempts_so_far || 0) + 1,
            },
            event.debug
          );

          await this.feedRetryRecordRepo.upsert({
            feed_id: event.data.feed.id,
            attempts_so_far: (retryRecord?.attempts_so_far || 0) + 1,
          });
          await this.orm.em.flush();
        }
      } else {
        logger.error(
          `Error while handling feed event: ${(err as Error).message}`,
          {
            err,
            feedId: event.data.feed.id,
            stack: (err as Error).stack,
          }
        );
      }

      throw err;
    }
  }

  @UseRequestContext()
  async handleFeedDeletedEvent(data: FeedDeletedEvent) {
    const {
      data: {
        feed: { id },
      },
    } = data;

    await this.articlesService.deleteInfoForFeed(id);

    await this.responseHashService.remove({
      feedId: id,
    });

    logger.debug(`Deleted feed info for feed ${id}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private debugLog(message: string, data: any, enable?: boolean) {
    if (enable) {
      logger.datadog(message, data);
    }

    logger.debug(message, data);
  }

  private logEventFinish(
    event: FeedV2Event,
    {
      success,
    }: {
      success: boolean;
    }
  ) {
    if (event.timestamp) {
      const nowTs = Date.now();
      const finishedTs = nowTs - event.timestamp;

      logger.datadog(`Finished handling user feed event in ${finishedTs}ms`, {
        duration: finishedTs,
        feedId: event.data.feed.id,
        feedURL: event.data.feed.url,
        success,
      });
    }
  }

  private async updateFeedArticlesInCache({
    event,
    articles,
  }: {
    event: FeedV2Event;
    articles: Article[];
  }) {
    const formatOptions: UserFeedFormatOptions = {
      dateFormat: event.data.feed.formatOptions?.dateFormat,
      dateTimezone: event.data.feed.formatOptions?.dateTimezone,
      disableImageLinkPreviews:
        event.data.feed.formatOptions?.disableImageLinkPreviews,
      dateLocale: event.data.feed.formatOptions?.dateLocale,
    };

    const cacheKeyParameters = {
      url: event.data.feed.url,
      options: {
        formatOptions,
        externalFeedProperties: event.data.feed.externalProperties,
      },
    };

    const existsInCache = await this.articlesService.doFeedArticlesExistInCache(
      cacheKeyParameters
    );

    if (!existsInCache) {
      return;
    }

    await this.articlesService.setFeedArticlesInCache(
      {
        ...cacheKeyParameters,
        data: {
          articles,
        },
      },
      {
        useOldTTL: true,
      }
    );
  }
}
