import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";

import { FEED_EXCEPTION_FILTER_ERROR_CODES } from "./feed-exception.filter";
import { RefreshRateNotAllowedException } from "../exceptions/refresh-rate-not-allowed.exception";

const UPDATE_USER_FEED_EXCEPTION_FILTER_ERROR_CODES: Record<
  string,
  { status: HttpStatus; code: ApiErrorCode }
> = {
  ...FEED_EXCEPTION_FILTER_ERROR_CODES,
  [RefreshRateNotAllowedException.name]: {
    status: HttpStatus.BAD_REQUEST,
    code: ApiErrorCode.USER_REFRESH_RATE_NOT_ALLOWED,
  },
};

@Catch(StandardException)
export class UpdateUserFeedExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = UPDATE_USER_FEED_EXCEPTION_FILTER_ERROR_CODES;
}
