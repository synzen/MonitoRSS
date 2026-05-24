import type { Article } from "../../articles/parser";
import type { DiscordMessageApiPayload, WebhookPayload } from "./formatting-types";
import type {
  DiscordRestClient,
  DiscordApiResponse,
} from "./discord-rest-client";
import {
  getChannelApiUrl,
  getWebhookApiUrl,
  getCreateChannelThreadUrl,
  getCreateChannelMessageThreadUrl,
} from "./synzen-discord-rest";
import {
  getArticleFilterResults,
  type LogicalExpression,
} from "../../articles/filters";
import {
  generateDiscordPayloads,
  enhancePayloadsWithWebhookDetails,
  generateThreadName,
  buildForumThreadBody,
  getForumTagsToSend,
} from "./discord-payload-builder";
import { formatArticleForDiscord } from "./html-to-discord";
import { CustomPlaceholderStepType } from "../../formatting";
import { RegexEvalException } from "../../formatting/exceptions";
import { logger } from "../../shared/utils";
import {
  ArticleDeliveryStatus,
  ArticleDeliveryErrorCode,
  ArticleDeliveryContentType,
  type DeliveryRecordStore,
  type ArticleDeliveryState,
  generateDeliveryId,
} from "../../stores/interfaces/delivery-record-store";
import { isDeliveryPreviewMode } from "../../shared/delivery-preview";
import { recordRateLimitDiagnostic } from "./preview-diagnostics";
import { recordMediumFilterDiagnostic } from "./preview-diagnostics";
import { getUnderLimitCheck } from "../rate-limiting";
import type { DeliveryMedium, LimitState } from "../types";

export type { ArticleDeliveryState };
export {
  ArticleDeliveryStatus,
  ArticleDeliveryErrorCode,
  ArticleDeliveryContentType,
};
export {
  getChannelApiUrl,
  getWebhookApiUrl,
  getCreateChannelThreadUrl,
  getCreateChannelMessageThreadUrl,
};

const SECONDS_PER_DAY = 86400;

// ============================================================================
// Message Enqueuing
// ============================================================================

interface EnqueuePayload {
  url: string;
  options: { method: "POST"; body: string };
  meta: Record<string, unknown>;
}

interface DeliveryResult {
  states: ArticleDeliveryState[];
  pendingPayloads: EnqueuePayload[];
}

interface BuildEnqueuePayloadsOptions {
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

function buildEnqueuePayloads(
  options: BuildEnqueuePayloadsOptions
): DeliveryResult {
  const {
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

  const parentDeliveryId = existingParentId || generateDeliveryId();

  const states: ArticleDeliveryState[] = [];
  const pendingPayloads: EnqueuePayload[] = [];

  for (let idx = 0; idx < bodies.length; idx++) {
    const body = bodies[idx];
    const isFirst = idx === 0 && !existingParentId;
    const deliveryId = isFirst ? parentDeliveryId : generateDeliveryId();

    states.push({
      id: deliveryId,
      status: ArticleDeliveryStatus.PendingDelivery,
      mediumId,
      contentType: ArticleDeliveryContentType.DiscordArticleMessage,
      articleIdHash: article.flattened.idHash,
      parent: isFirst ? undefined : parentDeliveryId,
      article,
    });

    pendingPayloads.push({
      url: apiUrl,
      options: { method: "POST", body: JSON.stringify(body) },
      meta: {
        id: deliveryId,
        articleID: article.flattened.id,
        feedURL: feedUrl,
        ...(channelId ? { channel: channelId } : {}),
        ...(webhookId ? { webhookId } : {}),
        feedId,
        guildId,
        mediumId,
        emitDeliveryResult: true,
      },
    });
  }

  return { states, pendingPayloads };
}

// ============================================================================
// Thread Creation Response Parsing
// ============================================================================

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
// Delivery Context
// ============================================================================

interface InternalDeliverArticleContext {
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
// Delivery Methods
// ============================================================================

async function deliverToWebhookForum(
  article: Article,
  medium: DeliveryMedium,
  context: InternalDeliverArticleContext
): Promise<DeliveryResult> {
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

  const { states: additionalStates, pendingPayloads } = buildEnqueuePayloads({
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

  return {
    states: [
      {
        id: parentDeliveryId,
        status: ArticleDeliveryStatus.Sent,
        mediumId: context.mediumId,
        contentType: ArticleDeliveryContentType.DiscordThreadCreation,
        articleIdHash: article.flattened.idHash,
        article,
      },
      ...additionalStates,
    ],
    pendingPayloads,
  };
}

async function deliverToChannelForum(
  article: Article,
  medium: DeliveryMedium,
  context: InternalDeliverArticleContext
): Promise<DeliveryResult> {
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
    return { states: threadCreationDeliveryStates, pendingPayloads: [] };
  }

  const firstDeliveryState = threadCreationDeliveryStates[0];
  if (!firstDeliveryState) {
    throw new Error("No delivery state returned from thread creation");
  }
  const parentDeliveryId = firstDeliveryState.id;

  const threadId = (res.body as Record<string, unknown>).id as string;

  const channelApiUrl = getChannelApiUrl(threadId);

  const { states: additionalStates, pendingPayloads } = buildEnqueuePayloads({
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

  return {
    states: [...threadCreationDeliveryStates, ...additionalStates],
    pendingPayloads,
  };
}

async function deliverToChannel(
  article: Article,
  medium: DeliveryMedium,
  context: InternalDeliverArticleContext
): Promise<DeliveryResult> {
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
        return { states: threadCreationDeliveryStates, pendingPayloads: [] };
      }

      useChannelId = (firstResponse.body as Record<string, unknown>)
        .id as string;
    } else {
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
        return {
          states: parseThreadCreateResponseToDeliveryStates(
            firstPostResponse,
            article,
            context.mediumId,
            ArticleDeliveryContentType.DiscordArticleMessage
          ),
          pendingPayloads: [],
        };
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

        return {
          states: [...threadCreationDeliveryStates, ...failureStates],
          pendingPayloads: [],
        };
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

  const { states: enqueueStates, pendingPayloads } = buildEnqueuePayloads({
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

  return {
    states: [...threadCreationDeliveryStates, ...enqueueStates],
    pendingPayloads,
  };
}

async function deliverToWebhook(
  article: Article,
  medium: DeliveryMedium,
  context: InternalDeliverArticleContext
): Promise<DeliveryResult> {
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

  return buildEnqueuePayloads({
    apiUrl,
    bodies,
    article,
    mediumId: context.mediumId,
    feedId: context.feedId,
    feedUrl: context.feedUrl,
    guildId: context.guildId,
    webhookId: webhook.id,
  });
}

// ============================================================================
// Main Delivery Logic
// ============================================================================

async function sendArticleToMedium(
  article: Article,
  medium: DeliveryMedium,
  limitState: LimitState,
  feedId: string,
  feedUrl: string,
  discordClient: DiscordRestClient,
  filterReferences?: Map<string, string>
): Promise<DeliveryResult> {
  try {
    if (limitState.remaining <= 0 || limitState.remainingInMedium <= 0) {
      return {
        states: [
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
        ],
        pendingPayloads: [],
      };
    }

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

    const collectedFilterReferences =
      filterReferences ?? new Map<string, string>();
    if (medium.filters?.expression) {
      const filterResult = getArticleFilterResults(
        medium.filters.expression,
        formattedArticle
      );

      recordMediumFilterDiagnostic({
        articleIdHash: formattedArticle.flattened.idHash,
        mediumId: medium.id,
        filterExpression: medium.filters.expression,
        filterResult: filterResult.result,
        explainBlocked: filterResult.explainBlocked,
        explainMatched: filterResult.explainMatched,
      });

      if (!filterResult.result) {
        return {
          states: [
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
          ],
          pendingPayloads: [],
        };
      }
    }

    const { channel, webhook } = medium.details;

    if (!channel && !webhook) {
      return {
        states: [
          {
            id: generateDeliveryId(),
            mediumId: medium.id,
            status: ArticleDeliveryStatus.Failed,
            errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
            internalMessage: "No channel or webhook specified",
            articleIdHash: formattedArticle.flattened.idHash,
            article: formattedArticle,
          },
        ],
        pendingPayloads: [],
      };
    }

    const context: InternalDeliverArticleContext = {
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

    let result: DeliveryResult;

    if (webhook) {
      if (webhook.type === "forum") {
        result = await deliverToWebhookForum(formattedArticle, medium, context);
      } else {
        result = await deliverToWebhook(formattedArticle, medium, context);
      }
    } else if (channel) {
      if (channel.type === "forum") {
        result = await deliverToChannelForum(formattedArticle, medium, context);
      } else {
        result = await deliverToChannel(formattedArticle, medium, context);
      }
    } else {
      throw new Error("No channel or webhook specified for Discord medium");
    }

    if (result.states.length === 0) {
      logger.warn(
        "No Discord payloads generated for article - content and embeds are both empty after placeholder resolution",
        {
          feedId,
          mediumId: medium.id,
          articleId: formattedArticle.flattened.id,
        }
      );

      return {
        states: [
          {
            id: generateDeliveryId(),
            mediumId: medium.id,
            status: ArticleDeliveryStatus.Rejected,
            errorCode: ArticleDeliveryErrorCode.NoPayloadForMedium,
            internalMessage:
              "No Discord payloads were generated for this article. " +
              "The message content and embeds are both empty after placeholder resolution.",
            externalDetail:
              "No Discord payloads were generated for this article. " +
              "Check that your message content or embeds contain valid placeholders.",
            articleIdHash: formattedArticle.flattened.idHash,
            article: formattedArticle,
          },
        ],
        pendingPayloads: [],
      };
    }

    limitState.remaining--;
    limitState.remainingInMedium--;

    return result;
  } catch (err) {
    if (err instanceof RegexEvalException) {
      return {
        states: [
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
        ],
        pendingPayloads: [],
      };
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

    return {
      states: [
        {
          id: generateDeliveryId(),
          mediumId: medium.id,
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.Internal,
          internalMessage: (err as Error).message,
          articleIdHash: article.flattened.idHash,
          article,
        },
      ],
      pendingPayloads: [],
    };
  }
}

export async function deliverArticles(
  articles: Article[],
  mediums: DeliveryMedium[],
  options: {
    feedId: string;
    feedUrl: string;
    articleDayLimit: number;
    deliveryRecordStore: DeliveryRecordStore;
    discordClient: DiscordRestClient;
  }
): Promise<ArticleDeliveryState[]> {
  const { deliveryRecordStore, discordClient } = options;
  const allStates: ArticleDeliveryState[] = [];
  const allPayloads: EnqueuePayload[] = [];

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

  const limitState: LimitState = {
    remaining: feedLimitInfo.remaining,
    remainingInMedium: Number.MAX_SAFE_INTEGER,
  };

  for (const medium of mediums) {
    const mediumLimitInfo = await getUnderLimitCheck(
      deliveryRecordStore,
      { mediumId: medium.id },
      medium.rateLimits ?? []
    );

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

    for (const article of articles) {
      const { states, pendingPayloads } = await sendArticleToMedium(
        article,
        medium,
        limitState,
        options.feedId,
        options.feedUrl,
        options.discordClient
      );
      allStates.push(...states);
      allPayloads.push(...pendingPayloads);
    }
  }

  if (!isDeliveryPreviewMode()) {
    if (allStates.length > 0) {
      await deliveryRecordStore.store(options.feedId, allStates, true);
    }

    for (const payload of allPayloads) {
      await discordClient.enqueue(
        payload.url,
        payload.options,
        payload.meta as never
      );
    }
  }

  return allStates;
}
