/**
 * Discord Medium Module
 *
 * Exports all Discord-specific delivery functionality.
 */

// URL builders are exported from synzen-discord-rest
export {
  getChannelApiUrl,
  getWebhookApiUrl,
  getCreateChannelThreadUrl,
  getCreateChannelMessageThreadUrl,
  createSynzenDiscordRestClient,
  type SynzenDiscordRestConfig,
} from "./synzen-discord-rest";

// Re-export Discord REST client types
export {
  type DiscordRestClient,
  type DiscordApiResponse,
  type DiscordEnqueueOptions,
  type DiscordEnqueueMeta,
  type DiscordEnqueueResult,
  type DiscordApiRequestOptions,
  createTestDiscordRestClient,
} from "./discord-rest-client";
