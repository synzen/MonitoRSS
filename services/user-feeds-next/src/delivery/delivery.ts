import type { JobResponse } from "@synzen/discord-rest";
import type {
  JobData,
  JobResponseError,
} from "@synzen/discord-rest/dist/RESTConsumer";
import type { Article } from "../articles/parser";
import type {
  DiscordMessageApiPayload,
  WebhookPayload,
} from "../articles/formatter";
import type {
  DiscordRestClient,
  DiscordApiResponse,
} from "./mediums/discord/discord-rest-client";
import {
  getChannelApiUrl,
  getWebhookApiUrl,
  getCreateChannelThreadUrl,
  getCreateChannelMessageThreadUrl,
} from "./mediums/discord/synzen-discord-rest";
import {
  getArticleFilterResults,
  type LogicalExpression,
} from "../articles/filters";
import {
  generateDiscordPayloads,
  enhancePayloadsWithWebhookDetails,
  generateThreadName,
  buildForumThreadBody,
  getForumTagsToSend,
  formatArticleForDiscord,
  CustomPlaceholderStepType,
} from "../articles/formatter";
import { RegexEvalException } from "../articles/formatter/exceptions";
import type { FeedV2Event } from "../shared/schemas";
import { logger } from "../shared/utils";
import {
  ArticleDeliveryStatus,
  ArticleDeliveryErrorCode,
  ArticleDeliveryContentType,
  type DeliveryRecordStore,
  type ArticleDeliveryState,
  generateDeliveryId,
} from "../stores/interfaces/delivery-record-store";
import {
  inMemoryDeliveryRecordStore,
} from "../stores/in-memory/delivery-record-store";
import {
  isDeliveryPreviewMode,
  recordDeliveryPreviewForArticle,
  DeliveryPreviewStage,
  DeliveryPreviewStageStatus,
  type FilterExplainBlockedDetail,
} from "../delivery-preview";

const SECONDS_PER_DAY = 86400;

// Re-export ArticleDeliveryState for convenience
export type { ArticleDeliveryState };

/**
 * Parameters for recording a rate limit diagnostic.
 */
export interface RateLimitDiagnosticParams {
  articleIdHash: string;
  isFeedLevel: boolean;
  mediumId?: string;
  currentCount: number;
  limit: number;
  timeWindowSeconds: number;
  remaining: number;
}

/**
 * Record a rate limit diagnostic (feed or medium level).
 */
export function recordRateLimitDiagnostic(
  params: RateLimitDiagnosticParams
): void {
  if (!isDeliveryPreviewMode()) {
    return;
  }

  const wouldExceed = params.remaining <= 0;

  const status = wouldExceed ? DeliveryPreviewStageStatus.Failed : DeliveryPreviewStageStatus.Passed;

  if (params.isFeedLevel) {
    recordDeliveryPreviewForArticle(params.articleIdHash, {
      stage: DeliveryPreviewStage.FeedRateLimit,
      status,
      details: {
        currentCount: params.currentCount,
        limit: params.limit,
        timeWindowSeconds: params.timeWindowSeconds,
        remaining: params.remaining,
        wouldExceed,
      },
    });
  } else {
    recordDeliveryPreviewForArticle(params.articleIdHash, {
      stage: DeliveryPreviewStage.MediumRateLimit,
      status,
      details: {
        mediumId: params.mediumId || "",
        currentCount: params.currentCount,
        limit: params.limit,
        timeWindowSeconds: params.timeWindowSeconds,
        remaining: params.remaining,
        wouldExceed,
      },
    });
  }
}

/**
 * Parameters for recording a medium filter diagnostic.
 */
export interface MediumFilterDiagnosticParams {
  articleIdHash: string;
  mediumId: string;
  filterExpression: unknown | null;
  filterResult: boolean;
  explainBlocked: FilterExplainBlockedDetail[];
  explainMatched: FilterExplainBlockedDetail[];
}

/**
 * Record a medium filter diagnostic.
 */
export function recordMediumFilterDiagnostic(
  params: MediumFilterDiagnosticParams
): void {
  if (!isDeliveryPreviewMode()) {
    return;
  }

  recordDeliveryPreviewForArticle(params.articleIdHash, {
    stage: DeliveryPreviewStage.MediumFilter,
    status: params.filterResult ? DeliveryPreviewStageStatus.Passed : DeliveryPreviewStageStatus.Failed,
    details: {
      mediumId: params.mediumId,
      filterExpression: params.filterExpression,
      filterResult: params.filterResult,
      explainBlocked: params.explainBlocked,
      explainMatched: params.explainMatched,
    },
  });
}

// Re-export for convenience
export {
  ArticleDeliveryStatus,
  ArticleDeliveryErrorCode,
  ArticleDeliveryContentType,
};

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
    channel?: {
      id: string;
      type?: "forum" | "thread" | "new-thread";
    };
    webhook?: {
      id: string;
      token: string;
      name?: string;
      iconUrl?: string;
      threadId?: string | null;
      type?: "forum";
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
    channelNewThreadTitle?: string;
    channelNewThreadExcludesPreview?: boolean;
    formatter?: {
      stripImages?: boolean;
      formatTables?: boolean;
      disableImageLinkPreviews?: boolean;
      ignoreNewLines?: boolean;
    };
    components?: FeedV2Event["data"]["mediums"][number]["details"]["components"];
    componentsV2?: FeedV2Event["data"]["mediums"][number]["details"]["componentsV2"];
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

// Re-export URL builders for convenience
export {
  getChannelApiUrl,
  getWebhookApiUrl,
  getCreateChannelThreadUrl,
  getCreateChannelMessageThreadUrl,
};

// ============================================================================
// Message Enqueuing (matching discord-message-enqueue.service.ts)
// ============================================================================

export interface EnqueueMessagesOptions {
  discordClient: DiscordRestClient;
  apiUrl: string;
  bodies: DiscordMessageApiPayload[];
  article: Article;
  mediumId: string;
  feedId: string;
  feedUrl: string;
  guildId: string;
  channelId?: string;
  webhookId?: string;
  parentDeliveryId?: string;
}

/**
 * Enqueue messages to Discord via the REST producer.
 * Returns PendingDelivery states for all messages.
 * Matches discord-message-enqueue.service.ts enqueueMessages.
 */
async function enqueueMessages(
  options: EnqueueMessagesOptions
): Promise<ArticleDeliveryState[]> {
  const {
    discordClient,
    apiUrl,
    bodies,
    article,
    mediumId,
    feedId,
    feedUrl,
    guildId,
    channelId,
    webhookId,
    parentDeliveryId: existingParentId,
  } = options;

  const deliveryStates: ArticleDeliveryState[] = [];
  const parentDeliveryId = existingParentId || generateDeliveryId();

  for (let idx = 0; idx < bodies.length; idx++) {
    const body = bodies[idx];
    const isFirst = idx === 0 && !existingParentId;
    const deliveryId = isFirst ? parentDeliveryId : generateDeliveryId();

    await discordClient.enqueue(
      apiUrl,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      {
        id: deliveryId,
        articleID: article.flattened.id,
        feedURL: feedUrl,
        ...(channelId ? { channel: channelId } : {}),
        ...(webhookId ? { webhookId } : {}),
        feedId,
        guildId,
        mediumId,
        emitDeliveryResult: true,
      }
    );

    deliveryStates.push({
      id: deliveryId,
      status: ArticleDeliveryStatus.PendingDelivery,
      mediumId,
      contentType: ArticleDeliveryContentType.DiscordArticleMessage,
      articleIdHash: article.flattened.idHash,
      parent: isFirst ? undefined : parentDeliveryId,
      article,
    });
  }

  return deliveryStates;
}

// ============================================================================
// Thread Creation Response Parsing (matching discord-delivery-result.service.ts)
// ============================================================================

/**
 * Parse a thread creation API response into delivery states.
 * Matches discord-delivery-result.service.ts parseThreadCreateResponseToDeliveryStates.
 */
function parseThreadCreateResponseToDeliveryStates(
  response: DiscordApiResponse,
  article: Article,
  mediumId: string,
  contentType: ArticleDeliveryContentType
): ArticleDeliveryState[] {
  if (!response.success) {
    throw new Error(
      `Failed to create thread for medium ${mediumId}: ${
        response.detail
      }. Body: ${JSON.stringify(response.body)}`
    );
  }

  if (response.status === 404) {
    return [
      {
        id: generateDeliveryId(),
        status: ArticleDeliveryStatus.Rejected,
        mediumId,
        contentType,
        articleIdHash: article.flattened.idHash,
        errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
        internalMessage: `Response: ${JSON.stringify(response.body)}`,
        externalDetail:
          "Unknown channel. Update the connection to use a different channel.",
        article,
      },
    ];
  }

  if (response.status === 403) {
    return [
      {
        id: generateDeliveryId(),
        status: ArticleDeliveryStatus.Rejected,
        mediumId,
        contentType,
        articleIdHash: article.flattened.idHash,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyForbidden,
        internalMessage: `Response: ${JSON.stringify(response.body)}`,
        externalDetail: "Missing permissions",
        article,
      },
    ];
  }

  if (response.status === 400) {
    return [
      {
        id: generateDeliveryId(),
        status: ArticleDeliveryStatus.Rejected,
        mediumId,
        contentType,
        articleIdHash: article.flattened.idHash,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyBadRequest,
        internalMessage: `Response: ${JSON.stringify(response.body)}`,
        externalDetail: JSON.stringify(response.body, null, 2),
        article,
      },
    ];
  }

  if (response.status > 300 || response.status < 200) {
    return [
      {
        id: generateDeliveryId(),
        status: ArticleDeliveryStatus.Failed,
        mediumId,
        articleIdHash: article.flattened.idHash,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyBadRequest,
        internalMessage: `Response: ${JSON.stringify(response.body)}`,
        article,
      },
    ];
  }

  return [
    {
      id: generateDeliveryId(),
      status: ArticleDeliveryStatus.Sent,
      mediumId,
      contentType,
      articleIdHash: article.flattened.idHash,
      article,
    },
  ];
}

// ============================================================================
// Delivery Context (matching user-feeds FeedContext/DeliverArticleDetails)
// ============================================================================

interface DeliverArticleContext {
  discordClient: DiscordRestClient;
  mediumId: string;
  feedId: string;
  feedUrl: string;
  guildId: string;
  filterReferences: Map<string, string>;
  deliverySettings: {
    channel?: DeliveryMedium["details"]["channel"];
    webhook?: DeliveryMedium["details"]["webhook"];
    content?: string;
    embeds?: DeliveryMedium["details"]["embeds"];
    splitOptions?: DeliveryMedium["details"]["splitOptions"];
    placeholderLimits?: DeliveryMedium["details"]["placeholderLimits"];
    enablePlaceholderFallback?: boolean;
    mentions?: DeliveryMedium["details"]["mentions"];
    customPlaceholders?: DeliveryMedium["details"]["customPlaceholders"];
    forumThreadTitle?: string;
    forumThreadTags?: DeliveryMedium["details"]["forumThreadTags"];
    channelNewThreadTitle?: string;
    channelNewThreadExcludesPreview?: boolean;
  };
}

// ============================================================================
// Payload Generation Helper
// ============================================================================

/**
 * Generate Discord payloads for an already-formatted article.
 * The article must have been formatted via formatArticleForDiscord before calling this.
 */
function generatePayloadsForFormattedArticle(
  formattedArticle: Article,
  medium: DeliveryMedium
): DiscordMessageApiPayload[] {
  return generateDiscordPayloads(formattedArticle, {
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
    components: medium.details.components?.map((row) => ({
      type: row.type,
      components: row.components.map((btn) => ({
        type: btn.type,
        style: btn.style,
        label: btn.label,
        url: btn.url ?? undefined,
        emoji: btn.emoji ?? undefined,
      })),
    })),
    componentsV2: medium.details.componentsV2 ?? undefined,
  });
}

// ============================================================================
// Delivery Methods (matching discord-medium.service.ts)
// ============================================================================

/**
 * Deliver article to a webhook forum channel.
 * Matches discord-medium.service.ts deliverArticleToWebhookForum.
 */
async function deliverToWebhookForum(
  article: Article,
  medium: DeliveryMedium,
  context: DeliverArticleContext
): Promise<ArticleDeliveryState[]> {
  const { webhook } = medium.details;
  if (!webhook) {
    throw new Error("Webhook required for webhook forum delivery");
  }

  const apiUrl = getWebhookApiUrl(webhook.id, webhook.token);

  const payloadOptions = {
    enablePlaceholderFallback: medium.details.enablePlaceholderFallback,
    customPlaceholders: medium.details.customPlaceholders?.map((cp) => ({
      ...cp,
      steps: cp.steps.map((s) => ({ ...s, type: s.type as never })),
    })),
  };

  const initialBodies = generatePayloadsForFormattedArticle(article, medium);

  const bodies = enhancePayloadsWithWebhookDetails(
    article,
    initialBodies,
    webhook.name,
    webhook.iconUrl,
    payloadOptions
  );

  const threadName = generateThreadName(
    article,
    medium.details.forumThreadTitle,
    payloadOptions
  );

  if (bodies.length === 0) {
    throw new Error("No payloads generated for webhook forum delivery");
  }

  const firstPayload = bodies[0]!;

  const threadBody = buildForumThreadBody({
    isWebhook: true,
    threadName,
    firstPayload,
    tags: getForumTagsToSend(medium.details.forumThreadTags, article),
  });

  const res = await context.discordClient.sendApiRequest(apiUrl, {
    method: "POST",
    body: threadBody,
  });

  if (!res.success || res.status >= 300 || res.status < 200) {
    throw new Error(
      `Failed to create initial thread for webhook forum ${webhook.id}: ${
        res.detail
      }. Body: ${JSON.stringify(res.body)}`
    );
  }

  const threadId = (res.body as Record<string, unknown>).id as string;

  const channelApiUrl = getWebhookApiUrl(webhook.id, webhook.token, {
    threadId,
  });

  const parentDeliveryId = generateDeliveryId();

  const additionalDeliveryStates = await enqueueMessages({
    discordClient: context.discordClient,
    apiUrl: channelApiUrl,
    bodies: bodies.slice(1),
    article,
    mediumId: context.mediumId,
    feedId: context.feedId,
    feedUrl: context.feedUrl,
    guildId: context.guildId,
    channelId: threadId,
    parentDeliveryId,
  });

  return [
    {
      id: parentDeliveryId,
      status: ArticleDeliveryStatus.Sent,
      mediumId: context.mediumId,
      contentType: ArticleDeliveryContentType.DiscordThreadCreation,
      articleIdHash: article.flattened.idHash,
      article,
    },
    ...additionalDeliveryStates,
  ];
}

/**
 * Deliver article to a channel forum.
 * Matches discord-medium.service.ts deliverArticleToChannelForum.
 */
async function deliverToChannelForum(
  article: Article,
  medium: DeliveryMedium,
  context: DeliverArticleContext
): Promise<ArticleDeliveryState[]> {
  const { channel } = medium.details;
  if (!channel) {
    throw new Error("Channel required for channel forum delivery");
  }

  const forumApiUrl = getCreateChannelThreadUrl(channel.id);

  const payloadOptions = {
    enablePlaceholderFallback: medium.details.enablePlaceholderFallback,
    customPlaceholders: medium.details.customPlaceholders?.map((cp) => ({
      ...cp,
      steps: cp.steps.map((s) => ({ ...s, type: s.type as never })),
    })),
  };

  const bodies = generatePayloadsForFormattedArticle(article, medium);

  if (bodies.length === 0) {
    throw new Error("No payloads generated for channel forum delivery");
  }

  const threadName = generateThreadName(
    article,
    medium.details.forumThreadTitle,
    payloadOptions
  );

  const firstPayload = bodies[0]!;

  const threadBody = buildForumThreadBody({
    isWebhook: false,
    threadName,
    firstPayload,
    tags: getForumTagsToSend(medium.details.forumThreadTags, article),
  });

  const res = await context.discordClient.sendApiRequest(forumApiUrl, {
    method: "POST",
    body: threadBody,
  });

  const threadCreationDeliveryStates =
    parseThreadCreateResponseToDeliveryStates(
      res,
      article,
      context.mediumId,
      ArticleDeliveryContentType.DiscordThreadCreation
    );

  if (!res.success || res.status >= 300 || res.status < 200) {
    return threadCreationDeliveryStates;
  }

  const firstDeliveryState = threadCreationDeliveryStates[0];
  if (!firstDeliveryState) {
    throw new Error("No delivery state returned from thread creation");
  }
  const parentDeliveryId = firstDeliveryState.id;

  const threadId = (res.body as Record<string, unknown>).id as string;

  const channelApiUrl = getChannelApiUrl(threadId);

  const additionalDeliveryStates = await enqueueMessages({
    discordClient: context.discordClient,
    apiUrl: channelApiUrl,
    bodies: bodies.slice(1),
    article,
    mediumId: context.mediumId,
    feedId: context.feedId,
    feedUrl: context.feedUrl,
    guildId: context.guildId,
    channelId: threadId,
    parentDeliveryId,
  });

  return [...threadCreationDeliveryStates, ...additionalDeliveryStates];
}

/**
 * Deliver article to a regular channel.
 * Matches discord-medium.service.ts deliverArticleToChannel.
 * Supports new-thread creation with or without preview.
 */
async function deliverToChannel(
  article: Article,
  medium: DeliveryMedium,
  context: DeliverArticleContext
): Promise<ArticleDeliveryState[]> {
  const { channel } = medium.details;
  if (!channel) {
    throw new Error("Channel required for channel delivery");
  }

  let parentDeliveryId: string | null = null;
  let threadCreationDeliveryStates: ArticleDeliveryState[] = [];

  const payloadOptions = {
    enablePlaceholderFallback: medium.details.enablePlaceholderFallback,
    customPlaceholders: medium.details.customPlaceholders?.map((cp) => ({
      ...cp,
      steps: cp.steps.map((s) => ({ ...s, type: s.type as never })),
    })),
  };

  const bodies = generatePayloadsForFormattedArticle(article, medium);
  let currentBodiesIndex = 0;
  const shouldCreateThread = channel.type === "new-thread";

  let useChannelId = channel.id;

  if (shouldCreateThread) {
    if (bodies.length === 0) {
      throw new Error("No payloads generated for channel new-thread delivery");
    }

    const shouldCreateThreadFirst =
      !!medium.details.channelNewThreadExcludesPreview;
    const threadName = generateThreadName(
      article,
      medium.details.channelNewThreadTitle,
      payloadOptions
    );

    const threadBody = {
      name: threadName,
      type: 11, // PUBLIC_THREAD
    };

    if (shouldCreateThreadFirst) {
      // Create the thread first and send all posts into it
      const apiUrl = getCreateChannelThreadUrl(channel.id);
      const firstResponse = await context.discordClient.sendApiRequest(apiUrl, {
        method: "POST",
        body: threadBody,
      });

      threadCreationDeliveryStates = parseThreadCreateResponseToDeliveryStates(
        firstResponse,
        article,
        context.mediumId,
        ArticleDeliveryContentType.DiscordThreadCreation
      );

      if (!firstResponse.success) {
        return threadCreationDeliveryStates;
      }

      useChannelId = (firstResponse.body as Record<string, unknown>)
        .id as string;
    } else {
      // Send the post, create a thread from it, then send the rest
      const firstBody = bodies[0];
      if (!firstBody) {
        throw new Error(
          "No payloads generated for channel new-thread delivery"
        );
      }

      const apiUrl = getChannelApiUrl(channel.id);
      const firstPostResponse = await context.discordClient.sendApiRequest(
        apiUrl,
        {
          method: "POST",
          body: firstBody,
        }
      );

      if (!firstPostResponse.success) {
        return parseThreadCreateResponseToDeliveryStates(
          firstPostResponse,
          article,
          context.mediumId,
          ArticleDeliveryContentType.DiscordArticleMessage
        );
      }

      threadCreationDeliveryStates.push({
        id: generateDeliveryId(),
        status: ArticleDeliveryStatus.Sent,
        mediumId: context.mediumId,
        contentType: ArticleDeliveryContentType.DiscordArticleMessage,
        articleIdHash: article.flattened.idHash,
        article,
      });

      const messageId = (firstPostResponse.body as Record<string, unknown>)
        .id as string;

      const messageThreadUrl = getCreateChannelMessageThreadUrl(
        channel.id,
        messageId
      );

      const threadResponse = await context.discordClient.sendApiRequest(
        messageThreadUrl,
        {
          method: "POST",
          body: threadBody,
        }
      );

      if (!threadResponse.success) {
        const failureStates = parseThreadCreateResponseToDeliveryStates(
          threadResponse,
          article,
          context.mediumId,
          ArticleDeliveryContentType.DiscordThreadCreation
        );

        const lastState =
          threadCreationDeliveryStates[threadCreationDeliveryStates.length - 1];
        if (lastState) {
          failureStates.forEach((s) => {
            s.parent = lastState.id;
          });
        }

        return [...threadCreationDeliveryStates, ...failureStates];
      }

      const prevLastState =
        threadCreationDeliveryStates[threadCreationDeliveryStates.length - 1];
      threadCreationDeliveryStates.push({
        id: generateDeliveryId(),
        status: ArticleDeliveryStatus.Sent,
        mediumId: context.mediumId,
        contentType: ArticleDeliveryContentType.DiscordThreadCreation,
        articleIdHash: article.flattened.idHash,
        parent: prevLastState?.id,
        article,
      });

      useChannelId = (threadResponse.body as Record<string, unknown>)
        .id as string;

      currentBodiesIndex = 1;
    }
  }

  if (threadCreationDeliveryStates.length > 0) {
    const lastThreadState =
      threadCreationDeliveryStates[threadCreationDeliveryStates.length - 1];
    parentDeliveryId = lastThreadState?.id ?? null;
  }

  const apiUrl = getChannelApiUrl(useChannelId);

  const allRecords = await enqueueMessages({
    discordClient: context.discordClient,
    apiUrl,
    bodies: bodies.slice(currentBodiesIndex),
    article,
    mediumId: context.mediumId,
    feedId: context.feedId,
    feedUrl: context.feedUrl,
    guildId: context.guildId,
    channelId: useChannelId,
    parentDeliveryId: parentDeliveryId || undefined,
  });

  return [...threadCreationDeliveryStates, ...allRecords];
}

/**
 * Deliver article to a webhook.
 * Matches discord-medium.service.ts deliverArticleToWebhook.
 */
async function deliverToWebhook(
  article: Article,
  medium: DeliveryMedium,
  context: DeliverArticleContext
): Promise<ArticleDeliveryState[]> {
  const { webhook } = medium.details;
  if (!webhook) {
    throw new Error("Webhook required for webhook delivery");
  }

  const apiUrl = getWebhookApiUrl(webhook.id, webhook.token, {
    threadId: webhook.threadId,
  });

  const payloadOptions = {
    enablePlaceholderFallback: medium.details.enablePlaceholderFallback,
    customPlaceholders: medium.details.customPlaceholders?.map((cp) => ({
      ...cp,
      steps: cp.steps.map((s) => ({ ...s, type: s.type as never })),
    })),
  };

  const initialBodies = generatePayloadsForFormattedArticle(article, medium);

  const bodies = enhancePayloadsWithWebhookDetails(
    article,
    initialBodies,
    webhook.name,
    webhook.iconUrl,
    payloadOptions
  );

  const deliveryStates = await enqueueMessages({
    discordClient: context.discordClient,
    apiUrl,
    bodies,
    article,
    mediumId: context.mediumId,
    feedId: context.feedId,
    feedUrl: context.feedUrl,
    guildId: context.guildId,
    webhookId: webhook.id,
  });

  return deliveryStates;
}

// ============================================================================
// Main Delivery Logic
// ============================================================================

/**
 * Send an article to a Discord medium.
 * Matches the behavior of user-feeds DiscordMediumService.deliverArticle.
 *
 * Selects the appropriate delivery method based on channel/webhook type:
 * - webhook.type === "forum" → deliverToWebhookForum
 * - webhook → deliverToWebhook
 * - channel.type === "forum" → deliverToChannelForum
 * - channel → deliverToChannel (with new-thread support)
 *
 * @param article - The article to deliver
 * @param medium - The medium to deliver to
 * @param limitState - The current rate limit state (will be decremented on success)
 * @param feedId - The feed ID
 * @param filterReferences - Map of filter references for dynamic tag filtering
 * @returns Array of delivery states (matching user-feeds pattern)
 */
async function sendArticleToMedium(
  article: Article,
  medium: DeliveryMedium,
  limitState: LimitState,
  feedId: string,
  feedUrl: string,
  discordClient: DiscordRestClient,
  filterReferences?: Map<string, string>
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

    // Format article FIRST (before filtering) - matches user-feeds behavior
    // This ensures filters operate on formatted text (markdown) not raw HTML
    const customPlaceholders = medium.details.customPlaceholders?.map((cp) => ({
      ...cp,
      steps: cp.steps.map((s) => ({
        ...s,
        type: s.type as CustomPlaceholderStepType,
      })),
    }));

    const { article: formattedArticle } = formatArticleForDiscord(article, {
      ...medium.details.formatter,
      customPlaceholders,
    });

    // Check medium filters and collect filter references
    const collectedFilterReferences =
      filterReferences ?? new Map<string, string>();
    if (medium.filters?.expression) {
      const filterResult = getArticleFilterResults(
        medium.filters.expression,
        formattedArticle
      );

      // Record diagnostic for filter evaluation
      recordMediumFilterDiagnostic({
        articleIdHash: formattedArticle.flattened.idHash,
        mediumId: medium.id,
        filterExpression: medium.filters.expression,
        filterResult: filterResult.result,
        explainBlocked: filterResult.explainBlocked,
        explainMatched: filterResult.explainMatched,
      });

      if (!filterResult.result) {
        return [
          {
            id: generateDeliveryId(),
            mediumId: medium.id,
            status: ArticleDeliveryStatus.FilteredOut,
            articleIdHash: formattedArticle.flattened.idHash,
            externalDetail: filterResult.explainBlocked.length
              ? JSON.stringify({ explainBlocked: filterResult.explainBlocked })
              : null,
            article: formattedArticle,
          },
        ];
      }
    }

    const { channel, webhook } = medium.details;

    if (!channel && !webhook) {
      return [
        {
          id: generateDeliveryId(),
          mediumId: medium.id,
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          internalMessage: "No channel or webhook specified",
          articleIdHash: formattedArticle.flattened.idHash,
          article: formattedArticle,
        },
      ];
    }

    const context: DeliverArticleContext = {
      discordClient,
      mediumId: medium.id,
      feedId,
      feedUrl,
      guildId: medium.details.guildId,
      filterReferences: collectedFilterReferences,
      deliverySettings: {
        channel,
        webhook,
        content: medium.details.content,
        embeds: medium.details.embeds,
        splitOptions: medium.details.splitOptions,
        placeholderLimits: medium.details.placeholderLimits,
        enablePlaceholderFallback: medium.details.enablePlaceholderFallback,
        mentions: medium.details.mentions,
        customPlaceholders: medium.details.customPlaceholders,
        forumThreadTitle: medium.details.forumThreadTitle,
        forumThreadTags: medium.details.forumThreadTags,
        channelNewThreadTitle: medium.details.channelNewThreadTitle,
        channelNewThreadExcludesPreview:
          medium.details.channelNewThreadExcludesPreview,
      },
    };

    let deliveryStates: ArticleDeliveryState[];

    // Select delivery method based on channel/webhook type (matching user-feeds)
    if (webhook) {
      if (webhook.type === "forum") {
        deliveryStates = await deliverToWebhookForum(
          formattedArticle,
          medium,
          context
        );
      } else {
        deliveryStates = await deliverToWebhook(
          formattedArticle,
          medium,
          context
        );
      }
    } else if (channel) {
      if (channel.type === "forum") {
        deliveryStates = await deliverToChannelForum(
          formattedArticle,
          medium,
          context
        );
      } else {
        deliveryStates = await deliverToChannel(formattedArticle, medium, context);
      }
    } else {
      throw new Error("No channel or webhook specified for Discord medium");
    }

    // Decrement rate limit counters after successful delivery
    limitState.remaining--;
    limitState.remainingInMedium--;

    return deliveryStates;
  } catch (err) {
    // Handle regex evaluation errors specially (matching user-feeds)
    if (err instanceof RegexEvalException) {
      return [
        {
          id: generateDeliveryId(),
          mediumId: medium.id,
          status: ArticleDeliveryStatus.Rejected,
          articleIdHash: article.flattened.idHash,
          errorCode: ArticleDeliveryErrorCode.ArticleProcessingError,
          internalMessage: (err as Error).message,
          externalDetail: JSON.stringify({
            message: (err as Error).message,
          }),
          article,
        },
      ];
    }

    logger.error(
      `Failed to deliver article ${article.flattened.id} to Discord webhook/channel`,
      {
        webhook: medium.details.webhook,
        channel: medium.details.channel,
        mediumId: medium.id,
        error: (err as Error).stack,
      }
    );

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
    feedUrl: string;
    articleDayLimit: number;
    deliveryRecordStore?: DeliveryRecordStore;
    discordClient: DiscordRestClient;
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
        timeWindowSeconds: SECONDS_PER_DAY,
      },
    ]
  );

  // Record feed rate limit diagnostic for each article (captured when in diagnostic context)
  for (const article of articles) {
    recordRateLimitDiagnostic({
      articleIdHash: article.flattened.idHash,
      isFeedLevel: true,
      currentCount: options.articleDayLimit - feedLimitInfo.remaining,
      limit: options.articleDayLimit,
      timeWindowSeconds: SECONDS_PER_DAY,
      remaining: feedLimitInfo.remaining,
    });
  }

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

    // Record medium rate limit diagnostic for each article (captured when in diagnostic context)
    const primaryLimit = medium.rateLimits?.[0];
    if (primaryLimit) {
      for (const article of articles) {
        recordRateLimitDiagnostic({
          articleIdHash: article.flattened.idHash,
          isFeedLevel: false,
          mediumId: medium.id,
          currentCount: primaryLimit.limit - mediumLimitInfo.remaining,
          limit: primaryLimit.limit,
          timeWindowSeconds: primaryLimit.timeWindowSeconds,
          remaining: mediumLimitInfo.remaining,
        });
      }
    }

    limitState.remainingInMedium = mediumLimitInfo.remaining;

    // Deliver articles to this medium
    for (const article of articles) {
      const states = await sendArticleToMedium(
        article,
        medium,
        limitState,
        options.feedId,
        options.feedUrl,
        options.discordClient
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
