import { Injectable } from "@nestjs/common";
import { ArticleFiltersService } from "../article-filters/article-filters.service";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";
import { Article } from "../shared";
import { getNumbersInRange } from "../shared/utils/get-numbers-in-range";
import { QueryForArticlesInput } from "./types";

interface InitializeFeedInputDto {
  rateLimit: {
    timeWindowSec: number;
    limit: number;
  };
}

@Injectable()
export class FeedsService {
  constructor(
    private readonly articleRateLimitsService: ArticleRateLimitService,
    private readonly articleFiltersService: ArticleFiltersService
  ) {}

  getRateLimitInformation(feedId: string) {
    return this.articleRateLimitsService.getFeedLimitInformation(feedId);
  }

  async initializeFeed(
    feedId: string,
    { rateLimit: { limit, timeWindowSec } }: InitializeFeedInputDto
  ) {
    // Used to display in UIs. May be dynamic later.
    await this.articleRateLimitsService.addOrUpdateFeedLimit(feedId, {
      timeWindowSec,
      limit,
    });
  }

  getFilterExpressionErrors(expression: Record<string, unknown>) {
    return this.articleFiltersService.getFilterExpressionErrors(expression);
  }

  queryForArticles({
    articles,
    limit,
    skip,
    random,
    selectProperties,
  }: QueryForArticlesInput) {
    const properties = this.queryForArticleProperties(
      articles,
      selectProperties
    );

    const max = Math.min(articles.length - 1, skip + limit - 1);

    const matchedArticles = getNumbersInRange({
      min: skip,
      max,
      countToGet: limit,
      random,
    }).map((index) => {
      const article = articles[index];
      const trimmed: Record<string, string> = {};

      properties.forEach((property) => {
        trimmed[property] = article[property] || "";
      });

      return trimmed;
    });

    return {
      articles: matchedArticles,
      properties,
    };
  }

  private queryForArticleProperties(
    articles: Article[],
    requestedProperties?: string[]
  ): string[] {
    let properties: string[] = requestedProperties || [];

    // Prefer title
    if (!properties.length && articles.every((article) => article.title)) {
      properties = ["id", "title"];
    }

    if (!properties.length) {
      properties = ["id"];
    }

    return properties;
  }
}
