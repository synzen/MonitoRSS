import { Catch, RequestTimeoutException, HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from '../../../common/constants/api-errors';
import { StandardBaseExceptionFilter } from '../../../common/filters/standard-exception-filter';
import {
  FeedException,
  FeedForbiddenException,
  FeedInternalErrorException,
  FeedParseException,
  FeedParseTimeoutException,
  FeedRequestException,
  FeedTooManyRequestsException,
  FeedUnauthorizedException,
  InvalidFeedException,
} from '../../../services/feed-fetcher/exceptions';

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [InvalidFeedException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_INVALID,
    },
    [FeedParseException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_PARSE_FAILED,
    },
    [FeedParseTimeoutException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_PARSE_TIMEOUT,
    },
    [RequestTimeoutException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_PARSE_TIMEOUT,
    },
    [FeedRequestException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_PARSE_FAILED,
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
  };

@Catch(FeedException)
export class FeedExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
