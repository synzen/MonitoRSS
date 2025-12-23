/**
 * Shared feed processing logic used by both the production feed event handler
 * and the diagnostic API. This ensures consistent behavior between both paths.
 */

import { fetchFeed, FeedResponseRequestStatus } from "../feed-fetcher";
import {
  FeedRequestInternalException,
  FeedRequestParseException,
  FeedRequestBadStatusCodeException,
  FeedRequestFetchException,
  FeedRequestTimedOutException,
  FeedRequestInvalidSslCertificateException,
} from "../feed-fetcher/exceptions";
import {
  FeedParseTimeoutException,
  InvalidFeedException,
  getParserRules,
  type ExternalFeedProperty,
} from "../articles/parser";
import { parseArticlesFromXmlWithWorkers as parseArticlesFromXml } from "../articles/parser/worker";
import type { Article } from "../articles/parser";

// ============================================================================
// Store Interfaces (minimal for shared processing)
// ============================================================================

/**
 * Minimal interface for checking if prior articles are stored.
 * Compatible with ArticleFieldStore.
 */
export interface HasPriorArticlesStore {
  hasPriorArticlesStored(feedId: string): Promise<boolean>;
}

/**
 * Minimal interface for getting response hashes.
 * Compatible with ResponseHashStore.
 */
export interface HashStore {
  get(feedId: string): Promise<string | null>;
}

// ============================================================================
// Types
// ============================================================================

export type FeedProcessingResult =
  | { status: "success"; articles: Article[]; bodyHash?: string }
  | { status: "matched-hash" }
  | {
      status: "fetch-error";
      errorType: string;
      message: string;
      statusCode?: number;
    }
  | { status: "parse-error"; errorType: string; message: string };

export interface FeedProcessingOptions {
  feed: {
    url: string;
    formatOptions?: {
      dateFormat?: string;
      dateTimezone?: string;
      dateLocale?: string;
    };
    externalProperties?: ExternalFeedProperty[];
    requestLookupDetails?: {
      key: string;
      url?: string;
      headers?: Record<string, string>;
    } | null;
  };
  feedRequestsServiceHost: string;
  hashToCompare?: string;
  executeFetchIfStale?: boolean;
  executeFetchIfNotInCache?: boolean;
  stalenessThresholdSeconds?: number;
}

/**
 * Dependencies that can be injected for testing.
 */
export interface FeedProcessingDeps {
  fetchFeedFn?: typeof fetchFeed;
  parseArticlesFn?: typeof parseArticlesFromXml;
}

// ============================================================================
// Shared Processing Function
// ============================================================================

/**
 * Fetch and parse a feed, returning a typed result instead of throwing.
 * This function is used by both the production handler and diagnostics.
 *
 * @param options - Feed processing options
 * @param deps - Optional dependency overrides for testing
 */
export async function fetchAndParseFeed(
  options: FeedProcessingOptions,
  deps: FeedProcessingDeps = {}
): Promise<FeedProcessingResult> {
  const doFetch = deps.fetchFeedFn ?? fetchFeed;
  const doParse = deps.parseArticlesFn ?? parseArticlesFromXml;

  // 1. Fetch feed with hash comparison
  let response: Awaited<ReturnType<typeof fetchFeed>> | null = null;

  try {
    response = await doFetch(
      options.feed.requestLookupDetails?.url || options.feed.url,
      {
        hashToCompare: options.hashToCompare,
        lookupDetails: options.feed.requestLookupDetails,
        serviceHost: options.feedRequestsServiceHost,
        executeFetchIfStale: options.executeFetchIfStale,
        executeFetchIfNotInCache: options.executeFetchIfNotInCache,
        stalenessThresholdSeconds: options.stalenessThresholdSeconds,
      }
    );
  } catch (err) {
    if (err instanceof FeedRequestInternalException) {
      return {
        status: "fetch-error",
        errorType: "internal",
        message: err.message,
      };
    }
    if (err instanceof FeedRequestParseException) {
      return {
        status: "fetch-error",
        errorType: "parse",
        message: err.message,
      };
    }
    if (err instanceof FeedRequestBadStatusCodeException) {
      return {
        status: "fetch-error",
        errorType: "bad-status-code",
        message: err.message,
        statusCode: err.statusCode,
      };
    }
    if (err instanceof FeedRequestFetchException) {
      return {
        status: "fetch-error",
        errorType: "fetch",
        message: err.message,
      };
    }
    if (err instanceof FeedRequestTimedOutException) {
      return {
        status: "fetch-error",
        errorType: "timeout",
        message: err.message,
      };
    }
    if (err instanceof FeedRequestInvalidSslCertificateException) {
      return {
        status: "fetch-error",
        errorType: "invalid-ssl-certificate",
        message: err.message,
      };
    }
    throw err;
  }

  // 2. Check response status
  if (response.requestStatus === FeedResponseRequestStatus.MatchedHash) {
    return { status: "matched-hash" };
  }

  // 3. Parse articles
  const parserRules = getParserRules({ url: options.feed.url });

  // Create external fetch function if needed (uses the injected fetch or default)
  const externalFetchFn = options.feed.externalProperties?.length
    ? async (url: string) => {
        try {
          const res = await doFetch(url, {
            executeFetchIfNotInCache: true,
            retries: 3,
            serviceHost: options.feedRequestsServiceHost,
          });
          if (res.requestStatus === FeedResponseRequestStatus.Success) {
            return { body: res.body, statusCode: 200 };
          }
          return { body: null };
        } catch {
          return { body: null };
        }
      }
    : undefined;

  try {
    const result = await doParse(response.body, {
      timeout: 10000,
      formatOptions: options.feed.formatOptions,
      useParserRules: parserRules,
      externalFeedProperties: options.feed.externalProperties,
      externalFetchFn,
    });

    return {
      status: "success",
      articles: result.articles,
      bodyHash: response.bodyHash,
    };
  } catch (err) {
    if (err instanceof FeedParseTimeoutException) {
      return {
        status: "parse-error",
        errorType: "timeout",
        message: err.message,
      };
    }
    if (err instanceof InvalidFeedException) {
      return {
        status: "parse-error",
        errorType: "invalid",
        message: err.message,
      };
    }
    throw err;
  }
}

// ============================================================================
// Hash Comparison Helper
// ============================================================================

/**
 * Get the hash to compare for a feed, if applicable.
 * Only returns a hash if the feed has prior articles stored and a hash exists.
 *
 * This logic is shared between the production feed event handler and the
 * diagnostic API to ensure consistent behavior.
 *
 * @param feedId - The feed ID to look up
 * @param articleStore - Store to check for prior articles
 * @param hashStore - Store to get the response hash
 * @returns The hash to compare, or undefined if not applicable
 */
export async function getHashToCompare(
  feedId: string,
  articleStore: HasPriorArticlesStore,
  hashStore: HashStore
): Promise<string | undefined> {
  const hasPriorArticles = await articleStore.hasPriorArticlesStored(feedId);
  if (!hasPriorArticles) {
    return undefined;
  }

  const storedHash = await hashStore.get(feedId);
  return storedHash ?? undefined;
}
