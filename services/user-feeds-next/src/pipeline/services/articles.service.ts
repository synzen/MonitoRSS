/**
 * Articles service for fetching and parsing RSS articles.
 * Matches user-feeds ArticlesService behavior.
 */

import { fetchFeed, FeedResponseRequestStatus } from "../../feed-fetcher";
import {
  injectExternalContent,
  InvalidFeedException,
  parseArticlesFromXml,
  type Article,
  type UserFeedFormatOptions,
  type ExternalFeedProperty,
  type ExternalContentError,
} from "../../articles/parser";
import { FeedArticleNotFoundException } from "../../feed-fetcher/exceptions";
import { parse as parseHtml, valid as isValidHtml } from "node-html-parser";
import {
  getFeedArticlesFromCache,
  setFeedArticlesInCache,
  refreshFeedArticlesCacheExpiration,
} from "../../stores/parsed-articles-cache-helpers";
import type {
  ParsedArticlesCacheStore,
  CacheKeyOptions,
} from "../../stores/interfaces/parsed-articles-cache";

export interface FetchFeedArticleOptions {
  formatOptions?: UserFeedFormatOptions;
  externalFeedProperties?: ExternalFeedProperty[];
  /** Include raw HTML in NO_SELECTOR_MATCH errors for troubleshooting (preview mode only) */
  includeHtmlInErrors?: boolean;
  requestLookupDetails?: {
    key: string;
    url?: string;
    headers?: Record<string, string>;
  } | null;
  feedRequestsServiceHost: string;
  parsedArticlesCacheStore: ParsedArticlesCacheStore;
}

export interface FindOrFetchFeedArticlesOptions extends FetchFeedArticleOptions {
  findRssFromHtml?: boolean;
  executeFetch?: boolean;
  executeFetchIfStale?: boolean;
  lightweight?: boolean;
}

export interface FetchFeedArticlesResult {
  output: {
    articles: Article[];
    feed: {
      title?: string;
    };
    externalContentErrors?: ExternalContentError[];
  };
  url: string;
  attemptedToResolveFromHtml: boolean;
}

/**
 * Extract RSS feed URL from HTML page by looking for link tags.
 */
function extractRssFromHtml(html: string): string | null {
  if (!isValidHtml(html)) {
    return null;
  }

  const root = parseHtml(html);
  const elem = root.querySelector('link[type="application/rss+xml"]');

  if (!elem) {
    return null;
  }

  return elem.getAttribute("href") || null;
}

/**
 * Try to get RSS URL for Reddit pages by appending .rss to the path.
 * Preserves the input host so that oauth.reddit.com URLs (used for OAuth-authenticated
 * fetches) keep hitting the OAuth endpoint instead of getting rewritten to www.reddit.com.
 */
export function tryGetRedditRssUrl(url: string): string | null {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname !== "reddit.com" &&
    hostname !== "www.reddit.com" &&
    hostname !== "old.reddit.com" &&
    hostname !== "oauth.reddit.com"
  ) {
    return null;
  }

  if (parsed.pathname.endsWith(".rss")) {
    return null;
  }

  const cleaned = parsed.pathname.replace(/\/+$/, "");

  return `${parsed.protocol}//${parsed.host}${cleaned}.rss${parsed.search}`;
}

/**
 * Fetch and parse articles from a feed URL.
 */
export async function findOrFetchFeedArticles(
  inputUrl: string,
  inputOptions: FindOrFetchFeedArticlesOptions,
): Promise<FetchFeedArticlesResult> {
  const url = tryGetRedditRssUrl(inputUrl) ?? inputUrl;

  const lookupDetailsUrl = inputOptions.requestLookupDetails?.url;
  const options =
    lookupDetailsUrl && inputOptions.requestLookupDetails
      ? {
          ...inputOptions,
          requestLookupDetails: {
            ...inputOptions.requestLookupDetails,
            url: tryGetRedditRssUrl(lookupDetailsUrl) ?? lookupDetailsUrl,
          },
        }
      : inputOptions;

  const { parsedArticlesCacheStore } = options;

  const cacheKeyOptions: CacheKeyOptions = {
    formatOptions: {
      dateFormat: options.formatOptions?.dateFormat,
      dateTimezone: options.formatOptions?.dateTimezone,
      dateLocale: options.formatOptions?.dateLocale,
    },
    externalFeedProperties: options.lightweight
      ? undefined
      : options.externalFeedProperties,
    requestLookupDetails: options.requestLookupDetails ?? undefined,
    lightweight: options.lightweight,
  };

  // Check cache first
  const cachedArticles = await getFeedArticlesFromCache(
    parsedArticlesCacheStore,
    {
      url,
      options: cacheKeyOptions,
    },
  );

  if (cachedArticles) {
    await refreshFeedArticlesCacheExpiration(parsedArticlesCacheStore, {
      url,
      options: cacheKeyOptions,
    });

    return {
      output: {
        articles: cachedArticles.articles,
        feed: cachedArticles.feed ?? {},
      },
      url,
      attemptedToResolveFromHtml: false,
    };
  }

  // Credentialed feeds (reddit) must be fetched via the lookup URL (oauth.reddit.com
  // with the Authorization header), exactly like the delivery pipeline does in
  // shared-processing. The original url remains the feed's display/cache identity.
  const result = await fetchFeed(options.requestLookupDetails?.url || url, {
    executeFetch: options.executeFetch,
    executeFetchIfNotInCache: true,
    executeFetchIfStale: options.executeFetchIfStale,
    lookupDetails: options.requestLookupDetails,
    serviceHost: options.feedRequestsServiceHost,
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

  let articles: Article[];
  let feed: { title?: string };
  let resolvedUrl = url;
  let attemptedToResolveFromHtml = false;

  try {
    const parsed = await parseArticlesFromXml(result.body, {
      formatOptions: options.formatOptions,
      lightweight: options.lightweight,
    });
    articles = parsed.articles;
    feed = parsed.feed;
  } catch (err) {
    if (err instanceof InvalidFeedException && options.findRssFromHtml) {
      attemptedToResolveFromHtml = true;

      // Try to extract RSS URL from HTML link tags
      const rssUrl = extractRssFromHtml(result.body);

      if (rssUrl) {
        const absoluteRssUrl = rssUrl.startsWith("/")
          ? new URL(url).origin + rssUrl
          : rssUrl;

        return findOrFetchFeedArticles(absoluteRssUrl, {
          ...options,
          findRssFromHtml: false,
        });
      }
    }

    throw err;
  }

  // Inject external content if external properties are specified (skip in lightweight mode)
  let externalContentErrors: ExternalContentError[] = [];
  if (!options.lightweight && options.externalFeedProperties?.length) {
    externalContentErrors = await injectExternalContent(
      articles,
      options.externalFeedProperties,
      async (articleUrl: string) => {
        try {
          const response = await fetch(articleUrl);
          return { body: await response.text(), statusCode: response.status };
        } catch {
          return { body: null };
        }
      },
      { includeHtmlInErrors: options.includeHtmlInErrors },
    );
  }

  // Store in cache for future requests
  await setFeedArticlesInCache(parsedArticlesCacheStore, {
    url: resolvedUrl,
    options: cacheKeyOptions,
    data: { articles, feed },
  });

  return {
    output: {
      articles,
      feed,
      externalContentErrors:
        externalContentErrors.length > 0 ? externalContentErrors : undefined,
    },
    url: resolvedUrl,
    attemptedToResolveFromHtml,
  };
}

/**
 * Fetch a specific article by ID.
 */
export async function fetchFeedArticle(
  url: string,
  articleId: string,
  options: FetchFeedArticleOptions,
): Promise<Article | null> {
  const { output } = await findOrFetchFeedArticles(url, options);

  const article = output.articles.find((a) => a.flattened.id === articleId);

  if (!article) {
    throw new FeedArticleNotFoundException(
      `Article with ID "${articleId}" not found in feed`,
    );
  }

  return article;
}

/**
 * Fetch a random article from a feed.
 */
export async function fetchRandomFeedArticle(
  url: string,
  options: FetchFeedArticleOptions,
): Promise<Article | null> {
  const { output } = await findOrFetchFeedArticles(url, options);

  if (!output.articles.length) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * output.articles.length);
  return output.articles[randomIndex] ?? null;
}
