import { feedV2EventSchema, type FeedV2Event } from "../shared/schemas";
import { z } from "zod";
import { logger } from "../shared/utils";
import { fetchFeed, FeedResponseRequestStatus } from "../feed-fetcher";
import {
  FeedRequestBadStatusCodeException,
  FeedRequestFetchException,
  FeedRequestInternalException,
  FeedRequestParseException,
  FeedRequestTimedOutException,
} from "../feed-fetcher/exceptions";
import {
  FeedParseTimeoutException,
  InvalidFeedException,
  getParserRules,
  type ExternalFetchFn,
  type ExternalFeedProperty,
} from "../articles/parser";
import { parseArticlesFromXmlWithWorkers as parseArticlesFromXml } from "../articles/parser/worker";
import {
  getArticlesToDeliver,
  inMemoryArticleFieldStore,
  type ArticleFieldStore,
} from "../articles/comparison";
import {
  deliverArticles,
  ArticleDeliveryStatus,
  ArticleDeliveryRejectedCode,
  processDeliveryResult,
  type DeliveryMedium,
  type DiscordDeliveryResult,
  type MediumRejectionEvent,
  type DiscordRestClient,
  inMemoryDiscordRestClient,
} from "../delivery";
import type { LogicalExpression } from "../articles/filters";
import { MessageBrokerQueue } from "../shared/constants";
import {
  updateFeedArticlesInCache,
  inMemoryParsedArticlesCacheStore,
} from "../stores/in-memory/parsed-articles-cache";
import type {
  ParsedArticlesCacheStore,
  CacheKeyOptions,
} from "../stores/interfaces/parsed-articles-cache";
import {
  handleFeedParseFailure,
  handleFeedParseSuccess,
  inMemoryFeedRetryStore,
} from "../stores/in-memory/feed-retry-store";
import type {
  FeedRetryStore,
  FeedRetryPublisher,
} from "../stores/interfaces/feed-retry-store";
import { inMemoryDeliveryRecordStore } from "../stores/in-memory/delivery-record-store";
import {
  type DeliveryRecordStore,
  type ArticleDeliveryState,
  ArticleDeliveryErrorCode,
} from "../stores/interfaces/delivery-record-store";

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
      logger.error("Validation failed on incoming Feed Deleted event", {
        errors: err.issues,
      });
    } else {
      logger.error("Failed to parse Feed Deleted event", {
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
    feedRetryStore?: FeedRetryStore;
  } = {}
): Promise<void> {
  const {
    responseHashStore = inMemoryResponseHashStore,
    articleFieldStore = inMemoryArticleFieldStore,
    feedRetryStore = inMemoryFeedRetryStore,
  } = options;
  const feedId = event.data.feed.id;

  logger.debug("Received feed deleted event", { event });

  // Remove the response hash
  await responseHashStore.remove(feedId);

  // Clear article field store for this feed
  await articleFieldStore.clear(feedId);

  // Clear any retry records for this feed
  await feedRetryStore.remove(feedId);

  logger.debug(`Deleted feed info for feed ${feedId}`);
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
 * This processes the result, classifies errors, updates delivery records, and emits rejection events.
 */
export async function handleArticleDeliveryResult(
  deliveryResult: DiscordDeliveryResult,
  publisher: QueuePublisher,
  deliveryRecordStore: DeliveryRecordStore
): Promise<void> {
  const { processed, rejectionEvent } = processDeliveryResult(deliveryResult);

  logger.debug(
    `Delivery result for medium ${processed.meta.mediumId}: status=${processed.status}`,
    {
      feedId: processed.meta.feedId,
      errorCode: processed.errorCode,
    }
  );

  // Update the delivery record status in the database
  const deliveryId = deliveryResult.job.meta?.id;
  if (deliveryId) {
    try {
      await deliveryRecordStore.updateDeliveryStatus(deliveryId, {
        status: processed.status,
        errorCode: processed.errorCode,
        internalMessage: processed.internalMessage,
        externalDetail: processed.externalDetail,
      });
    } catch (err) {
      logger.warn("Failed to update delivery record status", {
        deliveryId,
        error: (err as Error).message,
      });
    }
  }

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

  logger.debug(`Emitting rejection event: ${rejectedCode}`, {
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
      logger.error("Validation failed on incoming Feed V2 event", {
        feedId: (event as { data?: { feed?: { id?: string } } })?.data?.feed
          ?.id,
        errors: err.issues,
      });
    } else {
      logger.error("Failed to parse Feed V2 event", {
        feedId: (event as { data?: { feed?: { id?: string } } })?.data?.feed
          ?.id,
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
    feedRetryStore?: FeedRetryStore;
    deliveryRecordStore?: DeliveryRecordStore;
    discordClient?: DiscordRestClient;
    publisher?: FeedRetryPublisher;
    feedRequestsServiceHost: string;
  }
): Promise<ArticleDeliveryState[] | null> {
  const {
    responseHashStore = inMemoryResponseHashStore,
    articleFieldStore = inMemoryArticleFieldStore,
    parsedArticlesCacheStore = inMemoryParsedArticlesCacheStore,
    feedRetryStore = inMemoryFeedRetryStore,
    deliveryRecordStore = inMemoryDeliveryRecordStore,
    discordClient = inMemoryDiscordRestClient,
    publisher,
    feedRequestsServiceHost,
  } = options;
  const { feed } = event.data;
  const isDebugFeed = event.debug === true;
  const startTime = Date.now();

  // Helper function for debug logging
  const debugLog = (message: string, data?: Record<string, unknown>) => {
    if (isDebugFeed) {
      logger.datadog(message, data);
    }
    logger.debug(message, data);
  };

  // Wrap processing in nested contexts for batched inserts (matching user-feeds pattern)
  let numberOfArticles = 0;
  let eventError: string | undefined;

  return deliveryRecordStore.startContext(async () =>
    articleFieldStore.startContext(async () => {
      try {
        const result = await handleFeedV2EventInternal({
          event,
          feed,
          responseHashStore,
          articleFieldStore,
          parsedArticlesCacheStore,
          feedRetryStore,
          deliveryRecordStore,
          discordClient,
          publisher,
          debugLog,
          feedRequestsServiceHost,
        });
        numberOfArticles = result?.length ?? 0;
        return result;
      } catch (err) {
        eventError = (err as Error).stack;
        throw err;
      } finally {
        // Flush pending inserts at the end (matching user-feeds order)
        try {
          const { affectedRows: articleRows } =
            await articleFieldStore.flushPendingInserts();
          if (articleRows > 0) {
            logger.debug(`Flushed ${articleRows} article field inserts`);
          }
        } catch (err) {
          logger.error("Failed to flush ORM while handling feed event", {
            event,
            error: (err as Error).stack,
          });
        }

        try {
          const { affectedRows: deliveryRows } =
            await deliveryRecordStore.flushPendingInserts();
          if (deliveryRows > 0) {
            logger.debug(`Flushed ${deliveryRows} delivery record inserts`);
          }
        } catch (err) {
          logger.error("Failed to flush ORM while handling feed event", {
            event,
            error: (err as Error).stack,
          });
        }

        // Log timing information
        const finishedTs = Date.now() - startTime;
        logger.datadog(
          !eventError
            ? `Finished handling user feed event in ${finishedTs}ms`
            : `Error while handling user event feed`,
          {
            duration: finishedTs,
            feedId: event.data.feed.id,
            feedURL: event.data.feed.url,
            error: eventError,
            numberOfArticles,
          }
        );
      }
    })
  );
}

async function handleFeedV2EventInternal({
  event,
  feed,
  responseHashStore,
  articleFieldStore,
  parsedArticlesCacheStore,
  feedRetryStore,
  deliveryRecordStore,
  discordClient,
  publisher,
  debugLog,
  feedRequestsServiceHost,
}: {
  event: FeedV2Event;
  feed: FeedV2Event["data"]["feed"];
  responseHashStore: ResponseHashStore;
  articleFieldStore: ArticleFieldStore;
  parsedArticlesCacheStore: ParsedArticlesCacheStore;
  feedRetryStore: FeedRetryStore;
  deliveryRecordStore: DeliveryRecordStore;
  discordClient: DiscordRestClient;
  publisher?: FeedRetryPublisher;
  debugLog: (message: string, data?: Record<string, unknown>) => void;
  feedRequestsServiceHost: string;
}): Promise<ArticleDeliveryState[] | null> {
  // Get the stored hash if we have prior articles stored
  let hashToCompare: string | undefined;
  const hasPriorArticles = await articleFieldStore.hasPriorArticlesStored(
    feed.id
  );
  if (hasPriorArticles) {
    const storedHash = await responseHashStore.get(feed.id);
    if (storedHash) {
      hashToCompare = storedHash;
    }
  } else {
    logger.debug(`No prior articles stored for feed ${feed.id}`);
  }

  // Fetch the feed
  let response: Awaited<ReturnType<typeof fetchFeed>> | null = null;

  try {
    response = await fetchFeed(feed.requestLookupDetails?.url || feed.url, {
      hashToCompare,
      lookupDetails: feed.requestLookupDetails,
      serviceHost: feedRequestsServiceHost,
    });
  } catch (err) {
    if (
      err instanceof FeedRequestInternalException ||
      err instanceof FeedRequestParseException ||
      err instanceof FeedRequestBadStatusCodeException ||
      err instanceof FeedRequestFetchException ||
      err instanceof FeedRequestTimedOutException
    ) {
      logger.info(
        `Ignoring feed event due to expected exception: ${(err as Error).name}`,
        {
          feedId: feed.id,
          feedUrl: feed.url,
        }
      );
      return null;
    }
    throw err;
  }

  if (
    !response ||
    response.requestStatus === FeedResponseRequestStatus.Pending ||
    response.requestStatus === FeedResponseRequestStatus.MatchedHash
  ) {
    logger.debug(`No response body - pending request or matched hash`, {
      feedId: feed.id,
      requestStatus: response?.requestStatus,
    });
    return null;
  }

  logger.debug(
    `Fetched feed body (${response.body.length} chars), hash: ${response.bodyHash}`,
    { feedId: feed.id }
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
              serviceHost: feedRequestsServiceHost,
            });

            if (res.requestStatus !== FeedResponseRequestStatus.Success) {
              logger.error(`Failed to fetch article injection`, {
                sourceField: url,
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
      logger.error(`Feed parse timed out for ${feed.url}`, {
        feedId: feed.id,
      });
      return null;
    }
    if (err instanceof InvalidFeedException) {
      logger.info(`Ignoring feed event due to invalid feed`, {
        feedId: feed.id,
        feedUrl: feed.url,
        error: (err as Error).stack,
      });

      // Handle retry logic for invalid feeds
      if (publisher) {
        const { disabled } = await handleFeedParseFailure({
          feedId: feed.id,
          store: feedRetryStore,
          publisher,
        });

        if (disabled) {
          logger.info(
            `Feed ${feed.id} exceeded retry limit for invalid feed, sending disable event`
          );
        }
      }

      return null;
    }
    throw err;
  }

  logger.debug(`Found articles`, {
    feedId: feed.id,
    titles: parseResult.articles.map((a) => a.flattened.title),
  });

  debugLog(`Debug feed ${feed.id}: found articles`, {
    articles: parseResult.articles.map((a) => ({
      id: a.flattened.id,
      title: a.flattened.title,
    })),
    level: "debug",
  });

  // Clear any retry records on successful parse
  await handleFeedParseSuccess({
    feedId: feed.id,
    store: feedRetryStore,
  });

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

  // Log detailed comparison results for debug feeds
  debugLog(
    `Debug feed ${feed.id}: ${comparisonResult.articlesToDeliver.length} new articles determined from ID checks`,
    {
      articles: comparisonResult.articlesToDeliver.map((a) => ({
        id: a.flattened.id,
        title: a.flattened.title,
      })),
    }
  );

  if (comparisonResult.articlesBlocked.length > 0) {
    debugLog(
      `Debug feed ${feed.id}: ${comparisonResult.articlesBlocked.length} articles blocked by comparisons`,
      {
        articles: comparisonResult.articlesBlocked.map((a) => ({
          id: a.flattened.id,
          title: a.flattened.title,
        })),
      }
    );
  }

  if (comparisonResult.articlesPassed.length > 0) {
    debugLog(
      `Debug feed ${feed.id}: ${comparisonResult.articlesPassed.length} articles past passing comparisons`,
      {
        articles: comparisonResult.articlesPassed.map((a) => ({
          id: a.flattened.id,
          title: a.flattened.title,
        })),
      }
    );
  }

  logger.debug(
    `Articles to deliver: ${comparisonResult.articlesToDeliver.length}, ` +
      `blocked: ${comparisonResult.articlesBlocked.length}, ` +
      `passed comparisons: ${comparisonResult.articlesPassed.length}`,
    { feedId: feed.id }
  );

  if (comparisonResult.articlesToDeliver.length === 0) {
    logger.debug("No new articles to deliver", { feedId: feed.id });

    // Save the response hash since we successfully processed the feed
    if (response.bodyHash) {
      await responseHashStore.set(feed.id, response.bodyHash);
    }

    return [];
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
            type: m.details.webhook.type ?? undefined,
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
      components: m.details.components ?? undefined,
      componentsV2: m.details.componentsV2 ?? undefined,
    },
  })) as DeliveryMedium[];

  const deliveryResults = await deliverArticles(
    comparisonResult.articlesToDeliver,
    mediums,
    {
      feedId: feed.id,
      feedUrl: feed.url,
      articleDayLimit: event.data.articleDayLimit,
      discordClient,
    }
  );

  // Store delivery records (flush=false, will be flushed in finally block)
  await deliveryRecordStore.store(feed.id, deliveryResults, false);

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

  logger.debug(
    `Delivery complete: ${sent} sent, ${filtered} filtered, ${rateLimited} rate-limited, ${failed} failed`,
    { feedId: feed.id }
  );

  // Save the response hash after successful delivery
  if (response.bodyHash) {
    await responseHashStore.set(feed.id, response.bodyHash);
  }

  return deliveryResults;
}
