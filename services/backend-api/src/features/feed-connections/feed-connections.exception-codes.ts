import { ApiErrorCode } from "../../shared/constants/api-errors";
import type { ExceptionErrorCodes } from "../../shared/filters/exception-filter";

export const SEND_TEST_ARTICLE_EXCEPTION_ERROR_CODES: ExceptionErrorCodes = {
  FeedConnectionNotFoundException: {
    status: 404,
    code: ApiErrorCode.FEED_CONNECTION_NOT_FOUND,
  },
  FeedArticleNotFoundException: {
    status: 404,
    code: ApiErrorCode.FEED_ARTICLE_NOT_FOUND,
  },
  InvalidPreviewCustomPlaceholdersRegexException: {
    status: 422,
    code: ApiErrorCode.INVALID_CUSTOM_PLACEHOLDERS_REGEX_PREVIEW_INPUT,
  },
  InvalidFiltersRegexException: {
    status: 422,
    code: ApiErrorCode.INVALID_FILTERS_REGEX,
  },
  InvalidComponentsV2Exception: {
    status: 400,
    code: ApiErrorCode.FEED_INVALID_COMPONENTS_V2,
  },
  MissingChannelException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_CHANNEL,
  },
};

export const CREATE_PREVIEW_EXCEPTION_ERROR_CODES: ExceptionErrorCodes = {
  FeedConnectionNotFoundException: {
    status: 404,
    code: ApiErrorCode.FEED_CONNECTION_NOT_FOUND,
  },
  FeedArticleNotFoundException: {
    status: 404,
    code: ApiErrorCode.FEED_ARTICLE_NOT_FOUND,
  },
  InvalidPreviewCustomPlaceholdersRegexException: {
    status: 422,
    code: ApiErrorCode.INVALID_CUSTOM_PLACEHOLDERS_REGEX_PREVIEW_INPUT,
  },
  InvalidFiltersRegexException: {
    status: 422,
    code: ApiErrorCode.INVALID_FILTERS_REGEX,
  },
  InvalidComponentsV2Exception: {
    status: 400,
    code: ApiErrorCode.FEED_INVALID_COMPONENTS_V2,
  },
  MissingChannelException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_CHANNEL,
  },
};

export const COPY_CONNECTION_SETTINGS_EXCEPTION_ERROR_CODES: ExceptionErrorCodes =
  {};

export const CREATE_TEMPLATE_PREVIEW_EXCEPTION_ERROR_CODES: ExceptionErrorCodes =
  {
    FeedArticleNotFoundException: {
      status: 404,
      code: ApiErrorCode.FEED_ARTICLE_NOT_FOUND,
    },
    InvalidComponentsV2Exception: {
      status: 400,
      code: ApiErrorCode.FEED_INVALID_COMPONENTS_V2,
    },
  };

export const CREATE_CONNECTION_EXCEPTION_ERROR_CODES: ExceptionErrorCodes = {
  MissingDiscordChannelException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_CHANNEL,
  },
  MissingChannelException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_CHANNEL,
  },
  DiscordChannelPermissionsException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_CHANNEL_PERMISSION,
  },
  UserMissingManageGuildException: {
    status: 403,
    code: ApiErrorCode.FEED_USER_MISSING_MANAGE_GUILD,
  },
  MissingChannelPermissionsException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_CHANNEL_PERMISSION,
  },
  InvalidDiscordChannelException: {
    status: 400,
    code: ApiErrorCode.DISCORD_CAHNNEL_INVALID,
  },
  WebhookMissingPermissionsException: {
    status: 403,
    code: ApiErrorCode.WEBHOOKS_MANAGE_MISSING_PERMISSIONS,
  },
  InsufficientSupporterLevelException: {
    status: 400,
    code: ApiErrorCode.INSUFFICIENT_SUPPORTER_LEVEL,
  },
  DiscordChannelMissingViewPermissionsException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_VIEW_CHANNEL_PERMISSION,
  },
  InvalidComponentsV2Exception: {
    status: 400,
    code: ApiErrorCode.FEED_INVALID_COMPONENTS_V2,
  },
};

export const UPDATE_CONNECTION_EXCEPTION_ERROR_CODES: ExceptionErrorCodes = {
  MissingDiscordChannelException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_CHANNEL,
  },
  MissingChannelException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_CHANNEL,
  },
  DiscordChannelPermissionsException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_CHANNEL_PERMISSION,
  },
  MissingChannelPermissionsException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_CHANNEL_PERMISSION,
  },
  DiscordChannelMissingViewPermissionsException: {
    status: 400,
    code: ApiErrorCode.FEED_MISSING_VIEW_CHANNEL_PERMISSION,
  },
  InvalidDiscordChannelException: {
    status: 400,
    code: ApiErrorCode.DISCORD_CAHNNEL_INVALID,
  },
  UserMissingManageGuildException: {
    status: 403,
    code: ApiErrorCode.FEED_USER_MISSING_MANAGE_GUILD,
  },
  WebhookMissingPermissionsException: {
    status: 403,
    code: ApiErrorCode.WEBHOOKS_MANAGE_MISSING_PERMISSIONS,
  },
  InsufficientSupporterLevelException: {
    status: 400,
    code: ApiErrorCode.INSUFFICIENT_SUPPORTER_LEVEL,
  },
  InvalidFilterExpressionException: {
    status: 400,
    code: ApiErrorCode.FEED_INVALID_FILTER_EXPRESSION,
  },
  InvalidComponentsV2Exception: {
    status: 400,
    code: ApiErrorCode.FEED_INVALID_COMPONENTS_V2,
  },
  CannotEnableAutoDisabledConnection: {
    status: 400,
    code: ApiErrorCode.FEED_CONNECTION_CANNOT_ENABLE_AUTO_DISABLED,
  },
};

export const DELETE_CONNECTION_EXCEPTION_ERROR_CODES: ExceptionErrorCodes = {
  FeedConnectionNotFoundException: {
    status: 404,
    code: ApiErrorCode.FEED_CONNECTION_NOT_FOUND,
  },
};
