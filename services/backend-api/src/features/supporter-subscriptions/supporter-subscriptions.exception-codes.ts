import { ApiErrorCode } from "../../shared/constants/api-errors";
import type { ExceptionErrorCodes } from "../../shared/filters/exception-filter";

export const UPDATE_PREVIEW_EXCEPTION_ERROR_CODES: ExceptionErrorCodes = {
  TransactionBalanceTooLowException: {
    status: 400,
    code: ApiErrorCode.TRANSACTION_BALANCE_TOO_LOW,
  },
  CannotRenewSubscriptionBeforeRenewal: {
    status: 400,
    code: ApiErrorCode.SUBSCRIPTION_ABOUT_TO_RENEW,
  },
};
