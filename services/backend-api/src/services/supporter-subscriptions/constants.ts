import { SubscriptionProductKey } from "../paddle/types";

export const PRODUCT_NAMES: Record<SubscriptionProductKey, string> = {
  [SubscriptionProductKey.Free]: "Free",
  [SubscriptionProductKey.Tier1]: "Tier 1",
  [SubscriptionProductKey.Tier2]: "Tier 2",
  [SubscriptionProductKey.Tier3]: "Tier 3",
  [SubscriptionProductKey.Tier3AdditionalFeed]: "Additional Feed",
};

export const PRODUCT_KEYS_BY_PLEDGE: Record<string, string> = {
  "100": "tier1-legacy",
  "250": "tier2-legacy",
  "500": "tier3-legacy",
  "1000": "tier4-legacy",
  "1500": "tier5-legacy",
  "2000": "tier6-legacy",
};

export const SUBSCRIPTION_PRODUCT_KEYS: SubscriptionProductKey[] = [
  SubscriptionProductKey.Free,
  SubscriptionProductKey.Tier1,
  SubscriptionProductKey.Tier2,
  SubscriptionProductKey.Tier3,
  SubscriptionProductKey.Tier3AdditionalFeed,
];
