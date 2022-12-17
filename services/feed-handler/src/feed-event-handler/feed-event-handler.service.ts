import { Injectable } from "@nestjs/common";
import { ValidationError } from "yup";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";
import { ArticlesService } from "../articles/articles.service";
import { DeliveryRecordService } from "../delivery-record/delivery-record.service";
import { DeliveryService } from "../delivery/delivery.service";
import { FeedFetcherService } from "../feed-fetcher/feed-fetcher.service";
import {
  ArticleDeliveryRejectedCode,
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  BrokerQueue,
  FeedV2Event,
  feedV2EventSchema,
} from "../shared";
import { RabbitSubscribe, AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { MikroORM, UseRequestContext } from "@mikro-orm/core";

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
        console.log(`Failed to store delivery states`, {
          event,
          deliveryStates,
          error: (err as Error).stack,
        });
      }

      try {
        this.emitDisableEvents(event, deliveryStates);
      } catch (err) {
        console.error(`Failed to emit disable event after processing feed`, {
          event,
          deliveryStates,
          error: (err as Error).stack,
        });
      }

      console.log(`Total new articles:`, articles.length);
    } catch (err) {
      console.error(`Error while handling feed event`, {
        stack: (err as Error).stack,
      });
    }
  }

  emitDisableEvents(
    { data: { feed } }: FeedV2Event,
    deliveryStates: ArticleDeliveryState[]
  ) {
    deliveryStates.forEach((state) => {
      if (state.status !== ArticleDeliveryStatus.Rejected) {
        return;
      }

      if (state.errorCode === ArticleDeliveryRejectedCode.BadRequest) {
        this.amqpConnection.publish(
          "",
          BrokerQueue.FeedRejectedArticleDisable,
          {
            data: {
              medium: {
                id: state.mediumId,
              },
              feed: {
                id: feed.id,
              },
            },
          }
        );
      }
    });
  }
}
