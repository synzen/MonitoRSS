import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedScopeProvider } from "../contexts/FeedScopeContext";
import { useUserFeedsInfinite } from "./useUserFeedsInfinite";

const getUserFeedsMock = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({
  getUserFeeds: getUserFeedsMock,
}));

function createWrapper(workspaceId: string, queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <FeedScopeProvider value={{ workspaceId }}>{children}</FeedScopeProvider>
    </QueryClientProvider>
  );

  return Wrapper;
}

describe("useUserFeedsInfinite tag cache scope", () => {
  beforeEach(() => {
    getUserFeedsMock.mockResolvedValue({
      results: [],
      total: 0,
      feedsWithoutConnections: 0,
    });
  });

  it("keeps filtered result caches separate for different Teams", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const input = { limit: 20, filters: { tagIds: ["tag-a"] } };

    renderHook(() => useUserFeedsInfinite(input), {
      wrapper: createWrapper("workspace-a", queryClient),
    });
    renderHook(() => useUserFeedsInfinite(input), {
      wrapper: createWrapper("workspace-b", queryClient),
    });

    await waitFor(() => expect(getUserFeedsMock).toHaveBeenCalledTimes(2));

    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey[1] as { input: { workspaceId?: string } });
    expect(keys.map((key) => key.input.workspaceId)).toEqual(
      expect.arrayContaining(["workspace-a", "workspace-b"]),
    );
  });
});
