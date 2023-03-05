import { Injectable } from "@nestjs/common";
import { ValidationError } from "yup";
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
} from "../shared";
import { RabbitSubscribe, AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { MikroORM, UseRequestContext } from "@mikro-orm/core";
import { ArticleDeliveryResult } from "./types/article-delivery-result.type";
import logger from "../shared/utils/logger";
import {
  FeedRequestBadStatusCodeException,
  FeedRequestFetchException,
  FeedRequestInternalException,
  FeedRequestParseException,
} from "../feed-fetcher/exceptions";
import { FeedDeletedEvent } from "./types";
import { feedDeletedEventSchema } from "./schemas";

@Injectable()
export class FeedEventHandlerService {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly articleRateLimitService: ArticleRateLimitService,
    private readonly feedFetcherService: FeedFetcherService,
    private readonly deliveryService: DeliveryService,
    private readonly deliveryRecordService: DeliveryRecordService,
    private readonly amqpConnection: AmqpConnection,
    private readonly orm: MikroORM // Required for @UseRequestContext()
  ) {}

  @RabbitSubscribe({
    exchange: "",
    queue: MessageBrokerQueue.FeedDeliverArticles,
  })
  async handleV2Event(event: FeedV2Event): Promise<void> {
    try {
      await feedV2EventSchema.validate(event, {
        abortEarly: false,
      });
    } catch (err) {
      const validationErrr = err as ValidationError;

      throw new Error(
        `Validation failed on incoming Feed V2 event: ${validationErrr.errors}`
      );
    }

    // Require to be separated to use with MikroORM's decorator @UseRequestContext()
    await this.handleV2EventWithDb(event);
  }

  @RabbitSubscribe({
    queue: MessageBrokerQueue.FeedArticleDeliveryResult,
    createQueueIfNotExists: true,
    queueOptions: {
      durable: true,
    },
    allowNonJsonMessages: true,
  })
  async onArticleDeliveryResult(result: ArticleDeliveryResult): Promise<void> {
    try {
      await this.handleArticleDeliveryResult(result);
    } catch (err) {
      logger.error(`Failed to handle article delivery result`, {
        err: (err as Error).stack,
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
    try {
      logger.debug(`Received feed deleted event`, { event });
      const data = await feedDeletedEventSchema.validate(event);

      await this.handleFeedDeletedEvent(data);
    } catch (err) {
      logger.error(`Failed to handle feed deleted event`, {
        err: (err as Error).stack,
        event,
      });
    }
  }

  @UseRequestContext()
  private async handleArticleDeliveryResult({
    result,
    job,
  }: ArticleDeliveryResult) {
    const deliveryRecordId = job.id;

    if (result.state === "error") {
      await this.deliveryRecordService.updateDeliveryStatus(deliveryRecordId, {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.Internal,
        internalMessage: result.message,
      });
    } else if (result.status === 400) {
      const record = await this.deliveryRecordService.updateDeliveryStatus(
        deliveryRecordId,
        {
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryRejectedCode.BadRequest,
          internalMessage: `Discord rejected the request with status code ${
            result.status
          } Body: ${JSON.stringify(result.body)}`,
        }
      );

      this.amqpConnection.publish(
        "",
        MessageBrokerQueue.FeedRejectedArticleDisableConnection,
        {
          data: {
            rejectedCode: ArticleDeliveryRejectedCode.BadRequest,
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
        internalMessage: `Discord rejected the request with status code ${
          result.status
        } Body: ${JSON.stringify(result.body)}`,
      });
    } else if (result.status === 403) {
      const record = await this.deliveryRecordService.updateDeliveryStatus(
        deliveryRecordId,
        {
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryRejectedCode.Forbidden,
          internalMessage: `Discord rejected the request with status code ${
            result.status
          } Body: ${JSON.stringify(result.body)}`,
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
          errorCode: ArticleDeliveryRejectedCode.MediumNotFound,
          internalMessage: `Discord rejected the request with status code ${
            result.status
          } Body: ${JSON.stringify(result.body)}`,
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
      });
    } else {
      await this.deliveryRecordService.updateDeliveryStatus(deliveryRecordId, {
        status: ArticleDeliveryStatus.Sent,
      });
    }
  }

  @UseRequestContext()
  private async handleV2EventWithDb(event: FeedV2Event) {
    try {
      // Used for displaying in UIs
      await this.articleRateLimitService.addOrUpdateFeedLimit(
        event.data.feed.id,
        {
          // hardcode seconds in a day for now
          timeWindowSec: 86400,
          limit: event.data.articleDayLimit,
        }
      );

      const {
        data: {
          feed: { url, blockingComparisons, passingComparisons },
        },
      } = event;

      let feedXml: string | null;

      try {
        feedXml = await this.feedFetcherService.fetch(url);
      } catch (err) {
        if (
          err instanceof FeedRequestInternalException ||
          err instanceof FeedRequestParseException ||
          err instanceof FeedRequestBadStatusCodeException ||
          err instanceof FeedRequestFetchException
        ) {
          logger.debug(`Ignoring feed event due to expected exception`, {
            exceptionName: (err as Error).name,
          });

          return;
        }

        throw err;
      }

      if (!feedXml) {
        logger.debug(
          `Ignoring feed event due to empty feed XML (likely pending request)`
        );

        return;
      }

      const articles = await this.articlesService.getArticlesToDeliverFromXml(
        feedXml,
        {
          id: event.data.feed.id,
          blockingComparisons,
          passingComparisons,
          formatOptions: {
            dateFormat: event.data.feed.formatOptions?.dateFormat,
            dateTimezone: event.data.feed.formatOptions?.dateTimezone,
          },
        }
      );

      if (!articles.length) {
        return;
      }

      const deliveryStates = await this.deliveryService.deliver(
        event,
        articles
      );

      try {
        await this.deliveryRecordService.store(
          event.data.feed.id,
          deliveryStates
        );
      } catch (err) {
        logger.error(`Failed to store delivery states`, {
          event,
          deliveryStates,
          error: (err as Error).stack,
        });
      }
    } catch (err) {
      logger.error(
        `Error while handling feed event: ${(err as Error).message}`,
        {
          err,
          event,
          stack: (err as Error).stack,
        }
      );
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

    logger.debug(`Deleted feed info for feed ${id}`);
  }
}
