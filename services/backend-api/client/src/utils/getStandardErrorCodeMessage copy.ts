import i18n from "./i18n";

const { t } = i18n;

export enum ApiErrorCode {
  INTERNAL_ERROR = "INTERNAL_ERROR",
  FEED_INVALID = "FEED_INVALID",
  FEED_PARSE_FAILED = "FEED_PARSE_FAILED",
  FEED_FETCH_FAILED = "FEED_FETCH_FAILED",
  ADD_FEED_PARSE_FAILED = "ADD_FEED_PARSE_FAILED",
  NO_FEED_IN_HTML_PAGE = "NO_FEED_IN_HTML_PAGE",
  FEED_PARSE_TIMEOUT = "FEED_PARSE_TIMEOUT",
  FEED_REQUEST_TIMEOUT = "FEED_REQUEST_TIMEOUT",
  FEED_REQUEST_FAILED = "FEED_REQUEST_FAILED",
  FEED_REQUEST_FORBIDDEN = "FEED_REQUEST_FORBIDDEN",
  FEED_REQUEST_INTERNAL_ERROR = "FEED_REQUEST_INTERNAL_ERROR",
  FEED_REQUEST_TOO_MANY_REQUESTS = "FEED_REQUEST_TOO_MANY_REQUESTS",
  FEED_REQUEST_UNAUTHORIZED = "FEED_REQUEST_UNAUTHORIZED",
  WEBHOOKS_MANAGE_MISSING_PERMISSIONS = "WEBHOOKS_MANAGE_MISSING_PERMISSIONS",
  WEBHOOK_INVALID = "WEBHOOK_INVALID",
  FEED_MISSING_CHANNEL_PERMISSION = "FEED_MISSING_CHANNEL_PERMISSION",
  FEED_MISSING_VIEW_CHANNEL_PERMISSION = "FEED_MISSING_VIEW_CHANNEL_PERMISSION",
  FEED_MISSING_CHANNEL = "FEED_MISSING_CHANNEL",
  FEED_USER_MISSING_MANAGE_GUILD = "FEED_USER_MISSING_MANAGE_GUILD",
  FEED_LIMIT_REACHED = "FEED_LIMIT_REACHED",
  BANNED_FEED = "BANNED_FEED",
  FEED_NOT_FAILED = "FEED_NOT_FAILED",
  FEED_NOT_FOUND = "FEED_NOT_FOUND",
  FEED_TOO_LARGE = "FEED_TOO_LARGE",
  FEED_INVALID_FILTER_EXPRESSION = "FEED_INVALID_FILTER_EXPRESSION",
  FEED_CONNECTION_CANNOT_ENABLE_AUTO_DISABLED = "FEED_CONNECTION_CANNOT_ENABLE_AUTO_DISABLED",
  FEED_ARTICLE_NOT_FOUND = "FEED_ARTICLE_NOT_FOUND",
  DISCORD_SERVER_NOT_FOUND = "DISCORD_SERVER_NOT_FOUND",
  DISCORD_CAHNNEL_INVALID = "DISCORD_CAHNNEL_INVALID",
  WEBHOOK_FORUM_UNSUPPORTED = "WEBHOOK_FORUM_UNSUPPORTED",
  USER_FEED_LIMIT_REACHED = "USER_FEED_LIMIT_REACHED",
  ALREADY_CONVERTED_TO_USER_FEED = "ALREADY_CONVERTED_TO_USER_FEED",
  HANDLED_BY_BULK_CONVERSION = "HANDLED_BY_BULK_CONVERSION",
  MISSING_SHARED_MANAGER_PERMISSIONS = "MISSING_SHARED_MANAGER_PERMISSIONS",
  USER_MANAGER_ALREADY_INVITED = "USER_MANAGER_ALREADY_INVITED",
  USER_FEED_TRANSFER_REQUEST_EXISTS = "USER_FEED_TRANSFER_REQUEST_EXISTS",
  INSUFFICIENT_SUPPORTER_LEVEL = "INSUFFICIENT_SUPPORTER_LEVEL",
  INVALID_CUSTOM_PLACEHOLDERS_REGEX_PREVIEW_INPUT = "INVALID_CUSTOM_PLACEHOLDERS_REGEX_PREVIEW_INPUT",
  INVALID_FILTERS_REGEX = "INVALID_FILTERS_REGEX",
  FEED_INVALID_SSL_CERT = "FEED_INVALID_SSL_CERT",
  ADD_FEED_WITH_SOURCE_FEED_NOT_FOUND = "ADD_FEED_WITH_SOURCE_FEED_NOT_FOUND",
  TRANSACTION_BALANCE_TOO_LOW = "TRANSACTION_BALANCE_TOO_LOW",
  SUBSCRIPTION_ABOUT_TO_RENEW = "SUBSCRIPTION_ABOUT_TO_RENEW",
  USER_REFRESH_RATE_NOT_ALLOWED = "USER_REFRESH_RATE_NOT_ALLOWED",
}

const ERROR_CODE_MESSAGES: Record<ApiErrorCode, string> = {
  FEED_INVALID: t("common.apiErrors.feedInvalid"),
  FEED_PARSE_FAILED: t("common.apiErrors.feedParseFailed"),
  FEED_FETCH_FAILED: t("common.apiErrors.feedRequestFailed"),
  ADD_FEED_PARSE_FAILED:
    "Failed to parse feed. Ensure the feed URL is a valid RSS feed, or that it has an associated RSS feed.",
  NO_FEED_IN_HTML_PAGE:
    "Failed to find an associated RSS feed. Ensure the link has an associated RSS feed, or directly input the RSS feed URL.",
  FEED_PARSE_TIMEOUT: t("common.apiErrors.feedParseTimeout"),
  FEED_REQUEST_TIMEOUT: t("common.apiErrors.feedRequestTimeout"),
  FEED_REQUEST_FAILED: t("common.apiErrors.feedRequestFailed"),
  FEED_REQUEST_FORBIDDEN: t("common.apiErrors.feedRequestForbidden"),
  FEED_REQUEST_INTERNAL_ERROR: t("common.apiErrors.feedRequestInternalError"),
  FEED_REQUEST_TOO_MANY_REQUESTS: t("common.apiErrors.feedRequestTooManyRequests"),
  FEED_REQUEST_UNAUTHORIZED: t("common.apiErrors.feedRequestUnauthorized"),
  WEBHOOKS_MANAGE_MISSING_PERMISSIONS: t("common.apiErrors.webhooksManageMissingPermissions"),
  WEBHOOK_INVALID: t("common.apiErrors.webhookInvalid"),
  BANNED_FEED: t("common.apiErrors.bannedFeed"),
  FEED_MISSING_CHANNEL_PERMISSION: t("common.apiErrors.feedMissingChannelPermission"),
  FEED_MISSING_VIEW_CHANNEL_PERMISSION:
    'The bot does not have permission to view the channel. Ensure that the bot has the channel-level "View Channel" permission and try again.',
  FEED_LIMIT_REACHED: t("common.apiErrors.feedLimitReached"),
  FEED_MISSING_CHANNEL: t("common.apiErrors.feedMissingChannel"),
  FEED_USER_MISSING_MANAGE_GUILD: t("common.apiErrors.feedUserMissingManageGuild"),
  INTERNAL_ERROR:
    "Something went wrong. Please try again later, or contact support@monitorss.xyz if the issue persists.",
  FEED_NOT_FAILED: t("common.apiErrors.feedNotFailed"),
  FEED_NOT_FOUND: t("common.apiErrors.feedNotFound"),
  FEED_TOO_LARGE: "Feed is too large (larger than 3 MB) to be processed",
  FEED_INVALID_FILTER_EXPRESSION: t("common.apiErrors.feedFilterInvalidExpression"),
  FEED_CONNECTION_CANNOT_ENABLE_AUTO_DISABLED: t(
    "common.apiErrors.feedConnectionCannotEnableAutoDisabled"
  ),
  FEED_ARTICLE_NOT_FOUND: t("common.apiErrors.feedArticleNotFound"),
  DISCORD_SERVER_NOT_FOUND: t("common.apiErrors.discordServerNotFound"),
  DISCORD_CAHNNEL_INVALID: t("common.apiErrors.discordChannelInvalid"),
  WEBHOOK_FORUM_UNSUPPORTED: t("common.apiErrors.webhookForumUnsupported"),
  USER_FEED_LIMIT_REACHED: "You have reached the maximum number of personal feeds you can create",
  ALREADY_CONVERTED_TO_USER_FEED: "This feed has already been converted to a user feed",
  HANDLED_BY_BULK_CONVERSION: "This feed is being handled by the bulk conversion process",
  MISSING_SHARED_MANAGER_PERMISSIONS: "You do not have permission to do this",
  USER_MANAGER_ALREADY_INVITED: "You have already invited this user to manage this feed",
  USER_FEED_TRANSFER_REQUEST_EXISTS:
    "You already have a feed ownership transfer invite for this feed.",
  INSUFFICIENT_SUPPORTER_LEVEL: "You must be a paid supporter of the proper tier to access this.",
  INVALID_CUSTOM_PLACEHOLDERS_REGEX_PREVIEW_INPUT:
    "Invalid regex search preview input for custom placeholders",
  INVALID_FILTERS_REGEX: "Invalid regex for filters",
  FEED_INVALID_SSL_CERT:
    "Feed host has invalid SSL certificate. Please contact the feed site for them to correct their certificate.",
  ADD_FEED_WITH_SOURCE_FEED_NOT_FOUND:
    "Source feed to copy settings from was not found. Ensure the source feed exists and you have permission to view it.",
  TRANSACTION_BALANCE_TOO_LOW:
    "A minimum of $0.70 USD is required for a transaction whose total (including prorated credit for time remaining on the current tier) is greater than $0.00. Try again by either increasing your tier or waiting until the end of your billing period.",
  SUBSCRIPTION_ABOUT_TO_RENEW:
    "Cannot update subscription when renewal is within the next 30 minutes. Try again later.",
  USER_REFRESH_RATE_NOT_ALLOWED: "Refresh rate is not allowed.",
};

export const getStandardErrorCodeMessage = (code: ApiErrorCode) => {
  const mappedError = ERROR_CODE_MESSAGES[code];

  if (!mappedError) {
    return `${t(
      "common.errors.somethingWentWrong"
    )} Please try again later, or contact support@monitorss.xyz if the issue persists.`;
  }

  return mappedError;
};
