import { Injectable } from "@nestjs/common";
import { ArticleFiltersService } from "../article-filters/article-filters.service";
import { LogicalExpression } from "../article-filters/types";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";
import { Article } from "../shared";
import { getNumbersInRange } from "../shared/utils/get-numbers-in-range";
import { GetUserFeedArticlesFilterReturnType } from "./constants";
import { QueryForArticlesInput, QueryForArticlesOutput } from "./types";

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

  async queryForArticles({
    articles,
    limit,
    skip,
    random,
    selectProperties,
    filters,
  }: QueryForArticlesInput): Promise<QueryForArticlesOutput> {
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

    let filterEvalResults: Array<{ passed: boolean }> | undefined;

    if (filters?.expression) {
      if (
        filters.returnType ===
        GetUserFeedArticlesFilterReturnType.IncludeEvaluationResults
      ) {
        filterEvalResults = await Promise.all(
          matchedArticles.map(async (article) => ({
            passed: await this.articleFiltersService.evaluateExpression(
              filters.expression as unknown as LogicalExpression,
              article
            ),
          }))
        );
      }
    }

    return {
      articles: matchedArticles,
      properties,
      filterEvalResults: filterEvalResults,
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
