export enum ProductKey {
  Free = "free",
  Tier1 = "tier1",
  Tier2 = "tier2",
  Tier3 = "tier3",
}

export const PRODUCT_NAMES: Record<ProductKey, string> = {
  [ProductKey.Free]: "Free",
  [ProductKey.Tier1]: "Tier 1",
  [ProductKey.Tier2]: "Tier 2",
  [ProductKey.Tier3]: "Tier 3",
};
