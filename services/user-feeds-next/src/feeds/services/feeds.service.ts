/**
 * Feeds service for article querying and filtering.
 * Matches user-feeds FeedsService behavior.
 */

import type { Article } from "../../articles/parser";
import { INJECTED_ARTICLE_PLACEHOLDER_PREFIX } from "../../shared/constants";
import {
  SelectPropertyType,
  type CustomPlaceholder,
} from "../../http/schemas";
import { getNumbersInRange } from "./utils";

export interface PaginateArticlesInput {
  articles: Article[];
  limit: number;
  skip: number;
  random?: boolean;
  selectProperties?: string[];
  selectPropertyTypes?: SelectPropertyType[];
  customPlaceholders?: CustomPlaceholder[] | null;
  filters?: {
    articleId?: string;
    articleIdHashes?: string[];
    search?: string;
  };
}

export interface PaginateArticlesOutput {
  articles: Article[];
  totalArticles: number;
  properties: string[];
}

/**
 * Paginate articles: sort, filter by ID/search, and apply skip/limit.
 * Does NOT trim properties or evaluate filter expressions — those happen after formatting.
 */
export function paginateArticles({
  articles,
  limit,
  skip,
  random,
  selectProperties,
  selectPropertyTypes,
  customPlaceholders,
  filters,
}: PaginateArticlesInput): PaginateArticlesOutput {
  const placeholdersFromCustomPlaceholders =
    customPlaceholders?.map((c) => c.sourcePlaceholder) || [];
  const properties = queryForArticleProperties(
    articles,
    selectProperties?.concat(placeholdersFromCustomPlaceholders),
    selectPropertyTypes
  );

  if (articles.length === 0) {
    return { articles: [], properties, totalArticles: 0 };
  }

  // Sort by date, latest first
  let matchedArticles: Article[] = [...articles].sort(
    ({ raw: rawA }, { raw: rawB }) => {
      const dateA = rawA["date"];

      if (dateA) {
        const dateB = rawB["date"];

        if (dateB) {
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        }
      }

      return 0;
    }
  );
  let totalMatchedArticles = articles.length;

  // Filter by article ID or hashes
  if (filters?.articleId || filters?.articleIdHashes?.length) {
    const targetIds = filters.articleId
      ? new Set([filters.articleId])
      : new Set(filters.articleIdHashes);

    matchedArticles = articles.filter(
      (article) =>
        targetIds.has(article.flattened.id) ||
        targetIds.has(article.flattened.idHash)
    );
    totalMatchedArticles = matchedArticles.length;
  } else {
    // Text search
    const filtersSearch = filters?.search;

    if (filtersSearch && typeof filtersSearch === "string") {
      matchedArticles = matchedArticles.filter((article) => {
        return properties.some((property) =>
          article.flattened[property]
            ?.toLowerCase()
            .includes(filtersSearch.toLowerCase())
        );
      });

      totalMatchedArticles = matchedArticles.length;
    }

    // Pagination
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
        return matchedArticles[index]!;
      });
    }
  }

  return {
    articles: matchedArticles,
    totalArticles: totalMatchedArticles,
    properties,
  };
}

/**
 * Get properties to include in response.
 */
function queryForArticleProperties(
  articles: Article[],
  requestedProperties?: string[],
  selectPropertyTypes?: SelectPropertyType[]
): string[] {
  let properties: string[] = requestedProperties || [];

  if (selectPropertyTypes?.length) {
    if (properties.includes("*")) {
      properties = [];
    }

    articles.forEach((a) => {
      Object.entries(a.flattened).forEach(([key, value]) => {
        const isUrl = value?.startsWith("http");
        const isExternalInjection = key.startsWith(
          INJECTED_ARTICLE_PLACEHOLDER_PREFIX
        );

        if (
          selectPropertyTypes.includes(SelectPropertyType.Url) &&
          isUrl &&
          !properties.includes(key)
        ) {
          properties.push(key);
        }

        if (
          selectPropertyTypes.includes(SelectPropertyType.ExternalInjections) &&
          isExternalInjection &&
          !properties.includes(key)
        ) {
          properties.push(key);
        }
      });
    });
  } else if (properties.includes("*")) {
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
