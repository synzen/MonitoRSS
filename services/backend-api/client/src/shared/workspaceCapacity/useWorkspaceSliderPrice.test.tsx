import "@testing-library/jest-dom";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PRICE_IDS, ProductKey } from "@/constants";
import {
  useWorkspaceSliderPrice,
  WORKSPACE_BASE_FEEDS,
  feedCountToAddonQuantity,
} from "./useWorkspaceSliderPrice";

describe("feedCountToAddonQuantity", () => {
  it("is zero at or below the base feed count", () => {
    expect(feedCountToAddonQuantity(WORKSPACE_BASE_FEEDS)).toBe(0);
    expect(feedCountToAddonQuantity(WORKSPACE_BASE_FEEDS - 10)).toBe(0);
  });

  it("is the overage above the base feed count", () => {
    expect(feedCountToAddonQuantity(WORKSPACE_BASE_FEEDS + 30)).toBe(30);
    expect(feedCountToAddonQuantity(500)).toBe(500 - WORKSPACE_BASE_FEEDS);
  });
});

describe("useWorkspaceSliderPrice", () => {
  const setup = (feeds: number, interval: "month" | "year" = "month") => {
    const getChargePreview = vi.fn().mockResolvedValue({ totalFormatted: "$25.00" });
    const result = renderHook(
      (props: { feeds: number }) =>
        useWorkspaceSliderPrice({
          feeds: props.feeds,
          interval,
          baseWorkspacePrice: "$10.00",
          getChargePreview,
        }),
      { initialProps: { feeds } },
    );

    return { ...result, getChargePreview };
  };

  it("shows the base workspace price at the base feed count without a preview call", () => {
    const { result, getChargePreview } = setup(WORKSPACE_BASE_FEEDS);

    expect(result.current.price).toBe("$10.00");
    expect(getChargePreview).not.toHaveBeenCalled();
  });

  it("requests a Paddle preview of the base tier plus add-on feeds above the base", async () => {
    const { result, getChargePreview } = setup(WORKSPACE_BASE_FEEDS + 30);

    await waitFor(() => expect(getChargePreview).toHaveBeenCalled());
    expect(getChargePreview).toHaveBeenCalledWith([
      { priceId: PRICE_IDS[ProductKey.Tier2].month, quantity: 1 },
      { priceId: PRICE_IDS[ProductKey.Tier3Feed].month, quantity: 30 },
    ]);

    await waitFor(() => expect(result.current.price).toBe("$25.00"));
  });
});
