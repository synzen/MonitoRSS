/**
 * Discord message enqueue service.
 * Enqueues messages to Discord via RabbitMQ REST producer.
 *
 * Matches the pattern from user-feeds discord-message-enqueue.service.ts.
 */

import { RESTProducer } from "@synzen/discord-rest";
import type { Article } from "../../../articles/parser";
import type { DiscordMessageApiPayload } from "../../../articles/formatter";
import {
  ArticleDeliveryStatus,
  ArticleDeliveryContentType,
  type ArticleDeliveryState,
  generateDeliveryId,
} from "../../../stores/interfaces/delivery-record-store";

// ============================================================================
// State
// ============================================================================

let discordProducer: RESTProducer | null = null;

// ============================================================================
// Initialization
// ============================================================================

export async function initializeDiscordProducer(options: {
  rabbitmqUri: string;
  clientId: string;
}): Promise<void> {
  discordProducer = new RESTProducer(options.rabbitmqUri, {
    clientId: options.clientId,
  });
  await discordProducer.initialize();
}

export async function closeDiscordProducer(): Promise<void> {
  // RESTProducer doesn't have a close method, but we can null it out
  discordProducer = null;
}

export function isDiscordProducerInitialized(): boolean {
  return discordProducer !== null;
}

// ============================================================================
// Enqueue Options
// ============================================================================

export interface EnqueueMessagesOptions {
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

// ============================================================================
// Message Enqueuing
// ============================================================================

/**
 * Enqueue messages to Discord via the REST producer.
 * Returns PendingDelivery states for all messages.
 * Matches discord-message-enqueue.service.ts enqueueMessages.
 */
export async function enqueueMessages(
  options: EnqueueMessagesOptions
): Promise<ArticleDeliveryState[]> {
  if (!discordProducer) {
    throw new Error("Discord producer not initialized");
  }

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

  const deliveryStates: ArticleDeliveryState[] = [];
  const parentDeliveryId = existingParentId || generateDeliveryId();

  for (let idx = 0; idx < bodies.length; idx++) {
    const body = bodies[idx];
    const isFirst = idx === 0 && !existingParentId;
    const deliveryId = isFirst ? parentDeliveryId : generateDeliveryId();

    await discordProducer.enqueue(
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
