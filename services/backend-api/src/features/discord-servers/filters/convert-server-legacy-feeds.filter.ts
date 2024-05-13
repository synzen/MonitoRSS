/* eslint-disable max-len */
import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions/standard-exception.exception";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";
import { ConversionJobExistsException } from "../../legacy-feed-conversion/exceptions/conversion-job-exists.exception";
import { NoLegacyFeedsToConvertException } from "../../legacy-feed-conversion/exceptions/no-legacy-feeds-to-convert.exception";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [ConversionJobExistsException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.LEGACY_CONVERSION_JOB_EXISTS,
    },
    [NoLegacyFeedsToConvertException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.NO_LEGACY_FEEDS_TO_CONVERT,
    },
  };

@Catch(StandardException)
export class ConvertServerLegacyFeedsFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
