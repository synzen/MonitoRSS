import { useEffect, useState } from "react";
import { PRICE_IDS, ProductKey } from "@/constants";
import { PricePreview } from "@/types/PricePreview";
import formatCurrency from "@/utils/formatCurrency";
import { usePaddleContext } from "../contexts/PaddleContext";

// The base products a personal subscription can bill for. The per-feed add-on
// (Tier3Feed) is never a subscription's own product, and Free has no price.
const BASE_PRODUCT_KEYS = [ProductKey.Tier1, ProductKey.Tier2, ProductKey.Tier3] as const;

type BaseProductKey = (typeof BASE_PRODUCT_KEYS)[number];

const isBaseProductKey = (key: ProductKey | undefined): key is BaseProductKey =>
  !!key && (BASE_PRODUCT_KEYS as readonly ProductKey[]).includes(key);

// The recurring price of the viewer's personal subscription, derived from the
// Paddle catalog preview (base product + per-feed add-ons) rather than stored
// data: neither the backend read model nor Paddle exposes the billed amount to
// the client, so the catalog price is the codebase-wide convention (the
// workspace billing page and the pricing dialog do the same). Undefined while
// Paddle loads, for the Free plan, or when the preview fails or omits a line
// item — callers must degrade to a price-less sentence, never a wrong one.
export const useSubscriptionCatalogPrice = ({
  productKey,
  addonQuantity,
  interval,
}: {
  productKey: ProductKey | undefined;
  addonQuantity: number;
  interval: "month" | "year";
}): { price: string | undefined } => {
  const { isConfigured, isLoaded, getPricePreview } = usePaddleContext();
  const [price, setPrice] = useState<string | undefined>(undefined);

  const isPaidBaseProduct = isBaseProductKey(productKey);

  useEffect(() => {
    let cancelled = false;

    if (isConfigured && isLoaded && isBaseProductKey(productKey)) {
      getPricePreview([
        { priceId: PRICE_IDS[productKey][interval], quantity: 1 },
        { priceId: PRICE_IDS[ProductKey.Tier3Feed][interval], quantity: 1 },
      ])
        .then((products: PricePreview[]) => {
          if (cancelled) {
            return;
          }

          const base = products
            .find((p) => p.id === productKey)
            ?.prices.find((p) => p.interval === interval);
          const feed = products
            .find((p) => p.id === ProductKey.Tier3Feed)
            ?.prices.find((p) => p.interval === interval);

          if (
            !base ||
            !feed ||
            !Number.isFinite(base.unitAmount) ||
            !Number.isFinite(feed.unitAmount)
          ) {
            return;
          }

          setPrice(
            formatCurrency(
              String(base.unitAmount + feed.unitAmount * addonQuantity),
              base.currencyCode,
            ),
          );
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [isConfigured, isLoaded, isPaidBaseProduct, productKey, interval, addonQuantity]);

  return { price };
};
