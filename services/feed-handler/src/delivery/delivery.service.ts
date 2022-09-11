import { Injectable } from "@nestjs/common";
import { ArticleFiltersService } from "../article-filters/article-filters.service";
import { Article, FeedV2Event, MediumKey, MediumPayload } from "../shared";
import { DeliveryMedium } from "./mediums/delivery-medium.interface";
import { DiscordMediumService } from "./mediums/discord-medium.service";

@Injectable()
export class DeliveryService {
  constructor(
    private readonly discordMediumService: DiscordMediumService,
    private readonly articleFiltersService: ArticleFiltersService
  ) {}

  private mediumServices: Record<MediumKey, DeliveryMedium> = {
    [MediumKey.Discord]: this.discordMediumService,
  };

  async deliver(event: FeedV2Event, articles: Article[]) {
    await Promise.all(
      event.mediums.map(async (medium) => {
        try {
          await this.deliverArticlesToMedium(event, articles, medium);
        } catch (err) {
          console.error(
            `Failed to deliver event ${JSON.stringify(event)} to medium ${
              medium.key
            }`
          );
        }
      })
    );
  }

  private async deliverArticlesToMedium(
    event: FeedV2Event,
    articles: Article[],
    medium: MediumPayload
  ) {
    await Promise.all(
      articles.map(async (article) => {
        const filterReferences = this.articleFiltersService.buildReferences({
          article,
        });

        const passesFilters = !medium.filters.expression
          ? true
          : this.articleFiltersService.getArticleFilterResults(
              medium.filters.expression,
              filterReferences
            );

        if (!passesFilters) {
          return;
        }

        try {
          await this.mediumServices[medium.key].deliverArticle(article, {
            deliverySettings: medium.details,
            feedDetails: event.feed,
          });
        } catch (err) {
          console.error(
            `Failed to deliver event ${JSON.stringify(event)} to medium ${
              medium.key
            }`
          );
        }
      })
    );
  }
}
