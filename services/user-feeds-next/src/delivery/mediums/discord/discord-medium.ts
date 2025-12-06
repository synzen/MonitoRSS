/**
 * Discord Medium Service
 *
 * Provides delivery functions for sending articles to Discord destinations.
 * Matches user-feeds discord-medium.service.ts patterns.
 *
 * This module serves as a facade that combines:
 * - discord-api-client.ts (synchronous API calls)
 * - discord-message-enqueue.ts (async message enqueue)
 * - discord-delivery-result.ts (response parsing)
 *
 * Payload generation remains in article-formatter.ts as it's a formatting concern.
 */

import type { Article } from "../../../article-parser";
import {
  generateDiscordPayloads,
  enhancePayloadsWithWebhookDetails,
  generateThreadName,
  buildForumThreadBody,
  getForumTagsToSend,
  type DiscordMessageApiPayload,
} from "../../../article-formatter";
import {
  ArticleDeliveryContentType,
  ArticleDeliveryErrorCode,
  ArticleDeliveryStatus,
  generateDeliveryId,
  type ArticleDeliveryState,
} from "../../../delivery-record-store";
import type { DeliveryMedium, DeliverArticleContext } from "../../types";
import {
  sendDiscordApiRequest,
  getChannelApiUrl,
  getWebhookApiUrl,
  getCreateChannelThreadUrl,
  getCreateChannelMessageThreadUrl,
} from "./discord-api-client";
import { enqueueMessages } from "./discord-message-enqueue";
import { parseThreadCreateResponseToDeliveryStates } from "./discord-delivery-result";

// Re-export context type for convenience
export type { DeliverArticleContext };

// ============================================================================
// Payload Generation Helper
// ============================================================================

function generatePayloadsForMedium(
  article: Article,
  medium: DeliveryMedium
): DiscordMessageApiPayload[] {
  return generateDiscordPayloads(article, {
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
      fields: e.fields?.map((f) => ({
        name: f.name,
        value: f.value,
        inline: f.inline,
      })),
      timestamp: e.timestamp ?? undefined,
    })),
    splitOptions: medium.details.splitOptions ?? undefined,
    placeholderLimits: medium.details.placeholderLimits ?? undefined,
    enablePlaceholderFallback: medium.details.enablePlaceholderFallback,
    mentions: medium.details.mentions ?? undefined,
    customPlaceholders: medium.details.customPlaceholders?.map((cp) => ({
      ...cp,
      steps: cp.steps.map((s) => ({ ...s, type: s.type as never })),
    })),
    components:
      medium.details.components?.map((row) => ({
        type: row.type,
        components: row.components.map((btn) => ({
          type: btn.type,
          style: btn.style,
          label: btn.label,
          emoji: btn.emoji,
          url: btn.url,
        })),
      })) ?? undefined,
    componentsV2: medium.details.componentsV2 as never,
  });
}

function getPayloadOptions(medium: DeliveryMedium) {
  return {
    enablePlaceholderFallback: medium.details.enablePlaceholderFallback,
    customPlaceholders: medium.details.customPlaceholders?.map((cp) => ({
      ...cp,
      steps: cp.steps.map((s) => ({ ...s, type: s.type as never })),
    })),
  };
}

// ============================================================================
// Webhook Forum Delivery
// ============================================================================

/**
 * Deliver article to a webhook forum channel.
 * Matches discord-medium.service.ts deliverArticleToWebhookForum.
 */
export async function deliverToWebhookForum(
  article: Article,
  medium: DeliveryMedium,
  context: DeliverArticleContext
): Promise<ArticleDeliveryState[]> {
  const { webhook } = medium.details;
  if (!webhook) {
    throw new Error("Webhook required for webhook forum delivery");
  }

  const apiUrl = getWebhookApiUrl(webhook.id, webhook.token);
  const payloadOptions = getPayloadOptions(medium);
  const initialBodies = generatePayloadsForMedium(article, medium);

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

  const res = await sendDiscordApiRequest(apiUrl, {
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
    apiUrl: channelApiUrl,
    bodies: bodies.slice(1),
    article,
    mediumId: context.mediumId,
    feedId: context.feedId,
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

// ============================================================================
// Channel Forum Delivery
// ============================================================================

/**
 * Deliver article to a channel forum.
 * Matches discord-medium.service.ts deliverArticleToChannelForum.
 */
export async function deliverToChannelForum(
  article: Article,
  medium: DeliveryMedium,
  context: DeliverArticleContext
): Promise<ArticleDeliveryState[]> {
  const { channel } = medium.details;
  if (!channel) {
    throw new Error("Channel required for channel forum delivery");
  }

  const forumApiUrl = getCreateChannelThreadUrl(channel.id);
  const payloadOptions = getPayloadOptions(medium);
  const bodies = generatePayloadsForMedium(article, medium);

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

  const res = await sendDiscordApiRequest(forumApiUrl, {
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
    apiUrl: channelApiUrl,
    bodies: bodies.slice(1),
    article,
    mediumId: context.mediumId,
    feedId: context.feedId,
    guildId: context.guildId,
    channelId: threadId,
    parentDeliveryId,
  });

  return [...threadCreationDeliveryStates, ...additionalDeliveryStates];
}

// ============================================================================
// Channel Delivery (with new-thread support)
// ============================================================================

/**
 * Deliver article to a regular channel.
 * Matches discord-medium.service.ts deliverArticleToChannel.
 * Supports new-thread creation with or without preview.
 */
export async function deliverToChannel(
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

  const payloadOptions = getPayloadOptions(medium);
  const bodies = generatePayloadsForMedium(article, medium);
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
      const firstResponse = await sendDiscordApiRequest(apiUrl, {
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
      const firstPostResponse = await sendDiscordApiRequest(apiUrl, {
        method: "POST",
        body: firstBody,
      });

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

      const threadResponse = await sendDiscordApiRequest(messageThreadUrl, {
        method: "POST",
        body: threadBody,
      });

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
    apiUrl,
    bodies: bodies.slice(currentBodiesIndex),
    article,
    mediumId: context.mediumId,
    feedId: context.feedId,
    guildId: context.guildId,
    channelId: useChannelId,
    parentDeliveryId: parentDeliveryId || undefined,
  });

  return [...threadCreationDeliveryStates, ...allRecords];
}

// ============================================================================
// Webhook Delivery
// ============================================================================

/**
 * Deliver article to a webhook.
 * Matches discord-medium.service.ts deliverArticleToWebhook.
 */
export async function deliverToWebhook(
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

  const payloadOptions = getPayloadOptions(medium);
  const initialBodies = generatePayloadsForMedium(article, medium);

  const bodies = enhancePayloadsWithWebhookDetails(
    article,
    initialBodies,
    webhook.name,
    webhook.iconUrl,
    payloadOptions
  );

  const deliveryStates = await enqueueMessages({
    apiUrl,
    bodies,
    article,
    mediumId: context.mediumId,
    feedId: context.feedId,
    guildId: context.guildId,
    webhookId: webhook.id,
  });

  return deliveryStates;
}

// ============================================================================
// Main Delivery Router
// ============================================================================

/**
 * Deliver article to Discord, automatically selecting the appropriate method.
 * Matches discord-medium.service.ts deliverArticle routing logic.
 *
 * @param article - The article to deliver
 * @param medium - The medium configuration
 * @param context - Delivery context with IDs
 * @returns Array of delivery states
 */
export async function deliverToDiscord(
  article: Article,
  medium: DeliveryMedium,
  context: DeliverArticleContext
): Promise<ArticleDeliveryState[]> {
  const { channel, webhook } = medium.details;

  if (!channel && !webhook) {
    return [
      {
        id: generateDeliveryId(),
        mediumId: context.mediumId,
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
        internalMessage: "No channel or webhook specified",
        articleIdHash: article.flattened.idHash,
        article,
      },
    ];
  }

  try {
    if (webhook) {
      if (webhook.type === "forum") {
        return await deliverToWebhookForum(article, medium, context);
      }
      return await deliverToWebhook(article, medium, context);
    }

    if (channel) {
      if (channel.type === "forum") {
        return await deliverToChannelForum(article, medium, context);
      }
      return await deliverToChannel(article, medium, context);
    }

    // This should never happen due to the check above
    return [
      {
        id: generateDeliveryId(),
        mediumId: context.mediumId,
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
        internalMessage: "No channel or webhook specified",
        articleIdHash: article.flattened.idHash,
        article,
      },
    ];
  } catch (err) {
    return [
      {
        id: generateDeliveryId(),
        mediumId: context.mediumId,
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.Internal,
        internalMessage: (err as Error).message,
        articleIdHash: article.flattened.idHash,
        article,
      },
    ];
  }
}
