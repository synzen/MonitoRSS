// The workspace capacity-slider model: the detents, the feed-count-to-basket
// rule, and the live price hook. Shared between the buy moment
// (subscriptionProducts' pricing dialog) and the manage moment (workspaces'
// billing page) so both produce the identical purchase basket. See ADR-009.
export { WORKSPACE_DETENTS } from "./detents";
export {
  useWorkspaceSliderPrice,
  feedCountToAddonQuantity,
  WORKSPACE_BASE_FEEDS,
} from "./useWorkspaceSliderPrice";
