import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getApplicableLegalNotice } from "./api";
import { useApplicableLegalNotice } from "./hooks";

vi.mock("./api", () => ({ getApplicableLegalNotice: vi.fn() }));

const noticeResponse = {
  result: null,
  serverTime: "2026-09-01T00:00:00.000Z",
  nextTransitionAt: "2026-09-01T00:01:00.000Z",
};

const withQueryClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { wrapper };
};

describe("useApplicableLegalNotice", () => {
  beforeEach(() => {
    vi.mocked(getApplicableLegalNotice).mockResolvedValue(noticeResponse);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes once when the server-reported transition arrives", async () => {
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    const { wrapper } = withQueryClient();
    const { result } = renderHook(() => useApplicableLegalNotice({ enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(noticeResponse));
    const scheduledRefresh = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 60_000)?.[0];
    await act(async () => (scheduledRefresh as () => void)());

    expect(getApplicableLegalNotice).toHaveBeenCalledTimes(2);
  });

  it("refreshes stale notice state when the window regains focus", async () => {
    const { wrapper } = withQueryClient();
    const { result } = renderHook(() => useApplicableLegalNotice({ enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(noticeResponse));
    const requestsBeforeFocus = vi.mocked(getApplicableLegalNotice).mock.calls.length;
    act(() => window.dispatchEvent(new Event("focus")));

    await waitFor(() =>
      expect(getApplicableLegalNotice.mock.calls.length).toBeGreaterThan(requestsBeforeFocus),
    );
  });

  it("does not schedule a refresh when the server has no pending transition", async () => {
    vi.mocked(getApplicableLegalNotice).mockResolvedValue({
      ...noticeResponse,
      nextTransitionAt: null,
    });
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    const { wrapper } = withQueryClient();
    const { result } = renderHook(() => useApplicableLegalNotice({ enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.data?.nextTransitionAt).toBeNull());

    expect(setTimeoutSpy.mock.calls.some(([, delay]) => delay === 60_000)).toBe(false);
  });
});
