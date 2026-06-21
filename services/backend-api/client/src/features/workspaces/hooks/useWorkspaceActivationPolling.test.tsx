import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useWorkspaceActivationPolling } from "./useWorkspaceActivationPolling";

const pendingKey = (workspaceId: string) => `workspacePendingActivation:${workspaceId}`;

type Subscription = Parameters<typeof useWorkspaceActivationPolling>[0]["subscription"];

const tier2Subscription = { productKey: "tier2" } as unknown as Subscription;

// The hook renders under a QueryClientProvider in the app; a fresh client per
// render keeps each case isolated. (The feed-list refetch on activation is
// owned by useRefetchFeedsOnWorkspaceActivation, not this hook.)
const withQueryClient = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, wrapper };
};

describe("useWorkspaceActivationPolling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flags awaiting activation and persists it so a remount resumes confirming", () => {
    const { wrapper } = withQueryClient();
    const { result } = renderHook(
      () =>
        useWorkspaceActivationPolling({
          workspaceId: "workspace-1",
          subscription: null,
          refetch: vi.fn(),
        }),
      { wrapper },
    );

    expect(result.current.awaitingActivation).toBe(false);

    act(() => result.current.beginActivation());

    expect(result.current.awaitingActivation).toBe(true);
    expect(window.sessionStorage.getItem(pendingKey("workspace-1"))).not.toBeNull();
    expect(result.current.billingAnnouncement).toMatch(/confirming your subscription/i);
  });

  it("seeds awaiting from a persisted pending flag on first render", () => {
    window.sessionStorage.setItem(pendingKey("workspace-1"), "1");

    const { wrapper } = withQueryClient();
    const { result } = renderHook(
      () =>
        useWorkspaceActivationPolling({
          workspaceId: "workspace-1",
          subscription: null,
          refetch: vi.fn(),
        }),
      { wrapper },
    );

    expect(result.current.awaitingActivation).toBe(true);
  });

  it("polls the workspace read on an interval while awaiting activation", () => {
    const refetch = vi.fn();

    const { wrapper } = withQueryClient();
    const { result } = renderHook(
      () =>
        useWorkspaceActivationPolling({
          workspaceId: "workspace-1",
          subscription: null,
          refetch,
        }),
      { wrapper },
    );

    act(() => result.current.beginActivation());

    act(() => vi.advanceTimersByTime(1500));
    expect(refetch).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(1500));
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("announces activation complete and clears the flag once the subscription lands", async () => {
    const { wrapper } = withQueryClient();
    const { result, rerender } = renderHook(
      ({ subscription }) =>
        useWorkspaceActivationPolling({
          workspaceId: "workspace-1",
          subscription,
          refetch: vi.fn(),
        }),
      { initialProps: { subscription: null as Subscription }, wrapper },
    );

    act(() => result.current.beginActivation());
    expect(result.current.awaitingActivation).toBe(true);

    rerender({ subscription: tier2Subscription });

    await waitFor(() => {
      expect(result.current.billingAnnouncement).toMatch(/is now active/i);
    });
    expect(result.current.awaitingActivation).toBe(false);
    expect(window.sessionStorage.getItem(pendingKey("workspace-1"))).toBeNull();
  });

  it("stops polling once the subscription lands", () => {
    const refetch = vi.fn();

    const { wrapper } = withQueryClient();
    const { result, rerender } = renderHook(
      ({ subscription }) =>
        useWorkspaceActivationPolling({
          workspaceId: "workspace-1",
          subscription,
          refetch,
        }),
      { initialProps: { subscription: null as Subscription }, wrapper },
    );

    act(() => result.current.beginActivation());
    rerender({ subscription: tier2Subscription });
    refetch.mockClear();

    act(() => vi.advanceTimersByTime(3000));
    expect(refetch).not.toHaveBeenCalled();
  });
});
