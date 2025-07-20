import { StandardException } from "../../../common/exceptions";

export class CannotRenewSubscriptionBeforeRenewal extends StandardException {
  message =
    "Subscription is about to renew. Wait at least 30 minutes before tryin again.";
}
