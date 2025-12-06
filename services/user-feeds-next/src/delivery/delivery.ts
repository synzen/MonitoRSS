import { RESTProducer, type JobResponse } from "@synzen/discord-rest";
import type {
  JobData,
  JobResponseError,
} from "@synzen/discord-rest/dist/RESTConsumer";
import type { Article } from "../article-parser";
import type { DiscordMessageApiPayload } from "../article-formatter";
import {
  getArticleFilterResults,
  type LogicalExpression,
} from "../article-filters";
import { generateDiscordPayloads } from "../article-formatter";
import type { FeedV2Event } from "../schemas";
import {
  ArticleDeliveryStatus,
  ArticleDeliveryErrorCode,
  type DeliveryRecordStore,
  type ArticleDeliveryState,
  inMemoryDeliveryRecordStore,
  generateDeliveryId,
} from "../delivery-record-store";

// Re-export ArticleDeliveryState for convenience
export type { ArticleDeliveryState };

// Re-export for convenience
export { ArticleDeliveryStatus, ArticleDeliveryErrorCode };

/**
 * Rejection codes for article delivery rejections.
 * These indicate why an article was rejected and the medium should be disabled.
 */
export enum ArticleDeliveryRejectedCode {
  BadRequest = "user-feeds/bad-request",
  Forbidden = "user-feeds/forbidden",
  MediumNotFound = "user-feeds/medium-not-found",
}

/**
 * Result from Discord REST producer callback.
 */
export interface DiscordDeliveryResult {
  job: JobData;
  result: JobResponse<never> | JobResponseError;
}

/**
 * Metadata for a delivery job.
 */
export interface DeliveryJobMeta {
  feedId: string;
  articleIdHash: string;
  mediumId: string;
  articleId?: string;
}

/**
 * Processed delivery result with error classification.
 */
export interface ProcessedDeliveryResult {
  status: ArticleDeliveryStatus;
  errorCode?: ArticleDeliveryErrorCode;
  rejectedCode?: ArticleDeliveryRejectedCode;
  internalMessage?: string;
  externalDetail?: string;
  meta: DeliveryJobMeta;
}

/**
 * Event emitted when a medium should be disabled due to a bad request.
 */
export interface MediumBadFormatEvent {
  feedId: string;
  mediumId: string;
  articleId?: string;
  responseBody: string;
}

/**
 * Event emitted when a medium should be disabled due to missing permissions.
 */
export interface MediumMissingPermissionsEvent {
  feedId: string;
  mediumId: string;
}

/**
 * Event emitted when a medium should be disabled because it was not found.
 */
export interface MediumNotFoundEvent {
  feedId: string;
  mediumId: string;
}

/**
 * Combined type for medium rejection events.
 */
export type MediumRejectionEvent =
  | { type: "badFormat"; data: MediumBadFormatEvent }
  | { type: "missingPermissions"; data: MediumMissingPermissionsEvent }
  | { type: "notFound"; data: MediumNotFoundEvent };

export interface MediumRateLimit {
  limit: number;
  timeWindowSeconds: number;
}

export interface DeliveryMedium {
  id: string;
  filters?: {
    expression: LogicalExpression;
  } | null;
  rateLimits?: MediumRateLimit[] | null;
  details: {
    guildId: string;
    channel?: { id: string; type?: string };
    webhook?: {
      id: string;
      token: string;
      name?: string;
      iconUrl?: string;
      threadId?: string;
    };
    content?: string;
    embeds?: FeedV2Event["data"]["mediums"][number]["details"]["embeds"];
    splitOptions?: {
      splitChar?: string;
      appendChar?: string;
      prependChar?: string;
    };
    placeholderLimits?: Array<{
      placeholder: string;
      characterCount: number;
      appendString?: string;
    }>;
    enablePlaceholderFallback?: boolean;
    mentions?: {
      targets?: Array<{
        id: string;
        type: "user" | "role";
        filters?: { expression: LogicalExpression };
      }>;
    };
    customPlaceholders?: Array<{
      id: string;
      referenceName: string;
      sourcePlaceholder: string;
      steps: Array<{
        type: string;
        regexSearch?: string;
        regexSearchFlags?: string;
        replacementString?: string;
        format?: string;
        timezone?: string;
        locale?: string;
      }>;
    }>;
    forumThreadTitle?: string;
    forumThreadTags?: Array<{
      id: string;
      filters?: { expression: LogicalExpression };
    }>;
    formatter?: {
      stripImages?: boolean;
      formatTables?: boolean;
      disableImageLinkPreviews?: boolean;
      ignoreNewLines?: boolean;
    };
  };
}

// ============================================================================
// Rate Limiting (Matching user-feeds behavior)
// ============================================================================

/**
 * LimitState tracks remaining deliveries for rate limiting.
 * Matches the interface used in user-feeds DeliveryService.
 */
export interface LimitState {
  remaining: number;
  remainingInMedium: number;
}

/**
 * Get remaining deliveries before hitting rate limits.
 * Matches the behavior of user-feeds ArticleRateLimitService.getUnderLimitCheckFromInputLimits.
 *
 * Uses a sliding window approach by querying actual delivery records.
 */
export async function getUnderLimitCheck(
  deliveryRecordStore: DeliveryRecordStore,
  filter: { feedId?: string; mediumId?: string },
  limits: MediumRateLimit[]
): Promise<{ underLimit: boolean; remaining: number }> {
  if (limits.length === 0) {
    return {
      underLimit: true,
      remaining: Number.MAX_SAFE_INTEGER,
    };
  }

  const limitResults = await Promise.all(
    limits.map(async ({ limit, timeWindowSeconds }) => {
      const deliveriesInTimeframe =
        await deliveryRecordStore.countDeliveriesInPastTimeframe(
          filter,
          timeWindowSeconds
        );

      return {
        progress: deliveriesInTimeframe,
        max: limit,
        remaining: Math.max(limit - deliveriesInTimeframe, 0),
        windowSeconds: timeWindowSeconds,
      };
    })
  );

  return {
    underLimit: limitResults.every(({ remaining }) => remaining > 0),
    remaining: Math.min(...limitResults.map(({ remaining }) => remaining)),
  };
}

// ============================================================================
// Discord REST Producer
// ============================================================================

let discordProducer: RESTProducer | null = null;

export async function initializeDiscordProducer(options: {
  rabbitmqUri: string;
  clientId: string;
}): Promise<void> {
  discordProducer = new RESTProducer(options.rabbitmqUri, {
    clientId: options.clientId,
  });
  await discordProducer.initialize();
  console.log("Discord REST producer initialized");
}

export async function closeDiscordProducer(): Promise<void> {
  // RESTProducer doesn't have a close method, but we can null it out
  discordProducer = null;
}

// ============================================================================
// Delivery Logic
// ============================================================================

/**
 * Send an article to a Discord medium.
 * Matches the behavior of user-feeds DeliveryService.sendArticleToMedium.
 *
 * @param article - The article to deliver
 * @param medium - The medium to deliver to
 * @param limitState - The current rate limit state (will be decremented on success)
 * @param feedId - The feed ID
 * @returns Array of delivery states (matching user-feeds pattern)
 */
async function sendArticleToMedium(
  article: Article,
  medium: DeliveryMedium,
  limitState: LimitState,
  feedId: string
): Promise<ArticleDeliveryState[]> {
  try {
    // Check rate limits first (matching user-feeds order)
    if (limitState.remaining <= 0 || limitState.remainingInMedium <= 0) {
      return [
        {
          id: generateDeliveryId(),
          mediumId: medium.id,
          status:
            limitState.remaining <= 0
              ? ArticleDeliveryStatus.RateLimited
              : ArticleDeliveryStatus.MediumRateLimitedByUser,
          articleIdHash: article.flattened.idHash,
          article,
        },
      ];
    }

    // Check medium filters
    if (medium.filters?.expression) {
      const filterResult = getArticleFilterResults(
        medium.filters.expression,
        article
      );
      if (!filterResult.result) {
        return [
          {
            id: generateDeliveryId(),
            mediumId: medium.id,
            status: ArticleDeliveryStatus.FilteredOut,
            articleIdHash: article.flattened.idHash,
            externalDetail: filterResult.explainBlocked.length
              ? JSON.stringify({ explainBlocked: filterResult.explainBlocked })
              : null,
            article,
          },
        ];
      }
    }

    // Generate Discord payloads
    const payloads = generateDiscordPayloads(article, {
      content: medium.details.content,
      embeds: medium.details.embeds?.map((e) => ({
        ...e,
        title: e.title ?? undefined,
        description: e.description ?? undefined,
        url: e.url ?? undefined,
        color: e.color ?? undefined,
        footer: e.footer
          ? { text: e.footer.text, iconUrl: e.footer.iconUrl ?? undefined }
          : undefined,
        image: e.image ? { url: e.image.url } : undefined,
        thumbnail: e.thumbnail ? { url: e.thumbnail.url } : undefined,
        author: e.author
          ? {
              name: e.author.name,
              url: e.author.url ?? undefined,
              iconUrl: e.author.iconUrl ?? undefined,
            }
          : undefined,
        timestamp: e.timestamp ?? undefined,
      })),
      splitOptions: medium.details.splitOptions,
      placeholderLimits: medium.details.placeholderLimits,
      enablePlaceholderFallback: medium.details.enablePlaceholderFallback,
      mentions: medium.details.mentions,
      customPlaceholders: medium.details.customPlaceholders?.map((cp) => ({
        ...cp,
        steps: cp.steps.map((s) => ({ ...s, type: s.type as never })),
      })),
    });

    if (payloads.length === 0) {
      return [
        {
          id: generateDeliveryId(),
          mediumId: medium.id,
          status: ArticleDeliveryStatus.Rejected,
          articleIdHash: article.flattened.idHash,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          internalMessage: "No payloads generated (empty message)",
          externalDetail: "",
          article,
        },
      ];
    }

    // Send to Discord
    for (const payload of payloads) {
      await sendToDiscord(medium, payload, {
        feedId,
        articleIdHash: article.flattened.idHash,
      });
    }

    // Decrement rate limit counters after successful delivery
    limitState.remaining--;
    limitState.remainingInMedium--;

    return [
      {
        id: generateDeliveryId(),
        mediumId: medium.id,
        status: ArticleDeliveryStatus.Sent,
        articleIdHash: article.flattened.idHash,
        article,
      },
    ];
  } catch (err) {
    return [
      {
        id: generateDeliveryId(),
        mediumId: medium.id,
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.Internal,
        internalMessage: (err as Error).message,
        articleIdHash: article.flattened.idHash,
        article,
      },
    ];
  }
}

/**
 * Send a payload to Discord via the REST producer.
 */
async function sendToDiscord(
  medium: DeliveryMedium,
  payload: DiscordMessageApiPayload,
  metadata: { feedId: string; articleIdHash: string }
): Promise<void> {
  if (!discordProducer) {
    throw new Error("Discord producer not initialized");
  }

  const { channel, webhook } = medium.details;

  if (webhook) {
    // Webhook delivery
    discordProducer.enqueue(
      `/webhooks/${webhook.id}/${webhook.token}`,
      {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          username: webhook.name,
          avatar_url: webhook.iconUrl,
        }),
      },
      {
        meta: {
          feedId: metadata.feedId,
          articleIdHash: metadata.articleIdHash,
          mediumId: medium.id,
          emitDeliveryResult: true,
        },
      }
    );
    return;
  }

  if (channel) {
    // Channel message delivery
    discordProducer.enqueue(
      `/channels/${channel.id}/messages`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      {
        meta: {
          feedId: metadata.feedId,
          articleIdHash: metadata.articleIdHash,
          mediumId: medium.id,
          emitDeliveryResult: true,
        },
      }
    );
  }

  throw new Error("No channel or webhook specified in medium");
}

/**
 * Deliver multiple articles to all mediums.
 * Matches the loop order and rate limiting behavior of user-feeds DeliveryService.deliver.
 *
 * Loop order: mediums → articles (matching user-feeds)
 * Rate limiting: Pre-query remaining counts, then decrement in-memory after each successful delivery
 */
export async function deliverArticles(
  articles: Article[],
  mediums: DeliveryMedium[],
  options: {
    feedId: string;
    articleDayLimit: number;
    deliveryRecordStore?: DeliveryRecordStore;
  }
): Promise<ArticleDeliveryState[]> {
  const deliveryRecordStore =
    options.deliveryRecordStore ?? inMemoryDeliveryRecordStore;
  let articleStates: ArticleDeliveryState[] = [];

  // Pre-query feed-level rate limit (matching user-feeds pattern)
  const feedLimitInfo = await getUnderLimitCheck(
    deliveryRecordStore,
    { feedId: options.feedId },
    [
      {
        limit: options.articleDayLimit,
        timeWindowSeconds: 86400, // 24 hours
      },
    ]
  );

  /**
   * Rate limit handling in memory is not the best, especially since articles get dropped and
   * concurrency is not handled well, but it should be good enough for now.
   * (Comment from user-feeds DeliveryService)
   */
  const limitState: LimitState = {
    remaining: feedLimitInfo.remaining,
    remainingInMedium: Number.MAX_SAFE_INTEGER,
  };

  // Loop: mediums → articles (matching user-feeds order)
  for (const medium of mediums) {
    // Pre-query medium-level rate limits
    const mediumLimitInfo = await getUnderLimitCheck(
      deliveryRecordStore,
      { mediumId: medium.id },
      medium.rateLimits ?? []
    );

    limitState.remainingInMedium = mediumLimitInfo.remaining;

    // Deliver articles to this medium
    for (const article of articles) {
      const states = await sendArticleToMedium(
        article,
        medium,
        limitState,
        options.feedId
      );
      articleStates = articleStates.concat(states);
    }
  }

  return articleStates;
}

/**
 * Process a delivery result from the Discord REST producer callback.
 * This handles error classification and generates appropriate events for medium rejection.
 *
 * @param deliveryResult - The result from Discord REST producer
 * @returns Processed result with error classification and optional rejection event
 */
export function processDeliveryResult(deliveryResult: DiscordDeliveryResult): {
  processed: ProcessedDeliveryResult;
  rejectionEvent?: MediumRejectionEvent;
} {
  const { job, result } = deliveryResult;

  const meta: DeliveryJobMeta = {
    feedId: job.meta?.feedId ?? "",
    articleIdHash: job.meta?.articleIdHash ?? "",
    mediumId: job.meta?.mediumId ?? "",
    articleId: job.meta?.articleId,
  };

  // Check for error state (producer-level error)
  if (result.state === "error") {
    return {
      processed: {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.Internal,
        internalMessage: result.message,
        meta,
      },
    };
  }

  // Handle HTTP status codes from Discord API response
  const { status, body } = result;

  // 400 Bad Request - malformed request, likely bad embed/content format
  if (status === 400) {
    const responseBody = JSON.stringify(body);
    const requestBody = job.options?.body;

    return {
      processed: {
        status: ArticleDeliveryStatus.Rejected,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyBadRequest,
        internalMessage: `Body: ${responseBody}, Request Body: ${requestBody}`,
        externalDetail: JSON.stringify({
          type: "DISCORD_RESPONSE",
          data: {
            responseBody: body,
            requestBody: requestBody ? JSON.parse(requestBody) : undefined,
          },
        }),
        meta,
      },
      rejectionEvent: {
        type: "badFormat",
        data: {
          feedId: meta.feedId,
          mediumId: meta.mediumId,
          articleId: meta.articleId,
          responseBody,
        },
      },
    };
  }

  // 403 Forbidden - missing permissions
  if (status === 403) {
    return {
      processed: {
        status: ArticleDeliveryStatus.Rejected,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyForbidden,
        internalMessage: `Body: ${JSON.stringify(body)}`,
        meta,
      },
      rejectionEvent: {
        type: "missingPermissions",
        data: {
          feedId: meta.feedId,
          mediumId: meta.mediumId,
        },
      },
    };
  }

  // 404 Not Found - channel/webhook deleted
  if (status === 404) {
    return {
      processed: {
        status: ArticleDeliveryStatus.Rejected,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyNotFound,
        internalMessage: `Body: ${JSON.stringify(body)}`,
        meta,
      },
      rejectionEvent: {
        type: "notFound",
        data: {
          feedId: meta.feedId,
          mediumId: meta.mediumId,
        },
      },
    };
  }

  // 5xx Internal Server Error - Discord API error
  if (status >= 500) {
    return {
      processed: {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyInternal,
        internalMessage: `Body: ${JSON.stringify(body)}`,
        meta,
      },
    };
  }

  // Unhandled status codes (outside 200-400 range)
  if (status < 200 || status > 400) {
    return {
      processed: {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.Internal,
        internalMessage: `Unhandled status code from Discord ${status} received. Body: ${JSON.stringify(body)}`,
        meta,
      },
    };
  }

  // Success (2xx status codes)
  return {
    processed: {
      status: ArticleDeliveryStatus.Sent,
      meta,
    },
  };
}
