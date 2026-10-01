import "@testing-library/jest-dom";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PRICE_IDS, ProductKey } from "@/constants";
import { useSubscriptionCatalogPrice } from "./useSubscriptionCatalogPrice";

const h = vi.hoisted(() => ({
  usePaddleContext: vi.fn(),
}));

vi.mock("../contexts/PaddleContext", () => ({
  usePaddleContext: h.usePaddleContext,
}));

const mockPaddle = (
  overrides: Partial<{
    isConfigured: boolean;
    isLoaded: boolean;
    getPricePreview: ReturnType<typeof vi.fn>;
  }> = {},
) => {
  h.usePaddleContext.mockReturnValue({
    isConfigured: true,
    isLoaded: true,
    getPricePreview: vi.fn().mockResolvedValue([]),
    ...overrides,
  });
};

describe("useSubscriptionCatalogPrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives the recurring price as base plus per-feed add-ons", async () => {
    // Personal $5.00 + 5 add-on feeds at $0.50 = $7.50 (minor units: 500 + 5*50).
    const getPricePreview = vi.fn().mockResolvedValue([
      {
        id: ProductKey.Tier1,
        name: "Tier 1",
        prices: [
          {
            id: PRICE_IDS[ProductKey.Tier1].month,
            interval: "month",
            formattedPrice: "$5.00",
            unitAmount: 500,
            currencyCode: "USD",
            quantity: 1,
          },
        ],
      },
      {
        id: ProductKey.Tier3Feed,
        name: "Tier 3 Feed",
        prices: [
          {
            id: PRICE_IDS[ProductKey.Tier3Feed].month,
            interval: "month",
            formattedPrice: "$0.50",
            unitAmount: 50,
            currencyCode: "USD",
            quantity: 1,
          },
        ],
      },
    ]);
    mockPaddle({ getPricePreview });

    const { result } = renderHook(() =>
      useSubscriptionCatalogPrice({
        productKey: ProductKey.Tier1,
        addonQuantity: 5,
        interval: "month",
      }),
    );

    await waitFor(() => expect(result.current.price).toBe("$7.50"));
    expect(getPricePreview).toHaveBeenCalledWith([
      { priceId: PRICE_IDS[ProductKey.Tier1].month, quantity: 1 },
      { priceId: PRICE_IDS[ProductKey.Tier3Feed].month, quantity: 1 },
    ]);
  });

  it("is undefined and fetches nothing for the Free plan", () => {
    const getPricePreview = vi.fn();
    mockPaddle({ getPricePreview });

    const { result } = renderHook(() =>
      useSubscriptionCatalogPrice({
        productKey: ProductKey.Free,
        addonQuantity: 0,
        interval: "month",
      }),
    );

    expect(result.current.price).toBeUndefined();
    expect(getPricePreview).not.toHaveBeenCalled();
  });

  it("is undefined and fetches nothing while Paddle is not loaded", () => {
    const getPricePreview = vi.fn();
    mockPaddle({ isConfigured: false, isLoaded: false, getPricePreview });

    const { result } = renderHook(() =>
      useSubscriptionCatalogPrice({
        productKey: ProductKey.Tier1,
        addonQuantity: 0,
        interval: "month",
      }),
    );

    expect(result.current.price).toBeUndefined();
    expect(getPricePreview).not.toHaveBeenCalled();
  });

  it("stays undefined when the preview fails or omits a line item", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("network"));
    mockPaddle({ getPricePreview: failing });

    const { result } = renderHook(() =>
      useSubscriptionCatalogPrice({
        productKey: ProductKey.Tier1,
        addonQuantity: 0,
        interval: "year",
      }),
    );

    await waitFor(() => expect(failing).toHaveBeenCalled());
    expect(result.current.price).toBeUndefined();

    // An incomplete preview (base without the per-feed item) must also yield
    // no price rather than a partial one.
    const partial = vi.fn().mockResolvedValue([
      {
        id: ProductKey.Tier1,
        name: "Tier 1",
        prices: [
          {
            id: PRICE_IDS[ProductKey.Tier1].year,
            interval: "year",
            formattedPrice: "$50.00",
            unitAmount: 5000,
            currencyCode: "USD",
            quantity: 1,
          },
        ],
      },
    ]);
    mockPaddle({ getPricePreview: partial });

    const { result: partialResult } = renderHook(() =>
      useSubscriptionCatalogPrice({
        productKey: ProductKey.Tier1,
        addonQuantity: 0,
        interval: "year",
      }),
    );

    await waitFor(() => expect(partial).toHaveBeenCalled());
    expect(partialResult.current.price).toBeUndefined();
  });
});
