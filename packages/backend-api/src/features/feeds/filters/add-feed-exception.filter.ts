import { Catch, HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from '../../../common/constants/api-errors';
import { StandardBaseExceptionFilter } from '../../../common/filters/standard-exception-filter';
import { AddFeedException, ForbiddenFeedChannelException } from '../exceptions';

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [ForbiddenFeedChannelException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.FEED_INVALID_CHANNEL,
    },
  };

@Catch(AddFeedException)
export class AddFeedExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
