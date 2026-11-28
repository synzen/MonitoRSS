import { ProductKey } from "@/constants";
import { PricePreview } from "@/types/PricePreview";
import formatCurrency from "@/utils/formatCurrency";

// The fixed Tier 2 allowance. Larger workspace capacities start at Tier 3.
export const WORKSPACE_BASE_FEEDS = 70;

export const WORKSPACE_TIER3_BASE_FEEDS = 140;

export type WorkspaceBasketLine =
  | { productKey: ProductKey.Tier2; quantity: 1 }
  | { productKey: ProductKey.Tier3; quantity: 1 }
  | { productKey: ProductKey.Tier3Feed; quantity: number };

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
  // The Tier3 (140-feed) base unit amount, when the caller's preview asked for
  // that line item. A subscription already ON Tier3 bills this base for its
  // first 140 feeds — not the Tier2 base plus add-ons — so pricing an existing
  // Tier3 subscription on the slider's Tier-2 basket would overstate its price.
  tier3BaseUnitAmount?: number;
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
  const tier3BasePrice = products
    ?.find((p) => p.id === ProductKey.Tier3)
    ?.prices.find((p) => p.interval === interval);

  if (
    !basePrice ||
    !feedPrice ||
    !Number.isFinite(basePrice.unitAmount) ||
    !Number.isFinite(feedPrice.unitAmount)
  ) {
    return undefined;
  }

  const tier3BaseUnitAmount = tier3BasePrice?.unitAmount;

  return {
    baseUnitAmount: basePrice.unitAmount,
    perFeedUnitAmount: feedPrice.unitAmount,
    currencyCode: basePrice.currencyCode,
    tier3BaseUnitAmount: Number.isFinite(tier3BaseUnitAmount) ? tier3BaseUnitAmount : undefined,
  };
};

// Additional feeds are available only above the Tier 3 base allowance.
export const feedCountToAddonQuantity = (feeds: number) =>
  Math.max(0, feeds - WORKSPACE_TIER3_BASE_FEEDS);

export const workspaceCapacityToBasket = (feeds: number): WorkspaceBasketLine[] => {
  if (feeds <= WORKSPACE_BASE_FEEDS) {
    return [{ productKey: ProductKey.Tier2, quantity: 1 }];
  }

  const addonFeeds = feedCountToAddonQuantity(feeds);

  return [
    { productKey: ProductKey.Tier3, quantity: 1 },
    ...(addonFeeds > 0
      ? [{ productKey: ProductKey.Tier3Feed, quantity: addonFeeds } as const]
      : []),
  ];
};

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

  const basket = workspaceCapacityToBasket(feeds);
  const baseUnitAmount =
    basket[0]?.productKey === ProductKey.Tier3
      ? (pricing.tier3BaseUnitAmount ?? pricing.baseUnitAmount)
      : pricing.baseUnitAmount;
  const addonFeeds =
    basket.find((line) => line.productKey === ProductKey.Tier3Feed)?.quantity ?? 0;
  const totalMinorUnits = baseUnitAmount + pricing.perFeedUnitAmount * addonFeeds;

  return { price: formatCurrency(String(totalMinorUnits), pricing.currencyCode) };
};
