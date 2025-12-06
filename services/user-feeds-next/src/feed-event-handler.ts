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
} from "./article-parser";
import {
  getArticlesToDeliver,
  inMemoryArticleFieldStore,
} from "./article-comparison";
import {
  deliverArticles,
  ArticleDeliveryStatus,
  type DeliveryMedium,
} from "./delivery";
import type { LogicalExpression } from "./article-filters";

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

export async function handleFeedV2Event(event: FeedV2Event): Promise<boolean> {
  const { feed } = event.data;

  console.log(`Handling event for feed ${feed.id} with url ${feed.url}`);

  // Fetch the feed
  let response: Awaited<ReturnType<typeof fetchFeed>> | null = null;

  try {
    response = await fetchFeed(feed.requestLookupDetails?.url || feed.url, {
      hashToCompare: undefined, // TODO: Implement hash caching
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

  // Determine which articles to deliver (comparison logic)
  const comparisonResult = await getArticlesToDeliver(
    inMemoryArticleFieldStore,
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

  return true;
}
