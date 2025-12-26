export {
  deliverArticles,
  getUnderLimitCheck,
  processDeliveryResult,
  getChannelApiUrl,
  getWebhookApiUrl,
  getCreateChannelThreadUrl,
  getCreateChannelMessageThreadUrl,
  ArticleDeliveryStatus,
  ArticleDeliveryErrorCode,
  ArticleDeliveryContentType,
  ArticleDeliveryRejectedCode,
  recordRateLimitDiagnostic,
  recordMediumFilterDiagnostic,
  type LimitState,
  type DiscordDeliveryResult,
  type ProcessedDeliveryResult,
  type DeliveryJobMeta,
  type MediumRateLimit,
  type DeliveryMedium,
  type MediumBadFormatEvent,
  type MediumMissingPermissionsEvent,
  type MediumNotFoundEvent,
  type MediumRejectionEvent,
  type EnqueueMessagesOptions,
  type RateLimitDiagnosticParams,
  type MediumFilterDiagnosticParams,
} from "./delivery";

// Re-export Discord REST client types and factories
export {
  type DiscordRestClient,
  type DiscordApiResponse,
  type DiscordEnqueueOptions,
  type DiscordEnqueueMeta,
  type DiscordEnqueueResult,
  type DiscordApiRequestOptions,
  type TestDiscordRestClient,
  type CapturedDiscordPayload,
  createTestDiscordRestClient,
  createInMemoryDiscordRestClient,
  inMemoryDiscordRestClient,
} from "./mediums/discord/discord-rest-client";

// Re-export production Discord REST client factory
export {
  createSynzenDiscordRestClient,
  type SynzenDiscordRestConfig,
} from "./mediums/discord/synzen-discord-rest";

// Re-export organized discord module for future use
export * as discordMedium from "./mediums/discord";

// Re-export shared types
export type { DeliverArticleContext } from "./types";
