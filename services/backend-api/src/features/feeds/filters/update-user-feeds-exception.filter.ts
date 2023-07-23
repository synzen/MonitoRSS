import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {};

@Catch(StandardException)
export class UpdateUserFeedsExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
