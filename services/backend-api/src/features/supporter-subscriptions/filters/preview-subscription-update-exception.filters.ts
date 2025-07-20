import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";

import { TransactionBalanceTooLowException } from "../../paddle/exceptions/transaction-balance-too-low.exception";
import { CannotRenewSubscriptionBeforeRenewal } from "../../paddle/exceptions/cannot-renew-subscription-before-renewal.exception";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [TransactionBalanceTooLowException.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.TRANSACTION_BALANCE_TOO_LOW,
    },
    [CannotRenewSubscriptionBeforeRenewal.name]: {
      status: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.SUBSCRIPTION_ABOUT_TO_RENEW,
    },
  };

@Catch(StandardException)
export class PreviewSubscriptionUpdateExceptionFilters extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
