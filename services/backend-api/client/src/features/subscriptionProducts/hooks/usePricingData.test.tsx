import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  paddleContext: {
    getPricePreview: vi.fn(async () => []),
    getChargePreview: vi.fn(async () => ({ totalFormatted: "$0.00" })),
    isLoaded: false,
    hasLoadFailed: false,
  },
}));

vi.mock("../contexts/PaddleContext", () => ({
  usePaddleContext: vi.fn(() => h.paddleContext),
}));

vi.mock("../../discordUser", () => ({
  useUserMe: vi.fn(() => ({
    status: "success",
    error: undefined,
    data: {
      result: {
        subscription: { product: { key: "free" }, addons: [], billingInterval: "month" },
      },
    },
  })),
}));

// eslint-disable-next-line import/first
import { usePricingData } from "./usePricingData";

const Probe = () => {
  const { isLoading, hasError } = usePricingData({ isOpen: true });

  return (
    <div>
      <span data-testid="is-loading">{String(isLoading)}</span>
      <span data-testid="has-error">{String(hasError)}</span>
    </div>
  );
};

describe("usePricingData", () => {
  it("keeps the loading state while Paddle.js is still initializing", () => {
    h.paddleContext.isLoaded = false;
    h.paddleContext.hasLoadFailed = false;
    render(<Probe />);

    expect(screen.getByTestId("is-loading")).toHaveTextContent("true");
    expect(screen.getByTestId("has-error")).toHaveTextContent("false");
  });

  it("surfaces the error state when Paddle.js failed to initialize", () => {
    // The infinite-spinner incident: a definitive Paddle load failure (e.g. a
    // consent blocker) must resolve the spinner instead of spinning forever.
    h.paddleContext.isLoaded = false;
    h.paddleContext.hasLoadFailed = true;
    render(<Probe />);

    expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
    expect(screen.getByTestId("has-error")).toHaveTextContent("true");
  });

  it("resolves the loading state when Paddle is loaded and prices return", async () => {
    h.paddleContext.isLoaded = true;
    h.paddleContext.hasLoadFailed = false;
    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("has-error")).toHaveTextContent("false");
  });
});
