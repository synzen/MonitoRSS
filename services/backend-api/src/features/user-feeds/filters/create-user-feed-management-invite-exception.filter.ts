import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions/standard-exception.exception";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";
import { NoPermissionException } from "../exceptions/no-permission.exception";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [NoPermissionException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.MISSING_SHARED_MANAGER_PERMISSIONS,
    },
  };

@Catch(StandardException)
export class CreateUserFeedManagementInviteExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
