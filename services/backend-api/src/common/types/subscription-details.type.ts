import { SubscriptionStatus } from "../constants/subscription-status.constants";

export interface SubscriptionDetails {
  product: {
    key: string;
    name: string;
  };
  status: SubscriptionStatus;
  billingPeriod?: {
    start: Date;
    end: Date;
  };
  nextBillDate?: Date | null;
  cancellationDate?: Date | null;
  billingInterval?: "month" | "year";
  updatedAt: Date;
}
