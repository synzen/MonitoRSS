import { ProductKey } from "@/constants";
import { PricePreview } from "@/types/PricePreview";
import formatCurrency from "@/utils/formatCurrency";

// The base workspace tier the slider always carries. Every detent is this base
// (70 feeds) plus a per-feed add-on for the overage, so any feed count maps to a
// real purchasable item set: [base tier, add-on quantity]. This mirrors the
// backend's resolveWorkspaceFeedLimit (base + add-on feeds) without importing it
// across the package boundary. Must match WORKSPACE_TIER_FEED_LIMITS[Tier2].
export const WORKSPACE_BASE_FEEDS = 70;

// The pricing inputs the slider needs, in integer minor units (e.g. cents), plus
// the currency code. Both come from the page-level Paddle price preview the
// caller already fetched (the Tier2 base and the Tier3Feed per-unit line items),
// so the slider needs no Paddle call of its own. Supplied by the caller because
// Paddle lives in a feature and this shared hook must not import features
// (ADR-009). Undefined until that preview lands.
export interface WorkspaceFeedPricing {
  baseUnitAmount: number;
  perFeedUnitAmount: number;
  currencyCode: string;
}

// Pull the slider's pricing inputs out of an already-fetched page-level price
// preview: the Tier2 base unit and the Tier3Feed per-feed unit for the given
// interval, in integer minor units. Takes the preview list (not a Paddle handle)
// so this shared module imports no feature (ADR-009); both the pricing dialog and
// the workspace billing page call it, so the lookup lives in one place. Returns
// undefined until the preview lands, if either line item is missing, or if a unit
// amount is not a finite number (so the slider shows its loading state rather than
// a NaN price).
export const workspaceFeedPricingFromProducts = (
  products: PricePreview[] | undefined,
  interval: "month" | "year",
): WorkspaceFeedPricing | undefined => {
  const basePrice = products
    ?.find((p) => p.id === ProductKey.Tier2)
    ?.prices.find((p) => p.interval === interval);
  const feedPrice = products
    ?.find((p) => p.id === ProductKey.Tier3Feed)
    ?.prices.find((p) => p.interval === interval);

  if (
    !basePrice ||
    !feedPrice ||
    !Number.isFinite(basePrice.unitAmount) ||
    !Number.isFinite(feedPrice.unitAmount)
  ) {
    return undefined;
  }

  return {
    baseUnitAmount: basePrice.unitAmount,
    perFeedUnitAmount: feedPrice.unitAmount,
    currencyCode: basePrice.currencyCode,
  };
};

// The add-on quantity a given feed count needs on top of the base tier. The
// add-on is 1-feed granular, so the overage above the base is the quantity.
export const feedCountToAddonQuantity = (feeds: number) =>
  Math.max(0, feeds - WORKSPACE_BASE_FEEDS);

// The recurring price for "base workspace tier + N add-on feeds", derived purely
// from the already-fetched price preview. Each detent total is
// `base + perFeedUnit * addonFeeds` in integer minor units (both amounts are
// Paddle's own authoritative per-unit figures, so this is not lossy string math),
// then formatted once. No Paddle round-trip: the whole detent range, and both
// billing intervals, are priced from data the page already has, so dragging the
// slider or toggling the interval costs nothing.
//
// The displayed total is an estimate; Paddle re-confirms the exact charge at
// checkout, where per-line tax rounding may differ by up to a minor unit.
export const useWorkspaceSliderPrice = ({
  feeds,
  pricing,
}: {
  feeds: number;
  // Undefined while the page-level price preview is still loading.
  pricing: WorkspaceFeedPricing | undefined;
}): { price: string | undefined } => {
  if (!pricing) {
    return { price: undefined };
  }

  const addonFeeds = feedCountToAddonQuantity(feeds);
  const totalMinorUnits = pricing.baseUnitAmount + pricing.perFeedUnitAmount * addonFeeds;

  return { price: formatCurrency(String(totalMinorUnits), pricing.currencyCode) };
};
