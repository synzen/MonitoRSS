import { SubscriptionStatus } from "../constants/subscription-status.constants";

export interface SubscriptionDetails {
  product: {
    key: string;
    name: string;
  };
  status: SubscriptionStatus;
}
