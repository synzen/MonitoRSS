/**
 * Discord API client for synchronous API calls.
 * Used for forum thread creation where we must wait for the response.
 *
 * Matches the pattern from user-feeds discord-api-client.service.ts.
 */

import { RESTHandler } from "@synzen/discord-rest";

// ============================================================================
// State
// ============================================================================

let discordHandler: RESTHandler | null = null;
let discordBotToken: string | null = null;

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";

// ============================================================================
// Response Types
// ============================================================================

export interface DiscordApiResponse {
  success: boolean;
  status: number;
  body: Record<string, unknown>;
  detail?: string;
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the Discord REST handler for synchronous API calls.
 * This is needed for forum thread creation where we must wait for the response.
 */
export function initializeDiscordApiClient(botToken: string): void {
  discordBotToken = botToken;
  discordHandler = new RESTHandler();
  console.log("Discord REST handler initialized");
}

export function closeDiscordApiClient(): void {
  discordHandler = null;
  discordBotToken = null;
}

export function isDiscordApiClientInitialized(): boolean {
  return discordHandler !== null && discordBotToken !== null;
}

// ============================================================================
// URL Builders (matching discord-api-client.service.ts)
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

// ============================================================================
// API Request (synchronous - for thread creation)
// ============================================================================

/**
 * Send a synchronous request to the Discord API.
 * Used for forum thread creation where we need the response before continuing.
 */
export async function sendDiscordApiRequest(
  url: string,
  { method, body }: { method: "POST"; body: object }
): Promise<DiscordApiResponse> {
  if (!discordHandler || !discordBotToken) {
    throw new Error("Discord API client not initialized");
  }

  const res = await discordHandler.fetch(url, {
    method,
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${discordBotToken}`,
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
}
