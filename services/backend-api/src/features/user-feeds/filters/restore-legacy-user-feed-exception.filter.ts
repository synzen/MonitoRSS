import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions/standard-exception.exception";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";
import { IneligibleForRestorationException } from "../exceptions";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [IneligibleForRestorationException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.CANNOT_RESTORE_LEGACY_FEED,
    },
  };

@Catch(StandardException)
export class RestoreLegacyUserFeedExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
