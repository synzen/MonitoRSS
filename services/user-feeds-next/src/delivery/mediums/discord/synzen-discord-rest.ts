/**
 * Production Discord REST client using @synzen/discord-rest.
 *
 * This implementation uses:
 * - RESTProducer for async message enqueuing via RabbitMQ
 * - RESTHandler for synchronous Discord API calls
 */

import { RESTProducer, RESTHandler } from "@synzen/discord-rest";
import type {
  DiscordRestClient,
  DiscordEnqueueOptions,
  DiscordEnqueueMeta,
  DiscordEnqueueResult,
  DiscordApiRequestOptions,
  DiscordApiResponse,
} from "./discord-rest-client";
import { logger } from "../../../shared/utils";

// ============================================================================
// Configuration
// ============================================================================

export interface SynzenDiscordRestConfig {
  rabbitmqUri: string;
  clientId: string;
  botToken: string;
}

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a production Discord REST client using @synzen/discord-rest.
 *
 * The client must be initialized before use by calling `initialize()`.
 */
export function createSynzenDiscordRestClient(
  config: SynzenDiscordRestConfig
): DiscordRestClient & {
  initialize(): Promise<void>;
  close(): void;
} {
  const producer = new RESTProducer(config.rabbitmqUri, {
    clientId: config.clientId,
  });
  const handler = new RESTHandler();
  let initialized = false;

  return {
    async initialize(): Promise<void> {
      await producer.initialize();
      initialized = true;
      logger.info("Discord REST client initialized");
    },

    close(): void {
      initialized = false;
      logger.info("Discord REST client closed");
    },

    async enqueue(
      url: string,
      options: DiscordEnqueueOptions,
      meta: DiscordEnqueueMeta
    ): Promise<DiscordEnqueueResult> {
      if (!initialized) {
        throw new Error("Discord REST client not initialized");
      }

      // RESTProducer.enqueue is fire-and-forget (returns void).
      // Results come back via a separate callback queue.
      // We return a "pending" result to indicate the message was enqueued.
      await producer.enqueue(url, options, meta as unknown as Record<string, unknown>);

      return {
        state: "success",
        status: 0,
        body: {},
      };
    },

    async sendApiRequest(
      url: string,
      options: DiscordApiRequestOptions
    ): Promise<DiscordApiResponse> {
      const res = await handler.fetch(url, {
        method: options.method,
        body: JSON.stringify(options.body),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${config.botToken}`,
        },
      });

      const isOkStatus = res.status >= 200 && res.status < 300;

      try {
        return {
          success: true,
          status: res.status,
          body: (await res.json()) as Record<string, unknown>,
          detail: !isOkStatus ? `Bad status code: ${res.status}` : undefined,
        };
      } catch (err) {
        return {
          success: false,
          status: res.status,
          detail: (err as Error).message,
          body: {},
        };
      }
    },
  };
}

// ============================================================================
// URL Builders
// ============================================================================

export function getChannelApiUrl(channelId: string): string {
  return `${DISCORD_API_BASE_URL}/channels/${channelId}/messages`;
}

export function getWebhookApiUrl(
  webhookId: string,
  webhookToken: string,
  queries?: { threadId?: string | null }
): string {
  const urlQueries = new URLSearchParams();
  urlQueries.append("wait", "true");
  if (queries?.threadId) {
    urlQueries.append("thread_id", queries.threadId);
  }
  return `${DISCORD_API_BASE_URL}/webhooks/${webhookId}/${webhookToken}?${urlQueries.toString()}`;
}

export function getCreateChannelThreadUrl(channelId: string): string {
  return `${DISCORD_API_BASE_URL}/channels/${channelId}/threads`;
}

export function getCreateChannelMessageThreadUrl(
  channelId: string,
  messageId: string
): string {
  return `${DISCORD_API_BASE_URL}/channels/${channelId}/messages/${messageId}/threads`;
}
