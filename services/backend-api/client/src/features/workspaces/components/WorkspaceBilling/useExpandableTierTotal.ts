import { useEffect, useState } from "react";
import { PRICE_IDS, ProductKey } from "@/constants";

type BillingInterval = "month" | "year";

// The recurring price for "Tier 3 + N feeds", recomputed from Paddle's
// authoritative preview as the owner steps the count. We ask Paddle for the
// formatted total (rather than summing formatted strings client-side) so the
// figure stays correct across currencies and locales.
//
// Returns the price to display plus an `isUpdating` flag. While a fresh preview
// is in flight we keep the last known total visible (the caller dims it and
// shows a spinner) rather than blanking it or, worse, snapping back to the base
// price, which would read as a real lower price for a moment.
export const useExpandableTierTotal = ({
  tier,
  addonFeeds,
  interval,
  basePrice,
  getChargePreview,
}: {
  tier: Exclude<ProductKey, ProductKey.Free>;
  addonFeeds: number;
  interval: BillingInterval;
  basePrice: string | undefined;
  getChargePreview: (
    items: Array<{ priceId: string; quantity: number }>,
  ) => Promise<{ totalFormatted: string }>;
}): { price: string | undefined; isUpdating: boolean } => {
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
        { priceId: PRICE_IDS[tier][interval], quantity: 1 },
        { priceId: PRICE_IDS[ProductKey.Tier3Feed][interval], quantity: addonFeeds },
      ])
        .then((r) => {
          if (!cancelled) {
            setTotal(r.totalFormatted);
          }
        })
        .catch(() => {
          // Keep the last shown figure on a transient preview failure; the
          // authoritative total still appears in the confirmation dialog.
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
  }, [tier, addonFeeds, interval, getChargePreview]);

  if (addonFeeds <= 0) {
    return { price: basePrice, isUpdating: false };
  }

  // Before the first total resolves we have nothing better than the base price
  // to anchor on; pair it with the updating flag so it is visibly provisional.
  return { price: total ?? basePrice, isUpdating };
};
