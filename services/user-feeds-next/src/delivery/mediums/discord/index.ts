/**
 * Discord Medium Module
 *
 * Exports all Discord-specific delivery functionality.
 */

// API Client
export {
  initializeDiscordApiClient,
  closeDiscordApiClient,
  sendDiscordApiRequest,
  getChannelApiUrl,
  getWebhookApiUrl,
  getCreateChannelThreadUrl,
  getCreateChannelMessageThreadUrl,
  type DiscordApiResponse,
} from "./discord-api-client";

// Message Enqueue
export {
  initializeDiscordProducer,
  closeDiscordProducer,
  enqueueMessages,
  type EnqueueMessagesOptions,
} from "./discord-message-enqueue";

// Delivery Result Parsing
export { parseThreadCreateResponseToDeliveryStates } from "./discord-delivery-result";

// Discord Medium (main delivery facade)
export {
  deliverToWebhookForum,
  deliverToChannelForum,
  deliverToChannel,
  deliverToWebhook,
  deliverToDiscord,
} from "./discord-medium";

// Re-export context type
export type { DeliverArticleContext } from "./discord-medium";
