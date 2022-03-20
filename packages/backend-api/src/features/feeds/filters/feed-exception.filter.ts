import { Catch, RequestTimeoutException, HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from '../../../common/constants/api-errors';
import { StandardBaseExceptionFilter } from '../../../common/filters/standard-exception-filter';
import {
  FeedException,
  FeedParseException,
  FeedParseTimeoutException,
  FeedRequestException,
  InvalidFeedException,
} from '../../../services/feed-fetcher/exceptions';

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [InvalidFeedException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.INVALID_FEED,
    },
    [FeedParseException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.PARSE_FAILED,
    },
    [FeedParseTimeoutException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.PARSE_TIMEOUT,
    },
    [RequestTimeoutException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.REQUEST_TIMEOUT,
    },
    [FeedRequestException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.REQUEST_FAILED,
    },
  };

@Catch(FeedException)
export class FeedExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
