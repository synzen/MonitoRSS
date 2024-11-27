import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { ArticleFiltersService } from "../article-filters/article-filters.service";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";
import { DuplicateArticleException } from "../articles/exceptions/duplicate-article.exception";
import { CacheStorageService } from "../cache-storage/cache-storage.service";
import {
  Article,
  ArticleDeliveryErrorCode,
  FeedV2Event,
  MediumKey,
  MediumPayload,
} from "../shared";
import { RegexEvalException } from "../shared/exceptions";
import logger from "../shared/utils/logger";
import { DeliveryMedium } from "./mediums/delivery-medium.interface";
import { DiscordMediumService } from "./mediums/discord-medium.service";
import { ArticleDeliveryState, ArticleDeliveryStatus } from "./types";

interface LimitState {
  remaining: number;
  remainingInMedium: number;
}

@Injectable()
export class DeliveryService {
  constructor(
    private readonly discordMediumService: DiscordMediumService,
    private readonly articleFiltersService: ArticleFiltersService,
    private readonly articleRateLimitService: ArticleRateLimitService,
    private readonly cacheStorageService: CacheStorageService
  ) {}

  private mediumServices: Record<MediumKey, DeliveryMedium> = {
    [MediumKey.Discord]: this.discordMediumService,
  };

  async deliver(
    event: FeedV2Event,
    articles: Article[]
  ): Promise<ArticleDeliveryState[]> {
    let articleStates: ArticleDeliveryState[] = [];
    const underLimitInfo =
      await this.articleRateLimitService.getUnderLimitCheckFromInputLimits(
        { feedId: event.data.feed.id },
        [
          {
            limit: event.data.articleDayLimit,
            timeWindowSeconds: 86400,
          },
        ]
      );

    /**
     * Rate limit handling in memory is not the best, especially since articles get dropped and
     * concurrency is not handled well, but it should be good enough for now.
     */
    const limitState = {
      remaining: underLimitInfo.remaining,
      remainingInMedium: Number.MAX_SAFE_INTEGER,
    };

    // Explicitly use for loop for track limit state
    for (let i = 0; i < event.data.mediums.length; ++i) {
      const medium = event.data.mediums[i];

      const underLimitInfoOfMedium =
        await this.articleRateLimitService.getUnderLimitCheckFromInputLimits(
          { mediumId: medium.id },
          medium.rateLimits || []
        );

      limitState.remainingInMedium = underLimitInfoOfMedium.remaining;

      const mediumStates = await this.deliverArticlesToMedium(
        event,
        articles,
        medium,
        limitState
      );

      articleStates = articleStates.concat(mediumStates);
    }

    return articleStates;
  }

  private async deliverArticlesToMedium(
    event: FeedV2Event,
    articles: Article[],
    medium: MediumPayload,
    limitState: LimitState
  ): Promise<ArticleDeliveryState[]> {
    const results: ArticleDeliveryState[] = [];

    // Explicitly use for loop for track limit state
    for (let i = 0; i < articles.length; ++i) {
      const article = articles[i];

      const articleStates = await this.sendArticleToMedium(
        event,
        article,
        medium,
        limitState,
        randomUUID()
      );

      results.push(...articleStates);
    }

    return results;
  }

  private async sendArticleToMedium(
    event: FeedV2Event,
    article: Article,
    medium: MediumPayload,
    limitState: LimitState,
    deliveryId: string
  ): Promise<ArticleDeliveryState[]> {
    try {
      if (limitState.remaining <= 0 || limitState.remainingInMedium <= 0) {
        return [
          {
            id: deliveryId,
            mediumId: medium.id,
            status:
              limitState.remaining <= 0
                ? ArticleDeliveryStatus.RateLimited
                : ArticleDeliveryStatus.MediumRateLimitedByUser,
            articleIdHash: article.flattened.idHash,
          },
        ];
      }

      const mediumService = this.mediumServices[medium.key];

      const formattedArticle = await mediumService.formatArticle(article, {
        ...medium.details.formatter,
        customPlaceholders: medium.details.customPlaceholders,
      });

      const filterReferences = this.articleFiltersService.buildReferences({
        article: formattedArticle,
      });

      if (medium.filters?.expression) {
        const { result, explainBlocked } =
          await this.articleFiltersService.evaluateExpression(
            medium.filters.expression,
            filterReferences
          );

        if (!result) {
          return [
            {
              id: deliveryId,
              mediumId: medium.id,
              status: ArticleDeliveryStatus.FilteredOut,
              articleIdHash: article.flattened.idHash,
              externalDetail: explainBlocked.length
                ? JSON.stringify({
                    explainBlocked,
                  })
                : null,
            },
          ];
        }
      }

      const cacheKey = `delivery:${event.data.feed.id}:${medium.id}:${article.flattened.idHash}`;

      const oldVal = await this.cacheStorageService.set({
        key: cacheKey,
        getOldValue: true,
        expSeconds: 60 * 3,
        body: "1",
      });

      if (oldVal) {
        logger.warn(
          `Article already delivered to feed ${event.data.feed.id}, medium ${medium.id},` +
            ` article ${formattedArticle.flattened.id}`
        );

        return [];
      }

      const articleStates = await mediumService.deliverArticle(
        formattedArticle,
        {
          deliveryId,
          mediumId: medium.id,
          deliverySettings: medium.details,
          feedDetails: event.data.feed,
          filterReferences: filterReferences,
        }
      );

      limitState.remaining--;
      limitState.remainingInMedium--;

      return articleStates;
    } catch (err) {
      if (err instanceof RegexEvalException) {
        return [
          {
            id: deliveryId,
            mediumId: medium.id,
            status: ArticleDeliveryStatus.Rejected,
            articleIdHash: article.flattened.idHash,
            errorCode: ArticleDeliveryErrorCode.ArticleProcessingError,
            internalMessage: (err as Error).message,
            externalDetail: JSON.stringify({
              message: (err as Error).message,
            }),
          },
        ];
      }

      logger.error(
        `Failed to deliver article to medium ${medium.key}: ${
          (err as Error).message
        }`,
        {
          event,
          error: (err as Error).stack,
        }
      );

      return [
        {
          id: deliveryId,
          mediumId: medium.id,
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.Internal,
          internalMessage: (err as Error).message,
          articleIdHash: article.flattened.idHash,
        },
      ];
    }
  }
}
