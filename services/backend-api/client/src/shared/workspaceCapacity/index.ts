// The workspace capacity-slider model: the detents, the feed-count-to-basket
// rule, and the live price hook. Shared between the buy moment
// (subscriptionProducts' pricing dialog) and the manage moment (workspaces'
// billing page) so both produce the identical purchase basket. See ADR-009.
export {
  WORKSPACE_CAPACITY_QUICK_PICKS,
  WORKSPACE_MAX_FEEDS,
  WORKSPACE_MIN_FEEDS,
  formatWorkspaceFeedNumber,
  formatWorkspaceFeedCount,
} from "./detents";
export { CapacityPicker } from "./CapacityPicker";
export {
  useWorkspaceSliderPrice,
  feedCountToAddonQuantity,
  workspaceFeedPricingFromProducts,
  WORKSPACE_BASE_FEEDS,
} from "./useWorkspaceSliderPrice";
export type { WorkspaceFeedPricing } from "./useWorkspaceSliderPrice";
export { WORKSPACE_FEATURES, FeatureRow, WorkspaceFeatureRow } from "./features";
