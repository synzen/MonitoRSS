import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedScopeProvider } from "../contexts/FeedScopeContext";
import { getUserFeeds } from "../api";
import { useOwnedPersonalFeeds } from "./useOwnedPersonalFeeds";

vi.mock("../api", () => ({
  getUserFeeds: vi.fn(),
}));

const emptyResult = {
  results: [],
  total: 0,
  feedsWithoutConnections: 0,
};

describe("useOwnedPersonalFeeds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserFeeds).mockResolvedValue(emptyResult);
  });

  it("queries only feeds owned in personal scope while rendered inside a workspace", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <FeedScopeProvider value={{ workspaceId: "workspace-1", workspaceSlug: "team" }}>
          {children}
        </FeedScopeProvider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useOwnedPersonalFeeds({ limit: 25 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(getUserFeeds).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { ownedByUser: true },
        limit: 25,
        offset: undefined,
        search: "",
        workspaceId: undefined,
      }),
    );

    await act(async () => {
      await result.current.getByAge("newest", 10);
    });

    expect(getUserFeeds).toHaveBeenLastCalledWith({
      filters: { ownedByUser: true },
      limit: 10,
      offset: 0,
      sort: "-createdAt",
    });
  });
});
