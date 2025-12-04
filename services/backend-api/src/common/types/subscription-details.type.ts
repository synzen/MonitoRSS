import { SubscriptionProductKey } from "../../features/supporter-subscriptions/constants/subscription-product-key.constants";
import { SubscriptionStatus } from "../constants/subscription-status.constants";

export interface SubscriptionDetails {
  product: {
    key: SubscriptionProductKey;
    name: string;
  };
  addons: Array<{
    key: SubscriptionProductKey;
    quantity: number;
  }>;
  status: SubscriptionStatus;
  billingPeriod?: {
    start: Date;
    end: Date;
  };
  nextBillDate?: Date | null;
  cancellationDate?: Date | null;
  billingInterval?: "month" | "year";
  updatedAt: Date;
  updatePaymentMethodUrl?: string;
  pastDueGracePeriodEndDate?: Date;
}
