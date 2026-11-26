import "@testing-library/jest-dom/vitest";
import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProductKey } from "@/constants";
import { PricePreview } from "@/types/PricePreview";
import {
  useWorkspaceSliderPrice,
  workspaceFeedPricingFromProducts,
  workspaceCapacityToBasket,
  WORKSPACE_BASE_FEEDS,
  WORKSPACE_TIER3_BASE_FEEDS,
  feedCountToAddonQuantity,
  WorkspaceFeedPricing,
} from "./useWorkspaceSliderPrice";

describe("feedCountToAddonQuantity", () => {
  it("is zero at or below the Tier 3 base feed count", () => {
    expect(feedCountToAddonQuantity(WORKSPACE_BASE_FEEDS)).toBe(0);
    expect(feedCountToAddonQuantity(WORKSPACE_TIER3_BASE_FEEDS)).toBe(0);
  });

  it("is the overage above the Tier 3 base feed count", () => {
    expect(feedCountToAddonQuantity(WORKSPACE_TIER3_BASE_FEEDS + 30)).toBe(30);
    expect(feedCountToAddonQuantity(500)).toBe(500 - WORKSPACE_TIER3_BASE_FEEDS);
  });
});

describe("workspaceCapacityToBasket", () => {
  it("uses the fixed Tier 2 plan at 70 feeds", () => {
    expect(workspaceCapacityToBasket(70)).toEqual([
      { productKey: ProductKey.Tier2, quantity: 1 },
    ]);
  });

  it("uses Tier 3 without add-ons at 140 feeds", () => {
    expect(workspaceCapacityToBasket(140)).toEqual([
      { productKey: ProductKey.Tier3, quantity: 1 },
    ]);
  });

  it("uses Tier 3 plus add-ons above 140 feeds", () => {
    expect(workspaceCapacityToBasket(200)).toEqual([
      { productKey: ProductKey.Tier3, quantity: 1 },
      { productKey: ProductKey.Tier3Feed, quantity: 60 },
    ]);
  });
});

describe("workspaceFeedPricingFromProducts", () => {
  const price = (interval: "month" | "year", unitAmount: number) => ({
    id: `${interval}-price`,
    interval,
    formattedPrice: "$0",
    unitAmount,
    currencyCode: "USD",
    quantity: 1,
  });

  const products: PricePreview[] = [
    {
      id: ProductKey.Tier2,
      name: "Tier2",
      prices: [price("month", 1000), price("year", 10000)],
    },
    {
      id: ProductKey.Tier3Feed,
      name: "Feed",
      prices: [price("month", 50), price("year", 500)],
    },
  ];

  it("is undefined until the preview lands", () => {
    expect(workspaceFeedPricingFromProducts(undefined, "month")).toBeUndefined();
  });

  it("pulls the base + per-feed unit amounts for the interval", () => {
    expect(workspaceFeedPricingFromProducts(products, "month")).toEqual({
      baseUnitAmount: 1000,
      perFeedUnitAmount: 50,
      currencyCode: "USD",
    });
    expect(workspaceFeedPricingFromProducts(products, "year")).toEqual({
      baseUnitAmount: 10000,
      perFeedUnitAmount: 500,
      currencyCode: "USD",
    });
  });

  it("is undefined when a required line item is missing", () => {
    const baseOnly = products.filter((p) => p.id === ProductKey.Tier2);
    expect(workspaceFeedPricingFromProducts(baseOnly, "month")).toBeUndefined();
  });

  it("carries the Tier3 base unit amount when the preview includes it", () => {
    const withTier3: PricePreview[] = [
      ...products,
      {
        id: ProductKey.Tier3,
        name: "Tier3",
        prices: [price("month", 2000), price("year", 20000)],
      },
    ];

    expect(workspaceFeedPricingFromProducts(withTier3, "month")).toEqual({
      baseUnitAmount: 1000,
      perFeedUnitAmount: 50,
      currencyCode: "USD",
      tier3BaseUnitAmount: 2000,
    });
    // Absent from the preview -> absent from the pricing inputs, not zero.
    expect(
      workspaceFeedPricingFromProducts(products, "month")?.tier3BaseUnitAmount,
    ).toBeUndefined();
  });

  it("is undefined when a unit amount is not a finite number", () => {
    const poisoned: PricePreview[] = [
      {
        id: ProductKey.Tier2,
        name: "Tier2",
        prices: [price("month", Number.NaN)],
      },
      { id: ProductKey.Tier3Feed, name: "Feed", prices: [price("month", 50)] },
    ];
    expect(workspaceFeedPricingFromProducts(poisoned, "month")).toBeUndefined();
  });
});

describe("useWorkspaceSliderPrice", () => {
  // Base $10.00, per-feed $0.50, in integer minor units (cents) as Paddle returns
  // them on the price preview.
  const pricing: WorkspaceFeedPricing = {
    baseUnitAmount: 1000,
    perFeedUnitAmount: 50,
    currencyCode: "USD",
    tier3BaseUnitAmount: 2000,
  };

  const priceFor = (feeds: number, p: WorkspaceFeedPricing | undefined) =>
    renderHook(() => useWorkspaceSliderPrice({ feeds, pricing: p })).result.current.price;

  it("is undefined until the pricing preview is available", () => {
    expect(priceFor(WORKSPACE_BASE_FEEDS, undefined)).toBeUndefined();
  });

  it("shows the base price at the base feed count with no add-on", () => {
    // 1000 cents = $10.00, rendered "$10" (formatCurrency drops a trailing .00).
    expect(priceFor(WORKSPACE_BASE_FEEDS, pricing)).toBe("$10");
  });

  it("prices Tier 3 plus per-feed overage", () => {
    // 2000 + 50 * 60 = 5000 cents = $50.00 -> "$50".
    expect(priceFor(200, pricing)).toBe("$50");
    // 2000 + 50 * 360 = 20000 cents = $200.00 -> "$200".
    expect(priceFor(500, pricing)).toBe("$200");
  });
});
