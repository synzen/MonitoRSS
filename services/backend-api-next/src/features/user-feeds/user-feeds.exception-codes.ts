import { ApiErrorCode } from "../../shared/constants/api-errors";
import type { ExceptionErrorCodes } from "../../shared/filters/exception-filter";
import { mergeExceptionErrorCodes } from "../../shared/filters/exception-filter";

export const FEED_EXCEPTION_ERROR_CODES: ExceptionErrorCodes = {
  FeedLimitReachedException: {
    status: 400,
    code: ApiErrorCode.FEED_LIMIT_REACHED,
  },
  SourceFeedNotFoundException: {
    status: 400,
    code: ApiErrorCode.ADD_FEED_WITH_SOURCE_FEED_NOT_FOUND,
  },
  BannedFeedException: { status: 400, code: ApiErrorCode.BANNED_FEED },
  FeedFetchTimeoutException: {
    status: 400,
    code: ApiErrorCode.FEED_REQUEST_TIMEOUT,
  },
  FeedParseException: { status: 400, code: ApiErrorCode.ADD_FEED_PARSE_FAILED },
  FeedRequestException: { status: 400, code: ApiErrorCode.FEED_FETCH_FAILED },
  FeedInvalidSslCertException: {
    status: 400,
    code: ApiErrorCode.FEED_INVALID_SSL_CERT,
  },
  NoFeedOnHtmlPageException: {
    status: 400,
    code: ApiErrorCode.NO_FEED_IN_HTML_PAGE,
  },
  FeedTooManyRequestsException: {
    status: 400,
    code: ApiErrorCode.FEED_REQUEST_TOO_MANY_REQUESTS,
  },
  FeedUnauthorizedException: {
    status: 400,
    code: ApiErrorCode.FEED_REQUEST_UNAUTHORIZED,
  },
  FeedForbiddenException: {
    status: 400,
    code: ApiErrorCode.FEED_REQUEST_FORBIDDEN,
  },
  FeedInternalErrorException: {
    status: 400,
    code: ApiErrorCode.FEED_REQUEST_INTERNAL_ERROR,
  },
  FeedNotFoundException: { status: 400, code: ApiErrorCode.FEED_NOT_FOUND },
  FeedTooLargeException: { status: 400, code: ApiErrorCode.FEED_TOO_LARGE },
};

export const UPDATE_USER_FEED_EXCEPTION_ERROR_CODES: ExceptionErrorCodes =
  mergeExceptionErrorCodes(FEED_EXCEPTION_ERROR_CODES, {
    RefreshRateNotAllowedException: {
      status: 400,
      code: ApiErrorCode.USER_REFRESH_RATE_NOT_ALLOWED,
    },
  });

const CHANNEL_PERMISSION_ERROR_CODES: ExceptionErrorCodes = {
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
};

export const CLONE_USER_FEED_EXCEPTION_ERROR_CODES: ExceptionErrorCodes =
  mergeExceptionErrorCodes(
    FEED_EXCEPTION_ERROR_CODES,
    CHANNEL_PERMISSION_ERROR_CODES,
  );

export const GET_ARTICLE_PROPERTIES_EXCEPTION_ERROR_CODES: ExceptionErrorCodes =
  {
    InvalidPreviewCustomPlaceholdersRegexException: {
      status: 422,
      code: ApiErrorCode.INVALID_CUSTOM_PLACEHOLDERS_REGEX_PREVIEW_INPUT,
    },
    InvalidFiltersRegexException: {
      status: 422,
      code: ApiErrorCode.INVALID_FILTERS_REGEX,
    },
  };

export const GET_ARTICLES_EXCEPTION_ERROR_CODES: ExceptionErrorCodes =
  GET_ARTICLE_PROPERTIES_EXCEPTION_ERROR_CODES;

export const SEND_TEST_ARTICLE_EXCEPTION_ERROR_CODES: ExceptionErrorCodes =
  mergeExceptionErrorCodes(CHANNEL_PERMISSION_ERROR_CODES, {
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
  });
