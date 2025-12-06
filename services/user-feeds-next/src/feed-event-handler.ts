import { feedV2EventSchema, type FeedV2Event } from "./schemas";
import { z } from "zod";
import { fetchFeed, FeedResponseRequestStatus } from "./feed-fetcher";
import {
  FeedRequestBadStatusCodeException,
  FeedRequestFetchException,
  FeedRequestInternalException,
  FeedRequestParseException,
  FeedRequestTimedOutException,
} from "./feed-fetcher/exceptions";
import {
  parseArticlesFromXml,
  FeedParseTimeoutException,
  InvalidFeedException,
  getParserRules,
  type ExternalFetchFn,
  type ExternalFeedProperty,
} from "./article-parser";
import {
  getArticlesToDeliver,
  inMemoryArticleFieldStore,
  type ArticleFieldStore,
} from "./article-comparison";
import {
  deliverArticles,
  ArticleDeliveryStatus,
  ArticleDeliveryRejectedCode,
  processDeliveryResult,
  type DeliveryMedium,
  type DiscordDeliveryResult,
  type MediumRejectionEvent,
} from "./delivery";
import type { LogicalExpression } from "./article-filters";
import { MessageBrokerQueue } from "./constants";
import {
  updateFeedArticlesInCache,
  inMemoryParsedArticlesCacheStore,
  type ParsedArticlesCacheStore,
  type CacheKeyOptions,
} from "./parsed-articles-cache";

// ============================================================================
// Response Hash Store Interface
// ============================================================================

/**
 * Interface for response hash storage.
 * Stores feed response hashes to skip processing when content hasn't changed.
 */
export interface ResponseHashStore {
  /**
   * Get the stored hash for a feed.
   */
  get(feedId: string): Promise<string | null>;

  /**
   * Set the hash for a feed. Requires hash to be non-empty.
   */
  set(feedId: string, hash: string): Promise<void>;

  /**
   * Remove the hash for a feed.
   */
  remove(feedId: string): Promise<void>;
}

// ============================================================================
// In-Memory Response Hash Store
// ============================================================================

const responseHashMap = new Map<string, string>();

/**
 * In-memory response hash store.
 * Suitable for development and single-instance deployments.
 */
export const inMemoryResponseHashStore: ResponseHashStore = {
  async get(feedId: string): Promise<string | null> {
    return responseHashMap.get(feedId) ?? null;
  },

  async set(feedId: string, hash: string): Promise<void> {
    if (!hash) {
      throw new Error("Hash is required");
    }
    responseHashMap.set(feedId, hash);
  },

  async remove(feedId: string): Promise<void> {
    responseHashMap.delete(feedId);
  },
};

/**
 * Clear the in-memory response hash store (for testing).
 */
export function clearResponseHashStore(): void {
  responseHashMap.clear();
}

// ============================================================================
// Feed Deleted Event
// ============================================================================

/**
 * Schema for feed deleted events.
 */
export const feedDeletedEventSchema = z.object({
  data: z.object({
    feed: z.object({
      id: z.string(),
    }),
  }),
});

export type FeedDeletedEvent = z.infer<typeof feedDeletedEventSchema>;

/**
 * Parse and validate a feed deleted event.
 */
export function parseFeedDeletedEvent(event: unknown): FeedDeletedEvent | null {
  try {
    return feedDeletedEventSchema.parse(event);
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error("Validation failed on incoming Feed Deleted event", {
        errors: err.issues,
      });
    } else {
      console.error("Failed to parse Feed Deleted event", {
        error: (err as Error).stack,
      });
    }
    return null;
  }
}

/**
 * Handle a feed deleted event - clean up stored data.
 */
export async function handleFeedDeletedEvent(
  event: FeedDeletedEvent,
  options: {
    responseHashStore?: ResponseHashStore;
    articleFieldStore?: ArticleFieldStore;
  } = {}
): Promise<void> {
  const {
    responseHashStore = inMemoryResponseHashStore,
    articleFieldStore = inMemoryArticleFieldStore,
  } = options;
  const feedId = event.data.feed.id;

  console.log(`Handling feed deleted event for feed ${feedId}`);

  // Remove the response hash
  await responseHashStore.remove(feedId);

  // Clear article field store for this feed
  await articleFieldStore.clear(feedId);

  console.log(`Cleaned up data for deleted feed ${feedId}`);
}

// ============================================================================
// Queue Publisher Type
// ============================================================================

/**
 * Publisher function type for sending messages to a queue.
 */
export type QueuePublisher = (queue: string, message: unknown) => Promise<void>;

/**
 * Handle an article delivery result callback from the Discord REST listener.
 * This processes the result, classifies errors, and emits rejection events.
 */
export async function handleArticleDeliveryResult(
  deliveryResult: DiscordDeliveryResult,
  publisher: QueuePublisher
): Promise<void> {
  const { processed, rejectionEvent } = processDeliveryResult(deliveryResult);

  console.log(
    `Delivery result for medium ${processed.meta.mediumId}: status=${processed.status}`,
    {
      feedId: processed.meta.feedId,
      errorCode: processed.errorCode,
    }
  );

  // Emit rejection event if the medium should be disabled
  if (rejectionEvent) {
    await emitRejectionEvent(rejectionEvent, publisher);
  }
}

/**
 * Emit a rejection event to disable a medium connection.
 */
async function emitRejectionEvent(
  event: MediumRejectionEvent,
  publisher: QueuePublisher
): Promise<void> {
  let rejectedCode: ArticleDeliveryRejectedCode;
  let feedId: string;
  let mediumId: string;
  let payload: Record<string, unknown>;

  switch (event.type) {
    case "badFormat":
      rejectedCode = ArticleDeliveryRejectedCode.BadRequest;
      feedId = event.data.feedId;
      mediumId = event.data.mediumId;
      payload = {
        data: {
          rejectedCode,
          articleId: event.data.articleId,
          rejectedMessage: event.data.responseBody,
          medium: { id: mediumId },
          feed: { id: feedId },
        },
      };
      break;

    case "missingPermissions":
      rejectedCode = ArticleDeliveryRejectedCode.Forbidden;
      feedId = event.data.feedId;
      mediumId = event.data.mediumId;
      payload = {
        data: {
          rejectedCode,
          medium: { id: mediumId },
          feed: { id: feedId },
        },
      };
      break;

    case "notFound":
      rejectedCode = ArticleDeliveryRejectedCode.MediumNotFound;
      feedId = event.data.feedId;
      mediumId = event.data.mediumId;
      payload = {
        data: {
          rejectedCode,
          medium: { id: mediumId },
          feed: { id: feedId },
        },
      };
      break;
  }

  console.log(`Emitting rejection event: ${rejectedCode}`, {
    feedId,
    mediumId,
  });

  await publisher(
    MessageBrokerQueue.FeedRejectedArticleDisableConnection,
    payload
  );
}

export function parseFeedV2Event(event: unknown): FeedV2Event | null {
  try {
    return feedV2EventSchema.parse(event);
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error("Validation failed on incoming Feed V2 event", {
        errors: err.issues,
      });
    } else {
      console.error("Failed to parse Feed V2 event", {
        error: (err as Error).stack,
      });
    }
    return null;
  }
}

export async function handleFeedV2Event(
  event: FeedV2Event,
  options: {
    responseHashStore?: ResponseHashStore;
    articleFieldStore?: ArticleFieldStore;
    parsedArticlesCacheStore?: ParsedArticlesCacheStore;
  } = {}
): Promise<boolean> {
  const {
    responseHashStore = inMemoryResponseHashStore,
    articleFieldStore = inMemoryArticleFieldStore,
    parsedArticlesCacheStore = inMemoryParsedArticlesCacheStore,
  } = options;
  const { feed } = event.data;

  console.log(`Handling event for feed ${feed.id} with url ${feed.url}`);

  // Get the stored hash if we have prior articles stored
  let hashToCompare: string | undefined;
  if (await articleFieldStore.hasPriorArticlesStored(feed.id)) {
    const storedHash = await responseHashStore.get(feed.id);
    if (storedHash) {
      hashToCompare = storedHash;
    }
  }

  // Fetch the feed
  let response: Awaited<ReturnType<typeof fetchFeed>> | null = null;

  try {
    response = await fetchFeed(feed.requestLookupDetails?.url || feed.url, {
      hashToCompare,
      lookupDetails: feed.requestLookupDetails,
    });
  } catch (err) {
    if (
      err instanceof FeedRequestInternalException ||
      err instanceof FeedRequestParseException ||
      err instanceof FeedRequestBadStatusCodeException ||
      err instanceof FeedRequestFetchException ||
      err instanceof FeedRequestTimedOutException
    ) {
      console.log(
        `Ignoring feed event due to expected exception: ${(err as Error).name}`
      );
      return false;
    }
    throw err;
  }

  if (
    !response ||
    response.requestStatus === FeedResponseRequestStatus.Pending ||
    response.requestStatus === FeedResponseRequestStatus.MatchedHash
  ) {
    console.log(`No response body - pending request or matched hash`);
    return false;
  }

  console.log(
    `Fetched feed body (${response.body.length} chars), hash: ${response.bodyHash}`
  );

  // Parse articles from XML
  let parseResult: Awaited<ReturnType<typeof parseArticlesFromXml>> | null =
    null;

  // Create fetch function for external content if configured
  const externalFeedProperties = event.data.feed.externalProperties as
    | ExternalFeedProperty[]
    | undefined;

  const externalFetchFn: ExternalFetchFn | undefined =
    externalFeedProperties?.length
      ? async (url: string): Promise<string | null> => {
          try {
            const res = await fetchFeed(url, {
              executeFetchIfNotInCache: true,
              retries: 3,
              lookupDetails: undefined,
            });

            if (res.requestStatus !== FeedResponseRequestStatus.Success) {
              console.error(`Failed to fetch external content from ${url}`, {
                status: res.requestStatus,
              });

              return null;
            }

            return res.body;
          } catch {
            return null;
          }
        }
      : undefined;

  try {
    const parserRules = getParserRules({ url: event.data.feed.url });

    parseResult = await parseArticlesFromXml(response.body, {
      timeout: 10000,
      formatOptions: {
        dateFormat: event.data.feed.formatOptions?.dateFormat,
        dateTimezone: event.data.feed.formatOptions?.dateTimezone,
        dateLocale: event.data.feed.formatOptions?.dateLocale,
      },
      useParserRules: parserRules,
      externalFeedProperties,
      externalFetchFn,
    });
  } catch (err) {
    if (err instanceof FeedParseTimeoutException) {
      console.error(`Feed parse timed out for ${feed.url}`);
      return false;
    }
    if (err instanceof InvalidFeedException) {
      console.error(`Invalid feed for ${feed.url}: ${err.message}`);
      return false;
    }
    throw err;
  }

  console.log(
    `Parsed ${parseResult.articles.length} articles from feed "${parseResult.feed.title || "Unknown"}"`
  );

  // Update parsed articles cache if they already exist in cache
  // This keeps cached article data fresh while preserving TTL
  const cacheKeyOptions: CacheKeyOptions = {
    formatOptions: {
      dateFormat: event.data.feed.formatOptions?.dateFormat,
      dateTimezone: event.data.feed.formatOptions?.dateTimezone,
      dateLocale: event.data.feed.formatOptions?.dateLocale,
    },
    externalFeedProperties: event.data.feed.externalProperties as
      | ExternalFeedProperty[]
      | undefined,
    requestLookupDetails: event.data.feed.requestLookupDetails,
  };

  await updateFeedArticlesInCache(parsedArticlesCacheStore, {
    url: event.data.feed.url,
    options: cacheKeyOptions,
    articles: parseResult.articles,
  });

  // Determine which articles to deliver (comparison logic)
  const comparisonResult = await getArticlesToDeliver(
    articleFieldStore,
    feed.id,
    parseResult.articles,
    {
      blockingComparisons: feed.blockingComparisons || [],
      passingComparisons: feed.passingComparisons || [],
      dateChecks: feed.dateChecks
        ? {
            oldArticleDateDiffMsThreshold:
              feed.dateChecks.oldArticleDateDiffMsThreshold ?? undefined,
            datePlaceholderReferences:
              feed.dateChecks.datePlaceholderReferences ?? undefined,
          }
        : undefined,
    }
  );

  console.log(
    `Articles to deliver: ${comparisonResult.articlesToDeliver.length}, ` +
      `blocked: ${comparisonResult.articlesBlocked.length}, ` +
      `passed comparisons: ${comparisonResult.articlesPassed.length}`
  );

  if (comparisonResult.articlesToDeliver.length === 0) {
    console.log("No new articles to deliver");

    // Save the response hash since we successfully processed the feed
    if (response.bodyHash) {
      await responseHashStore.set(feed.id, response.bodyHash);
    }

    return true;
  }

  // Deliver articles to all mediums
  const mediums = event.data.mediums.map((m) => ({
    id: m.id,
    filters: m.filters
      ? { expression: m.filters.expression as unknown as LogicalExpression }
      : undefined,
    rateLimits: m.rateLimits ?? undefined,
    details: {
      guildId: m.details.guildId,
      channel: m.details.channel
        ? {
            id: m.details.channel.id,
            type: m.details.channel.type ?? undefined,
          }
        : undefined,
      webhook: m.details.webhook
        ? {
            id: m.details.webhook.id,
            token: m.details.webhook.token,
            name: m.details.webhook.name ?? undefined,
            iconUrl: m.details.webhook.iconUrl ?? undefined,
            threadId: m.details.webhook.threadId ?? undefined,
          }
        : undefined,
      content: m.details.content ?? undefined,
      embeds: m.details.embeds ?? undefined,
      splitOptions: m.details.splitOptions
        ? {
            splitChar: m.details.splitOptions.splitChar ?? undefined,
            appendChar: m.details.splitOptions.appendChar ?? undefined,
            prependChar: m.details.splitOptions.prependChar ?? undefined,
          }
        : undefined,
      placeholderLimits: m.details.placeholderLimits ?? undefined,
      enablePlaceholderFallback:
        m.details.enablePlaceholderFallback ?? undefined,
      mentions: m.details.mentions ?? undefined,
      customPlaceholders: m.details.customPlaceholders ?? undefined,
      forumThreadTitle: m.details.forumThreadTitle ?? undefined,
      forumThreadTags: m.details.forumThreadTags ?? undefined,
      formatter: m.details.formatter ?? undefined,
    },
  })) as DeliveryMedium[];

  const deliveryResults = await deliverArticles(
    comparisonResult.articlesToDeliver,
    mediums,
    {
      feedId: feed.id,
      articleDayLimit: event.data.articleDayLimit,
    }
  );

  // Log delivery results
  const sent = deliveryResults.filter(
    (r) => r.status === ArticleDeliveryStatus.Sent
  ).length;
  const filtered = deliveryResults.filter(
    (r) => r.status === ArticleDeliveryStatus.FilteredOut
  ).length;
  const rateLimited = deliveryResults.filter(
    (r) => r.status === ArticleDeliveryStatus.RateLimited
  ).length;
  const failed = deliveryResults.filter(
    (r) => r.status === ArticleDeliveryStatus.Failed
  ).length;

  console.log(
    `Delivery complete: ${sent} sent, ${filtered} filtered, ${rateLimited} rate-limited, ${failed} failed`
  );

  // Save the response hash after successful delivery
  if (response.bodyHash) {
    await responseHashStore.set(feed.id, response.bodyHash);
  }

  return true;
}
