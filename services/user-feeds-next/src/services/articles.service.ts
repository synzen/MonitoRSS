/**
 * Articles service for fetching and parsing RSS articles.
 * Matches user-feeds ArticlesService behavior.
 */

import { fetchFeed, FeedResponseRequestStatus } from "../feed-fetcher";
import {
  parseArticlesFromXml,
  injectExternalContent,
  type Article,
  type UserFeedFormatOptions,
  type ExternalFeedProperty,
} from "../article-parser";
import { FeedArticleNotFoundException } from "../feed-fetcher/exceptions";

export interface FetchFeedArticleOptions {
  formatOptions?: UserFeedFormatOptions;
  externalFeedProperties?: ExternalFeedProperty[];
  requestLookupDetails?: {
    key: string;
    url?: string;
    headers?: Record<string, string>;
  } | null;
}

export interface FindOrFetchFeedArticlesOptions extends FetchFeedArticleOptions {
  findRssFromHtml?: boolean;
  executeFetch?: boolean;
  executeFetchIfStale?: boolean;
}

export interface FetchFeedArticlesResult {
  output: {
    articles: Article[];
    feed: {
      title?: string;
    };
  };
  url: string;
  attemptedToResolveFromHtml: boolean;
}

/**
 * Fetch and parse articles from a feed URL.
 */
export async function findOrFetchFeedArticles(
  url: string,
  options: FindOrFetchFeedArticlesOptions
): Promise<FetchFeedArticlesResult> {
  const result = await fetchFeed(url, {
    executeFetch: options.executeFetch,
    executeFetchIfStale: options.executeFetchIfStale,
    lookupDetails: options.requestLookupDetails,
  });

  if (result.requestStatus !== FeedResponseRequestStatus.Success) {
    // Feed not ready, return empty
    return {
      output: {
        articles: [],
        feed: {},
      },
      url,
      attemptedToResolveFromHtml: false,
    };
  }

  let { articles, feed } = await parseArticlesFromXml(result.body, {
    formatOptions: options.formatOptions,
  });

  // Inject external content if external properties are specified
  if (options.externalFeedProperties?.length) {
    await injectExternalContent(
      articles,
      options.externalFeedProperties,
      async (articleUrl: string) => {
        const response = await fetch(articleUrl);
        return response.text();
      }
    );
  }

  return {
    output: {
      articles,
      feed,
    },
    url,
    attemptedToResolveFromHtml: false,
  };
}

/**
 * Fetch a specific article by ID.
 */
export async function fetchFeedArticle(
  url: string,
  articleId: string,
  options: FetchFeedArticleOptions
): Promise<Article | null> {
  const { output } = await findOrFetchFeedArticles(url, options);

  const article = output.articles.find((a) => a.flattened.id === articleId);

  if (!article) {
    throw new FeedArticleNotFoundException(
      `Article with ID "${articleId}" not found in feed`
    );
  }

  return article;
}

/**
 * Fetch a random article from a feed.
 */
export async function fetchRandomFeedArticle(
  url: string,
  options: FetchFeedArticleOptions
): Promise<Article | null> {
  const { output } = await findOrFetchFeedArticles(url, options);

  if (!output.articles.length) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * output.articles.length);
  return output.articles[randomIndex] ?? null;
}
