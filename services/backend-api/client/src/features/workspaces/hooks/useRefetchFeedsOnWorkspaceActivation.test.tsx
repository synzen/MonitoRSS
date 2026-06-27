import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRefetchFeedsOnWorkspaceActivation } from "./useRefetchFeedsOnWorkspaceActivation";

type Subscription = Parameters<typeof useRefetchFeedsOnWorkspaceActivation>[0]["subscription"];

const tier2Subscription = { productKey: "tier2" } as unknown as Subscription;

const withQueryClient = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, wrapper };
};

describe("useRefetchFeedsOnWorkspaceActivation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refetches the feed list (all observers) when the subscription first appears", async () => {
    const { queryClient, wrapper } = withQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { rerender } = renderHook(
      ({ subscription }) => useRefetchFeedsOnWorkspaceActivation({ subscription }),
      { initialProps: { subscription: null as Subscription }, wrapper },
    );

    expect(invalidateSpy).not.toHaveBeenCalled();

    rerender({ subscription: tier2Subscription });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["user-feeds"],
        refetchType: "all",
      });
    });
  });

  it("does not refetch when the workspace was already subscribed on mount", () => {
    const { queryClient, wrapper } = withQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { rerender } = renderHook(
      ({ subscription }) => useRefetchFeedsOnWorkspaceActivation({ subscription }),
      { initialProps: { subscription: tier2Subscription }, wrapper },
    );

    rerender({ subscription: tier2Subscription });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("does not refetch on an unrelated re-render while still dormant", () => {
    const { queryClient, wrapper } = withQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { rerender } = renderHook(
      ({ subscription }) => useRefetchFeedsOnWorkspaceActivation({ subscription }),
      { initialProps: { subscription: null as Subscription }, wrapper },
    );

    rerender({ subscription: null });
    rerender({ subscription: null });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
