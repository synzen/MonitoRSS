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
    customPlaceholders,
  }: QueryForArticlesInput): Promise<QueryForArticlesOutput> {
    const placeholdersFromCustomPlaceholders =
      customPlaceholders?.map((c) => c.sourcePlaceholder) || [];
    const properties = this.queryForArticleProperties(
      articles,
      selectProperties?.concat(placeholdersFromCustomPlaceholders)
    );

    if (articles.length === 0) {
      return {
        articles: [],
        properties,
        totalArticles: 0,
        filterEvalResults: [],
      };
    }

    let matchedArticles: Article[] = articles;
    let totalMatchedArticles = articles.length;

    if (filters?.articleId) {
      matchedArticles = articles.filter(
        (article) => article.flattened.id === filters.articleId
      );
      totalMatchedArticles = 1;
    } else {
      const filtersSearch = filters?.search;

      if (filtersSearch && typeof filtersSearch === "string") {
        matchedArticles = articles.filter((article) => {
          return properties.some((property) =>
            article.flattened[property]
              .toLowerCase()
              .includes(filtersSearch.toLowerCase())
          );
        });

        totalMatchedArticles = matchedArticles.length;
      }

      if (matchedArticles.length > 0) {
        const max = !random
          ? Math.min(matchedArticles.length - 1, skip + limit - 1)
          : matchedArticles.length - 1;

        matchedArticles = getNumbersInRange({
          min: skip,
          max,
          countToGet: limit,
          random,
        }).map((index) => {
          return matchedArticles[index];
        });
      }
    }

    const matchedArticlesWithProperties = matchedArticles.map((article) => {
      const trimmed: Article = {
        flattened: {
          id: article.flattened.id,
          idHash: article.flattened.idHash,
        },
        raw: article.raw,
      };

      properties.forEach((property) => {
        trimmed.flattened[property] = article.flattened[property] || "";
      });

      return trimmed;
    });

    let filterEvalResults: Array<{ passed: boolean }> | undefined;

    if (
      filters?.returnType ===
      GetUserFeedArticlesFilterReturnType.IncludeEvaluationResults
    ) {
      if (filters.expression) {
        filterEvalResults = await Promise.all(
          matchedArticles.map(async (article) => ({
            passed: await this.articleFiltersService.evaluateExpression(
              filters.expression as unknown as LogicalExpression,
              this.articleFiltersService.buildReferences({
                article,
              })
            ),
          }))
        );
      } else {
        filterEvalResults = matchedArticles.map(() => ({ passed: true }));
      }
    }

    return {
      articles: matchedArticlesWithProperties,
      totalArticles: totalMatchedArticles,
      properties,
      filterEvalResults: filterEvalResults,
    };
  }

  private queryForArticleProperties(
    articles: Article[],
    requestedProperties?: string[]
  ): string[] {
    let properties: string[] = requestedProperties || [];

    if (properties.includes("*")) {
      properties = Array.from(
        new Set(articles.flatMap((article) => Object.keys(article.flattened)))
      );
    }

    // Prefer title
    if (
      !properties.length &&
      articles.some((article) => article.flattened.title)
    ) {
      properties = ["id", "title"];
    }

    if (!properties.length) {
      properties = ["id"];
    }

    return properties;
  }
}
