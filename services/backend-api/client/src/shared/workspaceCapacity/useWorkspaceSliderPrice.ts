import { useEffect, useState } from "react";
import { PRICE_IDS, ProductKey } from "@/constants";

type BillingInterval = "month" | "year";

// The base workspace tier the slider always carries. Every detent is this base
// (70 feeds) plus a per-feed add-on for the overage, so any feed count maps to a
// real purchasable item set: [base tier, add-on quantity]. This mirrors the
// backend's resolveWorkspaceFeedLimit (base + add-on feeds) without importing it
// across the package boundary. Must match WORKSPACE_TIER_FEED_LIMITS[Tier2].
export const WORKSPACE_BASE_FEEDS = 70;

// The add-on quantity a given feed count needs on top of the base tier. The
// add-on is 1-feed granular, so the overage above the base is the quantity.
export const feedCountToAddonQuantity = (feeds: number) =>
  Math.max(0, feeds - WORKSPACE_BASE_FEEDS);

// The live recurring price for "base workspace tier + N add-on feeds", from
// Paddle's authoritative preview (not client-side string math, so it stays
// correct across currencies/locales). At the base feed count there are no
// add-ons, so the base price is shown directly with no preview round-trip.
//
// While a fresh preview is in flight the last known total stays visible (the
// caller dims it) rather than blanking or snapping to the base price, which
// would read as a real lower price for a moment.
export const useWorkspaceSliderPrice = ({
  feeds,
  interval,
  baseWorkspacePrice,
  getChargePreview,
}: {
  feeds: number;
  interval: BillingInterval;
  baseWorkspacePrice: string | undefined;
  getChargePreview: (
    items: Array<{ priceId: string; quantity: number }>,
  ) => Promise<{ totalFormatted: string }>;
}): { price: string | undefined; isUpdating: boolean } => {
  const addonFeeds = feedCountToAddonQuantity(feeds);
  const [total, setTotal] = useState<string>();
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (addonFeeds <= 0) {
      setTotal(undefined);
      setIsUpdating(false);

      return undefined;
    }

    let cancelled = false;
    setIsUpdating(true);
    const timer = window.setTimeout(() => {
      getChargePreview([
        { priceId: PRICE_IDS[ProductKey.Tier2][interval], quantity: 1 },
        { priceId: PRICE_IDS[ProductKey.Tier3Feed][interval], quantity: addonFeeds },
      ])
        .then((r) => {
          if (!cancelled) {
            setTotal(r.totalFormatted);
          }
        })
        .catch(() => {
          // Keep the last shown figure on a transient preview failure.
        })
        .finally(() => {
          if (!cancelled) {
            setIsUpdating(false);
          }
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [addonFeeds, interval, getChargePreview]);

  if (addonFeeds <= 0) {
    return { price: baseWorkspacePrice, isUpdating: false };
  }

  return { price: total ?? baseWorkspacePrice, isUpdating };
};
