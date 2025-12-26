import { Catch, RequestTimeoutException, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";
import {
  FeedForbiddenException,
  FeedInternalErrorException,
  FeedNotFoundException,
  FeedParseException,
  FeedParseTimeoutException,
  FeedRequestException,
  FeedTooManyRequestsException,
  FeedUnauthorizedException,
  InvalidFeedException,
  FeedFetchTimeoutException,
  FeedInvalidSslCertException,
  NoFeedOnHtmlPageException,
} from "../../../services/feed-fetcher/exceptions";
import { FeedTooLargeException } from "../../../services/feed-fetcher/exceptions/FeedTooLargeException";
import { FeedLimitReachedException } from "../exceptions";
import { SourceFeedNotFoundException } from "../../user-feeds/exceptions/source-feed-not-found.exception";

export const FEED_EXCEPTION_FILTER_ERROR_CODES: Record<
  string,
  { status: HttpStatus; code: ApiErrorCode }
> = {
  [InvalidFeedException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_INVALID,
  },
  [FeedFetchTimeoutException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_REQUEST_TIMEOUT,
  },
  [FeedParseException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.ADD_FEED_PARSE_FAILED,
  },
  [NoFeedOnHtmlPageException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.NO_FEED_IN_HTML_PAGE,
  },
  [FeedParseTimeoutException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_PARSE_TIMEOUT,
  },
  [FeedInvalidSslCertException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_INVALID_SSL_CERT,
  },
  [RequestTimeoutException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_PARSE_TIMEOUT,
  },
  [FeedRequestException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_FETCH_FAILED,
  },
  [FeedForbiddenException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_REQUEST_FORBIDDEN,
  },
  [FeedInternalErrorException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_REQUEST_INTERNAL_ERROR,
  },
  [FeedTooManyRequestsException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_REQUEST_TOO_MANY_REQUESTS,
  },
  [FeedUnauthorizedException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_REQUEST_UNAUTHORIZED,
  },
  [FeedLimitReachedException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_LIMIT_REACHED,
  },
  [FeedNotFoundException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_NOT_FOUND,
  },
  [FeedTooLargeException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_TOO_LARGE,
  },
  [SourceFeedNotFoundException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.ADD_FEED_WITH_SOURCE_FEED_NOT_FOUND,
  },
  [FeedInvalidSslCertException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.FEED_INVALID_SSL_CERT,
  },
};

@Catch(StandardException)
export class FeedExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = FEED_EXCEPTION_FILTER_ERROR_CODES;
}
