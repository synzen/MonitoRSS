import { Injectable } from "@nestjs/common";
import { ArticleFiltersService } from "../article-filters/article-filters.service";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";
import {
  Article,
  ArticleDeliveryErrorCode,
  FeedV2Event,
  MediumKey,
  MediumPayload,
} from "../shared";
import { DeliveryMedium } from "./mediums/delivery-medium.interface";
import { DiscordMediumService } from "./mediums/discord-medium.service";
import { ArticleDeliveryState, ArticleDeliveryStatus } from "./types";

interface LimitState {
  remaining: number;
}

@Injectable()
export class DeliveryService {
  constructor(
    private readonly discordMediumService: DiscordMediumService,
    private readonly articleFiltersService: ArticleFiltersService,
    private readonly articleRateLimitService: ArticleRateLimitService
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
      await this.articleRateLimitService.getUnderLimitCheck(event.feed.id);

    /**
     * Rate limit handling in memory is not the best, especially since articles get dropped and
     * concurrency is not handled well, but it should be good enough for now.
     */
    const limitState = {
      remaining: underLimitInfo.remaining,
    };

    // Explicitly use for loop for track limit state
    for (let i = 0; i < event.mediums.length; ++i) {
      const medium = event.mediums[i];

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

      const articleState = await this.sendArticleToMedium(
        event,
        article,
        medium,
        limitState
      );

      results.push(articleState);
    }

    return results;
  }

  private async sendArticleToMedium(
    event: FeedV2Event,
    article: Article,
    medium: MediumPayload,
    limitState: LimitState
  ): Promise<ArticleDeliveryState> {
    try {
      if (limitState.remaining <= 0) {
        return {
          mediumId: medium.id,
          status: ArticleDeliveryStatus.RateLimited,
        };
      }

      const filterReferences = this.articleFiltersService.buildReferences({
        article,
      });

      const passesFilters = !medium.filters?.expression
        ? true
        : await this.articleFiltersService.getArticleFilterResults(
            medium.filters.expression,
            filterReferences
          );

      if (!passesFilters) {
        return {
          mediumId: medium.id,
          status: ArticleDeliveryStatus.FilteredOut,
        };
      }

      const articleState = await this.mediumServices[medium.key].deliverArticle(
        article,
        {
          mediumId: medium.id,
          deliverySettings: medium.details,
          feedDetails: event.feed,
        }
      );

      limitState.remaining--;

      return articleState;
    } catch (err) {
      console.error(
        `Failed to deliver event ${JSON.stringify(event)} to medium ${
          medium.key
        }`
      );

      return {
        mediumId: medium.id,
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.Internal,
        internalMessage: (err as Error).message,
      };
    }
  }
}
