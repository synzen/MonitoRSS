import { feedV2EventSchema, type FeedV2Event } from "../shared/schemas";
import { z } from "zod";
import { logger } from "../shared/utils";
import type { ExternalFeedProperty } from "../articles/parser";
import { fetchAndParseFeed, getHashToCompare } from "./shared-processing";
import {
  getArticlesToDeliver,
  type ArticleFieldStore,
} from "../articles/comparison";
import {
  deliverArticles,
  ArticleDeliveryStatus,
  type DeliveryMedium,
  type DiscordRestClient,
} from "../delivery";
import type { LogicalExpression } from "../articles/filters";
import { updateFeedArticlesInCache } from "../stores/parsed-articles-cache-helpers";
import type {
  ParsedArticlesCacheStore,
  CacheKeyOptions,
} from "../stores/interfaces/parsed-articles-cache";
import {
  handleFeedParseFailure,
  handleFeedParseSuccess,
} from "../stores/feed-retry-helpers";
import type {
  FeedRetryStore,
  FeedRetryPublisher,
} from "../stores/interfaces/feed-retry-store";
import {
  type DeliveryRecordStore,
  type ArticleDeliveryState,
} from "../stores/interfaces/delivery-record-store";
import {
  emitRejectionEvent,
  getRejectionEventFromDeliveryState,
} from "./delivery-result-handler";
import type { ResponseHashStore } from "./feed-cleanup-handler";

// Re-export for backwards compatibility with direct imports
export type { QueuePublisher } from "./delivery-result-handler";
export { handleArticleDeliveryResult } from "./delivery-result-handler";
export type { ResponseHashStore } from "./feed-cleanup-handler";
export {
  feedDeletedEventSchema,
  type FeedDeletedEvent,
  parseFeedDeletedEvent,
  handleFeedDeletedEvent,
} from "./feed-cleanup-handler";

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
    responseHashStore: ResponseHashStore;
    articleFieldStore: ArticleFieldStore;
    parsedArticlesCacheStore: ParsedArticlesCacheStore;
    feedRetryStore: FeedRetryStore;
    deliveryRecordStore: DeliveryRecordStore;
    discordClient: DiscordRestClient;
    publisher?: FeedRetryPublisher;
    queuePublisher: (queue: string, message: unknown) => Promise<void>;
    feedRequestsServiceHost: string;
  }
): Promise<ArticleDeliveryState[] | null> {
  const {
    responseHashStore,
    articleFieldStore,
    parsedArticlesCacheStore,
    feedRetryStore,
    deliveryRecordStore,
    discordClient,
    publisher,
    queuePublisher,
    feedRequestsServiceHost,
  } = options;
  const { feed } = event.data;
  const isDebugFeed = event.debug === true;
  const startTime = Date.now();

  const debugLog = (message: string, data?: Record<string, unknown>) => {
    if (isDebugFeed) {
      logger.datadog(message, data);
    }
    logger.debug(message, data);
  };

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
          queuePublisher,
          debugLog,
          feedRequestsServiceHost,
        });
        numberOfArticles = result?.length ?? 0;
        return result;
      } catch (err) {
        eventError = (err as Error).stack;
        throw err;
      } finally {
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
  queuePublisher,
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
  queuePublisher: (queue: string, message: unknown) => Promise<void>;
  debugLog: (message: string, data?: Record<string, unknown>) => void;
  feedRequestsServiceHost: string;
}): Promise<ArticleDeliveryState[] | null> {
  const hashToCompare = await getHashToCompare(
    feed.id,
    articleFieldStore,
    responseHashStore
  );
  if (!hashToCompare) {
    logger.debug(`No prior articles stored for feed ${feed.id}`);
  }

  const externalFeedProperties = event.data.feed.externalProperties as
    | ExternalFeedProperty[]
    | undefined;

  const feedResult = await fetchAndParseFeed({
    feed: {
      url: feed.url,
      formatOptions: feed.formatOptions,
      externalProperties: externalFeedProperties,
      requestLookupDetails: feed.requestLookupDetails,
    },
    feedRequestsServiceHost,
    hashToCompare,
  });

  if (feedResult.status === "matched-hash") {
    logger.debug(`No response body - pending request or matched hash`, {
      feedId: feed.id,
      requestStatus: feedResult.status,
    });
    debugLog(
      `Debug feed ${feed.id}: No response body - pending request or matched hash`
    );
    return null;
  }

  if (feedResult.status === "fetch-error") {
    logger.info(
      `Ignoring feed event due to fetch error: ${feedResult.errorType}`,
      {
        feedId: feed.id,
        feedUrl: feed.url,
        message: feedResult.message,
      }
    );
    debugLog(
      `Debug feed ${feed.id}: Ignoring feed event due to fetch error: ${feedResult.errorType}`,
      { message: feedResult.message }
    );
    return null;
  }

  if (feedResult.status === "parse-error") {
    if (feedResult.errorType === "timeout") {
      logger.error(`Feed parse timed out for ${feed.url}`, {
        feedId: feed.id,
      });
      debugLog(`Debug feed ${feed.id}: Feed parse timed out`);
      return null;
    }

    logger.info(`Ignoring feed event due to invalid feed`, {
      feedId: feed.id,
      feedUrl: feed.url,
      message: feedResult.message,
    });
    debugLog(
      `Debug feed ${feed.id}: Ignoring feed event due to invalid feed`,
      { message: feedResult.message }
    );

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

  const articles = feedResult.articles;

  logger.debug(`Found articles`, {
    feedId: feed.id,
    titles: articles.map((a) => a.flattened.title),
  });

  debugLog(`Debug feed ${feed.id}: found articles`, {
    articles: articles.map((a) => ({
      id: a.flattened.id,
      title: a.flattened.title,
    })),
    level: "debug",
  });

  await handleFeedParseSuccess({
    feedId: feed.id,
    store: feedRetryStore,
  });

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
    articles,
  });

  const comparisonResult = await getArticlesToDeliver(
    articleFieldStore,
    feed.id,
    articles,
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
  debugLog(
    `Debug feed ${feed.id}: Articles to deliver: ${comparisonResult.articlesToDeliver.length}, ` +
      `blocked: ${comparisonResult.articlesBlocked.length}, ` +
      `passed comparisons: ${comparisonResult.articlesPassed.length}`
  );

  if (comparisonResult.articlesToDeliver.length === 0) {
    logger.debug("No new articles to deliver", { feedId: feed.id });
    debugLog(`Debug feed ${feed.id}: No new articles to deliver, returning early`);

    if (feedResult.bodyHash) {
      await responseHashStore.set(feed.id, feedResult.bodyHash);
    }

    return [];
  }

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
      deliveryRecordStore,
    }
  );

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
  debugLog(
    `Debug feed ${feed.id}: Delivery complete: ${sent} sent, ${filtered} filtered, ${rateLimited} rate-limited, ${failed} failed, total ${deliveryResults.length}`
  );

  for (const state of deliveryResults) {
    const rejectionEvent = getRejectionEventFromDeliveryState(feed.id, state);

    if (rejectionEvent) {
      await emitRejectionEvent(rejectionEvent, queuePublisher);
    }
  }

  if (feedResult.bodyHash) {
    await responseHashStore.set(feed.id, feedResult.bodyHash);
  }

  return deliveryResults;
}
