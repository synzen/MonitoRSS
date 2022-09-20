import { Injectable } from "@nestjs/common";
import { ArticleFiltersService } from "../article-filters/article-filters.service";
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

@Injectable()
export class DeliveryService {
  constructor(
    private readonly discordMediumService: DiscordMediumService,
    private readonly articleFiltersService: ArticleFiltersService
  ) {}

  private mediumServices: Record<MediumKey, DeliveryMedium> = {
    [MediumKey.Discord]: this.discordMediumService,
  };

  async deliver(
    event: FeedV2Event,
    articles: Article[]
  ): Promise<ArticleDeliveryState[]> {
    let articleStates: ArticleDeliveryState[] = [];

    await Promise.all(
      event.mediums.map(async (medium) => {
        articleStates = articleStates.concat(
          await this.deliverArticlesToMedium(event, articles, medium)
        );
      })
    );

    return articleStates;
  }

  private async deliverArticlesToMedium(
    event: FeedV2Event,
    articles: Article[],
    medium: MediumPayload
  ): Promise<ArticleDeliveryState[]> {
    return Promise.all(
      articles.map(async (article) =>
        this.sendArticleToMedium(event, article, medium)
      )
    );
  }

  private async sendArticleToMedium(
    event: FeedV2Event,
    article: Article,
    medium: MediumPayload
  ): Promise<ArticleDeliveryState> {
    try {
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
          status: ArticleDeliveryStatus.FilteredOut,
        };
      }

      return await this.mediumServices[medium.key].deliverArticle(article, {
        deliverySettings: medium.details,
        feedDetails: event.feed,
      });
    } catch (err) {
      console.error(
        `Failed to deliver event ${JSON.stringify(event)} to medium ${
          medium.key
        }`
      );

      return {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.Internal,
        internalMessage: (err as Error).message,
      };
    }
  }
}
