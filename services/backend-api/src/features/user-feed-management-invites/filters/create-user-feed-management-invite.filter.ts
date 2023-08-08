import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";

import { UserManagerAlreadyInvitedException } from "../exceptions";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [UserManagerAlreadyInvitedException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.USER_MANAGER_ALREADY_INVITED,
    },
  };

@Catch(StandardException)
export class CreateUserFeedManagementInviteExceptionFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
