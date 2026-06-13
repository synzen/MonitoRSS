import { ApiErrorCode } from "../../shared/constants/api-errors";
import type { ExceptionErrorCodes } from "../../shared/filters/exception-filter";

export const WORKSPACE_BILLING_EXCEPTION_ERROR_CODES: ExceptionErrorCodes = {
  WorkspaceBillingNotConfiguredException: {
    status: 400,
    code: ApiErrorCode.WORKSPACE_BILLING_NOT_CONFIGURED,
  },
  InvalidWorkspaceTierException: {
    status: 400,
    code: ApiErrorCode.WORKSPACE_INVALID_TIER,
  },
  WorkspaceNotSubscribedException: {
    status: 400,
    code: ApiErrorCode.WORKSPACE_NOT_SUBSCRIBED,
  },
  // Same Paddle failure modes as the personal subscription endpoints.
  TransactionBalanceTooLowException: {
    status: 400,
    code: ApiErrorCode.TRANSACTION_BALANCE_TOO_LOW,
  },
  CannotRenewSubscriptionBeforeRenewal: {
    status: 400,
    code: ApiErrorCode.SUBSCRIPTION_ABOUT_TO_RENEW,
  },
  SubscriptionAlreadyCancelledException: {
    status: 400,
    code: ApiErrorCode.SUBSCRIPTION_ALREADY_CANCELLED,
  },
};
