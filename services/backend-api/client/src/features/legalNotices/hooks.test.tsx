import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { captureException } from "@sentry/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { notifyError } from "@/utils/notifyError";
import { dismissLegalNotice, getApplicableLegalNotice } from "./api";
import { useApplicableLegalNotice, useDismissLegalNotice } from "./hooks";

vi.mock("./api", () => ({
  getApplicableLegalNotice: vi.fn(),
  dismissLegalNotice: vi.fn(),
}));
vi.mock("@/utils/notifyError", () => ({ notifyError: vi.fn() }));
vi.mock("@sentry/react", () => ({ captureException: vi.fn() }));

const noticeResponse = {
  result: null,
  serverTime: "2026-09-01T00:00:00.000Z",
  nextTransitionAt: "2026-09-01T00:01:00.000Z",
};

const withQueryClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { wrapper, queryClient };
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
      expect(vi.mocked(getApplicableLegalNotice).mock.calls.length).toBeGreaterThan(requestsBeforeFocus),
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

describe("useDismissLegalNotice", () => {
  beforeEach(() => {
    vi.mocked(dismissLegalNotice).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dismisses the notice and refreshes the applicable notice", async () => {
    const { wrapper, queryClient } = withQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useDismissLegalNotice(), { wrapper });

    await act(async () => result.current.mutate("2026-09-01"));

    await waitFor(() => expect(dismissLegalNotice).toHaveBeenCalledWith("2026-09-01"));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["applicable-legal-notice"],
    });
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("keeps the banner query and notifies when saving dismissal fails", async () => {
    const failure = new ApiAdapterError("Network error");
    vi.mocked(dismissLegalNotice).mockRejectedValue(failure);
    const { wrapper, queryClient } = withQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useDismissLegalNotice(), { wrapper });

    await act(async () => result.current.mutate("2026-09-01"));

    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(captureException).toHaveBeenCalledWith(failure);
    expect(notifyError).toHaveBeenCalledWith(
      expect.stringMatching(/dismissal/i),
      failure,
    );
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
