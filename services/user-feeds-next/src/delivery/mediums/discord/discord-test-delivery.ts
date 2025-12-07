/**
 * Discord Test Delivery Service
 *
 * Handles test article delivery to Discord, matching user-feeds
 * discord-test-delivery.service.ts behavior.
 *
 * Unlike regular delivery, test delivery:
 * - Uses synchronous API calls (waits for response)
 * - Returns full Discord API response for status mapping
 * - Does not use message enqueue
 */

import type { Article } from "../../../article-parser";
import type { FilterExpressionReference } from "../../../article-filters";
import {
  generateDiscordPayloads,
  enhancePayloadsWithWebhookDetails,
  generateThreadName,
  buildForumThreadBody,
  getForumTagsToSend,
  type DiscordMessageApiPayload,
  type CustomPlaceholder,
  type PlaceholderLimit,
  type DiscordEmbed,
  type SplitOptions,
  type ActionRowInput,
  type ComponentV2Input,
  type MentionTarget,
  type ForumThreadTag,
} from "../../../article-formatter";
import {
  sendDiscordApiRequest,
  getChannelApiUrl,
  getWebhookApiUrl,
  getCreateChannelThreadUrl,
  getCreateChannelMessageThreadUrl,
  type DiscordApiResponse,
} from "../../delivery";
import { DiscordSendArticleOperationType } from "../../../constants";

// ============================================================================
// Types
// ============================================================================

export interface TestDiscordMediumDetails {
  guildId?: string;
  channel?: {
    id: string;
    type?: "forum" | "thread" | "new-thread" | "forum-thread" | null;
  } | null;
  webhook?: {
    id: string;
    token: string;
    name?: string;
    iconUrl?: string;
    type?: "forum" | "thread" | "forum-thread" | null;
    threadId?: string | null;
  } | null;
  content: string;
  embeds: DiscordEmbed[];
  formatter?: {
    stripImages?: boolean;
    formatTables?: boolean;
    disableImageLinkPreviews?: boolean;
    ignoreNewLines?: boolean;
  };
  customPlaceholders?: CustomPlaceholder[];
  mentions?: {
    targets?: MentionTarget[];
  } | null;
  splitOptions?: SplitOptions;
  placeholderLimits?: PlaceholderLimit[] | null;
  enablePlaceholderFallback?: boolean;
  components?: ActionRowInput[] | null;
  componentsV2?: ComponentV2Input[] | null;
  forumThreadTitle?: string | null;
  forumThreadTags?: ForumThreadTag[] | null;
  channelNewThreadTitle?: string | null;
  channelNewThreadExcludesPreview?: boolean | null;
}

export interface TestDiscordDeliveryDetails {
  mediumDetails: TestDiscordMediumDetails;
  filterReferences: FilterExpressionReference;
}

export interface SendTestArticleResult {
  operationType?: DiscordSendArticleOperationType;
  apiPayload: Record<string, unknown>;
  result: {
    status: number;
    state: "success" | "error";
    message: string;
    body: object;
  };
}

// ============================================================================
// Helpers
// ============================================================================

function getPayloadOptions(details: TestDiscordDeliveryDetails) {
  return {
    mentions: details.mediumDetails.mentions,
    placeholderLimits: details.mediumDetails.placeholderLimits ?? undefined,
    enablePlaceholderFallback: details.mediumDetails.enablePlaceholderFallback,
    components: details.mediumDetails.components ?? undefined,
    componentsV2: details.mediumDetails.componentsV2 ?? undefined,
  };
}

function generatePayloads(
  article: Article,
  details: TestDiscordDeliveryDetails
): DiscordMessageApiPayload[] {
  const { mediumDetails } = details;

  return generateDiscordPayloads(article, {
    content: mediumDetails.content,
    embeds: mediumDetails.embeds,
    splitOptions: mediumDetails.splitOptions,
    mentions: mediumDetails.mentions ?? undefined,
    placeholderLimits: mediumDetails.placeholderLimits ?? undefined,
    enablePlaceholderFallback: mediumDetails.enablePlaceholderFallback,
    components: mediumDetails.components ?? undefined,
    componentsV2: mediumDetails.componentsV2 ?? undefined,
    customPlaceholders: mediumDetails.customPlaceholders,
  });
}

// ============================================================================
// Forum Delivery
// ============================================================================

async function deliverTestToForum(
  article: Article,
  details: TestDiscordDeliveryDetails
): Promise<SendTestArticleResult> {
  const { mediumDetails, filterReferences } = details;
  const { channel, webhook, forumThreadTitle, forumThreadTags } = mediumDetails;
  const channelId = channel?.id;

  const apiUrl = channelId
    ? getCreateChannelThreadUrl(channelId)
    : webhook
      ? getWebhookApiUrl(webhook.id, webhook.token)
      : undefined;

  if (!apiUrl) {
    throw new Error("No channel or webhook specified for Discord forum");
  }

  const payloadOptions = getPayloadOptions(details);

  const threadName = generateThreadName(
    article,
    forumThreadTitle,
    payloadOptions
  );

  let bodies: DiscordMessageApiPayload[];
  let threadBody: Record<string, unknown>;

  if (channelId) {
    bodies = generatePayloads(article, details);

    threadBody = buildForumThreadBody({
      isWebhook: false,
      threadName,
      firstPayload: bodies[0]!,
      tags: getForumTagsToSend(forumThreadTags, article),
    });
  } else {
    const initialBodies = generatePayloads(article, details);

    bodies = enhancePayloadsWithWebhookDetails(
      article,
      initialBodies,
      webhook?.name,
      webhook?.iconUrl,
      payloadOptions
    );

    threadBody = buildForumThreadBody({
      isWebhook: true,
      threadName,
      firstPayload: bodies[0]!,
      tags: getForumTagsToSend(forumThreadTags, article),
    });
  }

  const firstResponse = await sendDiscordApiRequest(apiUrl, {
    method: "POST",
    body: threadBody,
  });

  if (!firstResponse.success) {
    throw new Error(
      `Failed to create initial thread for forum channel ${channelId}: ` +
        `${firstResponse.detail}. Body: ${JSON.stringify(firstResponse.body)}`
    );
  } else if (firstResponse.status !== 201) {
    return {
      apiPayload: threadBody,
      result: {
        status: firstResponse.status,
        state: "success",
        body: firstResponse.body,
        message: firstResponse.detail || "",
      },
    };
  }

  const threadId = (firstResponse.body as Record<string, unknown>).id as string;

  const threadChannelUrl = channelId
    ? getChannelApiUrl(threadId)
    : getWebhookApiUrl(webhook!.id, webhook!.token, { threadId });

  await Promise.all(
    bodies.slice(1).map((body) =>
      sendDiscordApiRequest(threadChannelUrl, {
        method: "POST",
        body,
      })
    )
  );

  return {
    apiPayload: threadBody,
    result: {
      status: firstResponse.status,
      state: firstResponse.success ? "success" : "error",
      body: firstResponse.body,
      message: firstResponse.detail || "",
    },
  };
}

// ============================================================================
// Webhook Delivery
// ============================================================================

async function deliverTestToWebhook(
  article: Article,
  details: TestDiscordDeliveryDetails
): Promise<SendTestArticleResult> {
  const { mediumDetails } = details;
  const { webhook } = mediumDetails;

  if (!webhook) {
    throw new Error("No webhook specified");
  }

  const apiUrl = getWebhookApiUrl(webhook.id, webhook.token, {
    threadId: webhook.threadId,
  });

  const payloadOptions = getPayloadOptions(details);

  const initialBodies = generatePayloads(article, details);

  const apiPayloads = enhancePayloadsWithWebhookDetails(
    article,
    initialBodies,
    webhook.name,
    webhook.iconUrl,
    payloadOptions
  );

  const results = await Promise.all(
    apiPayloads.map((payload) =>
      sendDiscordApiRequest(apiUrl, {
        method: "POST",
        body: payload,
      })
    )
  );

  return {
    apiPayload: apiPayloads[0] as Record<string, unknown>,
    result: {
      status: results[0]!.status,
      state: results[0]!.success ? "success" : "error",
      body: results[0]!.body,
      message: results[0]!.detail || "",
    },
  };
}

// ============================================================================
// Channel Delivery
// ============================================================================

async function deliverTestToChannel(
  article: Article,
  details: TestDiscordDeliveryDetails
): Promise<SendTestArticleResult> {
  const { mediumDetails } = details;
  const { channel, channelNewThreadTitle } = mediumDetails;

  if (!channel) {
    throw new Error("No channel specified");
  }

  const channelId = channel.id;
  const shouldCreateThread = channel.type === "new-thread";
  let useChannelId = channelId;

  const payloadOptions = getPayloadOptions(details);

  const apiPayloads = generatePayloads(article, details);
  let currentApiPayloadIndex = 0;

  const apiPayloadResults: DiscordApiResponse[] = [];

  if (shouldCreateThread) {
    const createThreadFirst = !!mediumDetails.channelNewThreadExcludesPreview;

    const threadName = generateThreadName(
      article,
      channelNewThreadTitle,
      payloadOptions
    );

    const threadBody = {
      name: threadName,
      type: 11, // PUBLIC_THREAD
    };

    if (!createThreadFirst) {
      // Send the post, create a thread, and then send the rest
      const apiUrl = getChannelApiUrl(channelId);
      const firstResponse = await sendDiscordApiRequest(apiUrl, {
        method: "POST",
        body: apiPayloads[0]!,
      });

      if (!firstResponse.success) {
        throw new Error(
          `Failed to create initial post for channel ${channelId}: ` +
            `${firstResponse.detail}. Body: ${JSON.stringify(firstResponse.body)}`
        );
      }

      const messageId = (firstResponse.body as Record<string, unknown>)
        .id as string;

      const messageThreadUrl = getCreateChannelMessageThreadUrl(
        channelId,
        messageId
      );

      const threadResponse = await sendDiscordApiRequest(messageThreadUrl, {
        method: "POST",
        body: threadBody,
      });

      if (!threadResponse.success) {
        throw new Error(
          `Failed to create thread for forum channel ${channelId}: ` +
            `${threadResponse.detail}. Body: ${JSON.stringify(threadResponse.body)}`
        );
      } else if (threadResponse.status !== 201) {
        return {
          operationType: DiscordSendArticleOperationType.CreateThreadOnMessage,
          apiPayload: threadBody,
          result: {
            status: threadResponse.status,
            state: "success",
            body: threadResponse.body,
            message: threadResponse.detail || "",
          },
        };
      }

      useChannelId = (threadResponse.body as Record<string, unknown>)
        .id as string;

      currentApiPayloadIndex = 1;
      apiPayloadResults.push(firstResponse);
    } else {
      // Create a thread and then send all the posts
      const apiUrl = getCreateChannelThreadUrl(channelId);
      const firstResponse = await sendDiscordApiRequest(apiUrl, {
        method: "POST",
        body: threadBody,
      });

      if (!firstResponse.success) {
        throw new Error(
          `Failed to create initial thread for channel ${channelId}: ` +
            `${firstResponse.detail}. Body: ${JSON.stringify(firstResponse.body)}`
        );
      } else if (firstResponse.status !== 201) {
        return {
          apiPayload: threadBody,
          result: {
            status: firstResponse.status,
            state: "success",
            body: firstResponse.body,
            message: firstResponse.detail || "",
          },
        };
      }

      useChannelId = (firstResponse.body as Record<string, unknown>)
        .id as string;
    }
  }

  const apiUrl = getChannelApiUrl(useChannelId);

  for (const payload of apiPayloads.slice(currentApiPayloadIndex)) {
    const result = await sendDiscordApiRequest(apiUrl, {
      method: "POST",
      body: payload,
    });
    apiPayloadResults.push(result);
  }

  return {
    apiPayload: apiPayloads[0] as Record<string, unknown>,
    result: {
      status: apiPayloadResults[0]!.status,
      state: apiPayloadResults[0]!.success ? "success" : "error",
      body: apiPayloadResults[0]!.body,
      message: apiPayloadResults[0]!.detail || "",
    },
  };
}

// ============================================================================
// Main Router
// ============================================================================

/**
 * Deliver a test article to Discord.
 * Routes to the appropriate delivery method based on channel/webhook configuration.
 */
export async function deliverTestArticle(
  article: Article,
  details: TestDiscordDeliveryDetails
): Promise<SendTestArticleResult> {
  const { channel, webhook } = details.mediumDetails;
  const channelId = channel?.id;
  const isForum = channel?.type === "forum" || webhook?.type === "forum";

  if (isForum) {
    return deliverTestToForum(article, details);
  } else if (webhook) {
    return deliverTestToWebhook(article, details);
  } else if (channelId) {
    return deliverTestToChannel(article, details);
  } else {
    throw new Error("No channel or webhook specified for Discord medium");
  }
}
