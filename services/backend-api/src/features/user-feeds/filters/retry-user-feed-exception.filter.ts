import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions/standard-exception.exception";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";
import { FeedNotFailedException } from "../exceptions";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [FeedNotFailedException.name]: {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: ApiErrorCode.FEED_NOT_FAILED,
    },
  };

@Catch(StandardException)
export class RetryUserFeedFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
