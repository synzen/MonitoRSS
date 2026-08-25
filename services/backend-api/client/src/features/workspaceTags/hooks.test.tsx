import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceTagFilter } from "./hooks";

const getWorkspaceTagsMock = vi.hoisted(() => vi.fn());

vi.mock("./api", () => ({
  createWorkspaceTag: vi.fn(),
  getWorkspaceTags: getWorkspaceTagsMock,
}));

function createWrapper(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const Location = () => {
    const location = useLocation();

    return <output data-testid="location">{location.search}</output>;
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        {children}
        <Location />
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { Wrapper, queryClient };
}

describe("useWorkspaceTagFilter", () => {
  beforeEach(() => {
    getWorkspaceTagsMock.mockClear();
    getWorkspaceTagsMock.mockResolvedValue({
      results: [
        { id: "tag-b", name: "Beta", color: "blue" },
        { id: "tag-a", name: "Alpha", color: "green" },
      ],
    });
  });

  it("restores valid IDs, removes stale IDs, and updates the shareable URL when cleared", async () => {
    const { Wrapper } = createWrapper(
      "/workspaces/team-a/feeds?search=release&tags=tag-a,deleted-tag",
    );
    const { result } = renderHook(() => useWorkspaceTagFilter("team-a"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.selectedTagIds).toEqual(["tag-a"]);

    await waitFor(() =>
      expect(document.querySelector('[data-testid="location"]')).toHaveTextContent(
        "?search=release&tags=tag-a",
      ),
    );

    act(() => result.current.onChange([]));
    await waitFor(() =>
      expect(document.querySelector('[data-testid="location"]')).toHaveTextContent(
        "?search=release",
      ),
    );
  });

  it("keeps tag catalog queries scoped by Team slug", async () => {
    const first = createWrapper("/workspaces/team-a/feeds");
    const second = createWrapper("/workspaces/team-b/feeds");

    renderHook(() => useWorkspaceTagFilter("team-a"), {
      wrapper: first.Wrapper,
    });
    renderHook(() => useWorkspaceTagFilter("team-b"), {
      wrapper: second.Wrapper,
    });

    await waitFor(() => expect(getWorkspaceTagsMock).toHaveBeenCalledTimes(2));
    expect(
      first.queryClient.getQueryCache().find(["workspace-tags", { workspaceSlug: "team-a" }]),
    ).toBeDefined();
    expect(
      second.queryClient.getQueryCache().find(["workspace-tags", { workspaceSlug: "team-b" }]),
    ).toBeDefined();
  });
});
