export enum ProductKey {
  Free = "free",
  Tier1 = "tier1",
  Tier2 = "tier2",
  Tier3 = "tier3",
  Tier3Feed = "t3feed",
}

export const PRODUCT_NAMES: Record<ProductKey, string> = {
  [ProductKey.Free]: "Free",
  [ProductKey.Tier1]: "Tier 1",
  [ProductKey.Tier2]: "Tier 2",
  [ProductKey.Tier3]: "Tier 3",
  [ProductKey.Tier3Feed]: "Tier 3 Feed",
};

export const TOP_LEVEL_PRODUCTS = [
  ProductKey.Free,
  ProductKey.Tier1,
  ProductKey.Tier2,
  ProductKey.Tier3,
];
