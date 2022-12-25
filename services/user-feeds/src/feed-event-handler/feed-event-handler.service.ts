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
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  BrokerQueue,
  FeedV2Event,
  feedV2EventSchema,
} from "../shared";
import { RabbitSubscribe, AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { MikroORM, UseRequestContext } from "@mikro-orm/core";
import { ArticleDeliveryResult } from "./types/article-delivery-result.type";
import logger from "../shared/utils/logger";

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
    queue: BrokerQueue.FeedDeliverArticles,
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
    queue: BrokerQueue.FeedArticleDeliveryResult,
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

      this.amqpConnection.publish("", BrokerQueue.FeedRejectedArticleDisable, {
        data: {
          medium: {
            id: record.medium_id,
          },
          feed: {
            id: record.feed_id,
          },
        },
      });
    } else if (result.status >= 500) {
      await this.deliveryRecordService.updateDeliveryStatus(deliveryRecordId, {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyInternal,
        internalMessage: `Discord rejected the request with status code ${
          result.status
        } Body: ${JSON.stringify(result.body)}`,
      });
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

      const feedXml = await this.feedFetcherService.fetch(url);

      if (!feedXml) {
        return;
      }

      const articles = await this.articlesService.getArticlesToDeliverFromXml(
        feedXml,
        {
          id: event.data.feed.id,
          blockingComparisons,
          passingComparisons,
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
      logger.error(`Error while handling feed event`, {
        event,
        stack: (err as Error).stack,
      });
    }
  }
}
