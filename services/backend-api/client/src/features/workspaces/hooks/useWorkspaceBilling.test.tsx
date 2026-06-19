import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { useConvertWorkspaceBilling } from "./useWorkspaceBilling";
import { convertWorkspaceBilling } from "../api/workspaceBilling";

vi.mock("../api/workspaceBilling", () => ({
  convertWorkspaceBilling: vi.fn(),
}));

const mockConvert = convertWorkspaceBilling as ReturnType<typeof vi.fn>;

describe("useConvertWorkspaceBilling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates the workspace feed list so the converted feeds appear", async () => {
    mockConvert.mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useConvertWorkspaceBilling(), { wrapper });

    await result.current.mutateAsync({ workspaceSlug: "my-team", feedIds: ["feed-1"] });

    await waitFor(() => {
      const invalidatedKeys = invalidateSpy.mock.calls.map(
        (call) => (call[0] as { queryKey?: unknown })?.queryKey,
      );

      // The converted feeds re-home onto the workspace, so the user-feeds list
      // (which the workspace feeds page reads, scoped by workspaceId) must
      // refetch. Without this, the page shows the stale empty cached list.
      expect(invalidatedKeys).toContainEqual(["user-feeds"]);
    });
  });

  it("invalidates the workspace detail so billing state refreshes", async () => {
    mockConvert.mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useConvertWorkspaceBilling(), { wrapper });

    await result.current.mutateAsync({ workspaceSlug: "my-team", feedIds: ["feed-1"] });

    await waitFor(() => {
      const invalidatedKeys = invalidateSpy.mock.calls.map(
        (call) => (call[0] as { queryKey?: unknown })?.queryKey,
      );

      expect(invalidatedKeys).toContainEqual(["workspace"]);
    });
  });
});
