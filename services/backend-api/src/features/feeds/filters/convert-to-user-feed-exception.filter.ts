import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";
import { HandledByBulkConversionException } from "../../legacy-feed-conversion/exceptions/handled-by-bulk-conversion.exception";

import { AlreadyConvertedToUserFeedException } from "../exceptions";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [AlreadyConvertedToUserFeedException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.ALREADY_CONVERTED_TO_USER_FEED,
    },
    [HandledByBulkConversionException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.HANDLED_BY_BULK_CONVERSION,
    },
  };

@Catch(StandardException)
export class ConverToUserFeedExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
