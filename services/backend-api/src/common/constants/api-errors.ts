export enum ApiErrorCode {
  INTERNAL_ERROR = "INTERNAL_ERROR",
  FEED_INVALID = "FEED_INVALID",
  FEED_PARSE_FAILED = "FEED_PARSE_FAILED",
  FEED_PARSE_TIMEOUT = "FEED_PARSE_TIMEOUT",
  FEED_REQUEST_TIMEOUT = "FEED_REQUEST_TIMEOUT",
  FEED_REQUEST_FAILED = "FEED_REQUEST_FAILED",
  FEED_REQUEST_FORBIDDEN = "FEED_REQUEST_FORBIDDEN",
  FEED_REQUEST_INTERNAL_ERROR = "FEED_REQUEST_INTERNAL_ERROR",
  FEED_REQUEST_TOO_MANY_REQUESTS = "FEED_REQUEST_TOO_MANY_REQUESTS",
  FEED_REQUEST_UNAUTHORIZED = "FEED_REQUEST_UNAUTHORIZED",
  FEED_CONNECTION_NOT_FOUND = "FEED_CONNECTION_NOT_FOUND",
  WEBHOOKS_MANAGE_MISSING_PERMISSIONS = "WEBHOOKS_MANAGE_MISSING_PERMISSIONS",
  WEBHOOKS_DISABLED = "WEBHOOKS_DISABLED",
  WEBHOOK_MISSING = "WEBHOOK_MISSING",
  WEBHOOK_INVALID = "WEBHOOK_INVALID",
  FEED_MISSING_CHANNEL_PERMISSION = "FEED_MISSING_CHANNEL_PERMISSION",
  FEED_MISSING_CHANNEL = "FEED_MISSING_CHANNEL",
  FEED_USER_MISSING_MANAGE_GUILD = "FEED_USER_MISSING_MANAGE_GUILD",
  FEED_LIMIT_REACHED = "FEED_LIMIT_REACHED",
  FEED_NOT_FAILED = "FEED_NOT_FAILED",
  FEED_NOT_FOUND = "FEED_NOT_FOUND",
  FEED_INVALID_FILTER_EXPRESSION = "FEED_INVALID_FILTER_EXPRESSION",
  BANNED_FEED = "BANNED_FEED",
  DISCORD_CHANNEL_NOT_OWNED_BY_GUILD = "DISCORD_CHANNEL_NOT_OWNED_BY_GUILD",
  FEED_CONNECTION_CANNOT_ENABLE_AUTO_DISABLED = "FEED_CONNECTION_CANNOT_ENABLE_AUTO_DISABLED",
}

// Create a package for the frontend?

export const API_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  FEED_INVALID: "Invalid feed",
  FEED_PARSE_FAILED: "Failed to parse feed",
  FEED_PARSE_TIMEOUT: "Failed to parse feed due to timeout",
  FEED_REQUEST_TIMEOUT: "Failed to request feed due to timeout",
  FEED_REQUEST_FAILED: "Failed to request feed",
  INTERNAL_ERROR: "Internal error",
  FEED_REQUEST_FORBIDDEN: "Request to feed failed (403 code)",
  FEED_REQUEST_INTERNAL_ERROR: "Request to feed failed (5xx code)",
  FEED_REQUEST_TOO_MANY_REQUESTS: "Request to feed failed (429 code)",
  FEED_REQUEST_UNAUTHORIZED: "Request to feed failed (401 code)",
  FEED_CONNECTION_NOT_FOUND: "Feed connection was not found",
  WEBHOOKS_MANAGE_MISSING_PERMISSIONS:
    "Bot is missing Manage Webhooks permission",
  WEBHOOKS_DISABLED: "Webhooks are not enabled",
  WEBHOOK_MISSING: "Specified webhook does not exist",
  WEBHOOK_INVALID:
    'Specified webhook is invalid. Must be of type "Incoming Webhook"' +
    " that has not been created by another application",
  FEED_MISSING_CHANNEL: "Channel does not exist",
  FEED_MISSING_CHANNEL_PERMISSION: "Insufficient bot permissions in channel",
  FEED_USER_MISSING_MANAGE_GUILD: "User is missing Manage Server permission",
  FEED_LIMIT_REACHED: "Feed limit reached",
  BANNED_FEED: "Feed is banned",
  DISCORD_CHANNEL_NOT_OWNED_BY_GUILD:
    "Channel is not owned by the current guild",
  FEED_NOT_FAILED:
    "The feed is not in a failed state. It must be in a failed state for it to be retried.",
  FEED_NOT_FOUND: "Feed does not exist",
  FEED_INVALID_FILTER_EXPRESSION: "Invalid filter expression",
  FEED_CONNECTION_CANNOT_ENABLE_AUTO_DISABLED:
    "Cannot enable a feed that was automatically disabled",
};
