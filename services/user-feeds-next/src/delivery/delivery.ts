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
} from "../delivery-record-store";

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

export interface ArticleDeliveryResult {
  status: ArticleDeliveryStatus;
  article: Article;
  mediumId: string;
  message?: string;
}

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
// Rate Limiting (Stubbed)
// ============================================================================

export interface RateLimitStore {
  /**
   * Check if delivery is allowed and increment the counter if so.
   * Returns true if allowed, false if rate limited.
   */
  checkAndIncrement(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<boolean>;

  /**
   * Get remaining deliveries for a feed's daily limit.
   */
  getRemainingDailyDeliveries(
    feedId: string,
    dailyLimit: number
  ): Promise<number>;

  /**
   * Increment the daily delivery count.
   */
  incrementDailyDeliveries(feedId: string): Promise<void>;
}

// In-memory rate limit store (stub)
const rateLimitCounters: Map<string, { count: number; expiresAt: number }> =
  new Map();
const dailyDeliveryCounters: Map<string, { count: number; resetAt: number }> =
  new Map();

export const inMemoryRateLimitStore: RateLimitStore = {
  async checkAndIncrement(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<boolean> {
    const now = Date.now();
    const entry = rateLimitCounters.get(key);

    if (!entry || entry.expiresAt < now) {
      rateLimitCounters.set(key, {
        count: 1,
        expiresAt: now + windowSeconds * 1000,
      });
      return true;
    }

    if (entry.count >= limit) {
      return false;
    }

    entry.count++;
    return true;
  },

  async getRemainingDailyDeliveries(
    feedId: string,
    dailyLimit: number
  ): Promise<number> {
    const now = Date.now();
    const entry = dailyDeliveryCounters.get(feedId);

    if (!entry || entry.resetAt < now) {
      return dailyLimit;
    }

    return Math.max(0, dailyLimit - entry.count);
  },

  async incrementDailyDeliveries(feedId: string): Promise<void> {
    const now = Date.now();
    const entry = dailyDeliveryCounters.get(feedId);
    const resetAt = now + 24 * 60 * 60 * 1000; // 24 hours from now

    if (!entry || entry.resetAt < now) {
      dailyDeliveryCounters.set(feedId, { count: 1, resetAt });
    } else {
      entry.count++;
    }
  },
};

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
 * Deliver an article to a Discord medium.
 */
export async function deliverArticleToMedium(
  article: Article,
  medium: DeliveryMedium,
  options: {
    feedId: string;
    articleDayLimit: number;
    rateLimitStore: RateLimitStore;
  }
): Promise<ArticleDeliveryResult> {
  const { feedId, articleDayLimit, rateLimitStore } = options;

  // Check medium filters
  if (medium.filters?.expression) {
    const filterResult = getArticleFilterResults(
      medium.filters.expression,
      article
    );
    if (!filterResult.result) {
      return {
        status: ArticleDeliveryStatus.FilteredOut,
        article,
        mediumId: medium.id,
        message: "Article filtered out by medium filters",
      };
    }
  }

  // Check daily rate limit
  const remaining = await rateLimitStore.getRemainingDailyDeliveries(
    feedId,
    articleDayLimit
  );
  if (remaining <= 0) {
    return {
      status: ArticleDeliveryStatus.RateLimited,
      article,
      mediumId: medium.id,
      message: "Daily article limit reached",
    };
  }

  // Check medium-specific rate limits
  if (medium.rateLimits?.length) {
    for (const rateLimit of medium.rateLimits) {
      const key = `medium:${medium.id}:${rateLimit.timeWindowSeconds}`;
      const allowed = await rateLimitStore.checkAndIncrement(
        key,
        rateLimit.limit,
        rateLimit.timeWindowSeconds
      );
      if (!allowed) {
        return {
          status: ArticleDeliveryStatus.RateLimited,
          article,
          mediumId: medium.id,
          message: `Medium rate limit reached (${rateLimit.limit}/${rateLimit.timeWindowSeconds}s)`,
        };
      }
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
    return {
      status: ArticleDeliveryStatus.Rejected,
      article,
      mediumId: medium.id,
      message: "No payloads generated (empty message)",
    };
  }

  // Send to Discord
  try {
    for (const payload of payloads) {
      await sendToDiscord(medium, payload, {
        feedId,
        articleIdHash: article.flattened.idHash,
      });
    }

    // Increment daily delivery count
    await rateLimitStore.incrementDailyDeliveries(feedId);

    return {
      status: ArticleDeliveryStatus.Sent,
      article,
      mediumId: medium.id,
    };
  } catch (err) {
    return {
      status: ArticleDeliveryStatus.Failed,
      article,
      mediumId: medium.id,
      message: (err as Error).message,
    };
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
 */
export async function deliverArticles(
  articles: Article[],
  mediums: DeliveryMedium[],
  options: {
    feedId: string;
    articleDayLimit: number;
    rateLimitStore?: RateLimitStore;
  }
): Promise<ArticleDeliveryResult[]> {
  const rateLimitStore = options.rateLimitStore ?? inMemoryRateLimitStore;
  const results: ArticleDeliveryResult[] = [];

  for (const article of articles) {
    for (const medium of mediums) {
      const result = await deliverArticleToMedium(article, medium, {
        feedId: options.feedId,
        articleDayLimit: options.articleDayLimit,
        rateLimitStore,
      });
      results.push(result);

      // Stop if we hit the daily limit
      if (result.status === ArticleDeliveryStatus.RateLimited) {
        break;
      }
    }
  }

  return results;
}

/**
 * Clear in-memory rate limit stores (for testing).
 */
export function clearRateLimitStores(): void {
  rateLimitCounters.clear();
  dailyDeliveryCounters.clear();
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
