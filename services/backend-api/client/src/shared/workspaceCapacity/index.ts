// The workspace capacity model: the supported range, quick picks, the
// feed-count-to-basket rule, and the live price hook. Shared between the buy
// moment (subscriptionProducts' pricing dialog) and the manage moment
// (workspaces' billing page) so both produce the identical purchase basket.
// See ADR-009.
export {
  WORKSPACE_CAPACITY_QUICK_PICKS,
  WORKSPACE_DETENTS,
  WORKSPACE_FIRST_UPGRADE_FEEDS,
  WORKSPACE_MAX_FEEDS,
  WORKSPACE_MIN_FEEDS,
  formatWorkspaceFeedNumber,
  formatWorkspaceFeedCount,
} from "./detents";
export { CapacityPicker, normalizeWorkspaceCapacity } from "./CapacityPicker";
export { IntervalPicker, BILLING_INTERVAL_WORD } from "./IntervalPicker";
export type { BillingInterval } from "./IntervalPicker";
export {
  useWorkspaceSliderPrice,
  feedCountToAddonQuantity,
  workspaceCapacityToBasket,
  workspaceFeedPricingFromProducts,
  WORKSPACE_BASE_FEEDS,
  WORKSPACE_TIER3_BASE_FEEDS,
} from "./useWorkspaceSliderPrice";
export type { WorkspaceBasketLine, WorkspaceFeedPricing } from "./useWorkspaceSliderPrice";
export { WORKSPACE_FEATURES, FeatureRow, WorkspaceFeatureRow } from "./features";
