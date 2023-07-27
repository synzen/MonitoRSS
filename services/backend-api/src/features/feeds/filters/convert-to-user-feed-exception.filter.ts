import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";

import {
  AlreadyConvertedToUserFeedException,
  CannotConvertOverUserFeedLimitException,
} from "../exceptions";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [CannotConvertOverUserFeedLimitException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.USER_FEED_LIMIT_REACHED,
    },
    [AlreadyConvertedToUserFeedException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.ALREADY_CONVERTED_TO_USER_FEED,
    },
  };

@Catch(StandardException)
export class ConverToUserFeedExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
