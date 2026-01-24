import { StandardException } from "./standard.exception";

export class TransactionBalanceTooLowException extends StandardException {
  override message = "Transaction balance is less than minimum required.";
}

export class CannotRenewSubscriptionBeforeRenewal extends StandardException {
  override message =
    "Subscription is about to renew. Wait at least 30 minutes before trying again.";
}

export class AddressLocationNotAllowedException extends StandardException {
  override message = "Your location is not supported for billing.";
}
