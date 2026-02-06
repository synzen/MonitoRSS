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
