import { ReactNode } from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  MultiSelectUserFeedProvider,
  useMultiSelectUserFeedContext,
} from "./MultiSelectUserFeedContext";
import { UserFeedSummary } from "../types/UserFeedSummary";
import { UserFeedHealthStatus } from "../types/UserFeedHealthStatus";
import { UserFeedComputedStatus } from "../types/UserFeedComputedStatus";

function feed(id: string): UserFeedSummary {
  return {
    id,
    title: `Feed ${id}`,
    url: `https://example.com/${id}`,
    createdAt: new Date().toISOString(),
    healthStatus: UserFeedHealthStatus.Ok,
    computedStatus: UserFeedComputedStatus.Ok,
    ownedByUser: true,
    connectionCount: 0,
  };
}

function selectAll(feeds: UserFeedSummary[]): Record<string, boolean> {
  return feeds.reduce(
    (acc, f) => {
      acc[f.id] = true;

      return acc;
    },
    {} as Record<string, boolean>,
  );
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <MultiSelectUserFeedProvider>{children}</MultiSelectUserFeedProvider>
);

describe("MultiSelectUserFeedContext", () => {
  it("retains selected feeds after paging to a different loaded page", () => {
    const pageOne = [feed("a"), feed("b"), feed("c")];

    const { result } = renderHook(() => useMultiSelectUserFeedContext(), {
      wrapper,
    });

    act(() => result.current.setLoadedFeeds(pageOne));
    act(() => result.current.setRowSelection(selectAll(pageOne)));

    expect(result.current.selectedFeeds.map((f) => f.id)).toEqual([
      "a",
      "b",
      "c",
    ]);

    act(() => result.current.setLoadedFeeds([feed("x"), feed("y")]));

    expect(result.current.selectedFeedIds).toEqual(["a", "b", "c"]);
    expect(result.current.selectedFeeds.map((f) => f.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("retains a selection while a later page is loaded", () => {
    const deletedPage = [feed("a"), feed("b"), feed("c")];
    const survivorPage = [feed("x"), feed("y")];

    const { result } = renderHook(() => useMultiSelectUserFeedContext(), {
      wrapper,
    });

    act(() => result.current.setLoadedFeeds(deletedPage));
    act(() => result.current.setRowSelection(selectAll(deletedPage)));
    expect(result.current.selectedFeeds).toHaveLength(3);

    act(() => result.current.setLoadedFeeds(survivorPage));

    expect(result.current.selectedFeedIds).toEqual(["a", "b", "c"]);
    expect(result.current.selectedFeeds.map((f) => f.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("selects the new page when the user re-selects after the list changed (regression)", () => {
    // The bug: a select-all performed right after the post-delete refetch
    // resolved the toggle against the just-deleted rows, so the selection came
    // out empty and the Feed Actions trigger stayed disabled. Here the toggle is
    // applied to the NEW loaded page and must select exactly those feeds.
    const deletedPage = [feed("a"), feed("b"), feed("c")];
    const survivorPage = [feed("x"), feed("y")];

    const { result } = renderHook(() => useMultiSelectUserFeedContext(), {
      wrapper,
    });

    act(() => result.current.setLoadedFeeds(deletedPage));
    act(() => result.current.setRowSelection(selectAll(deletedPage)));

    // The list refetches to the survivors.
    act(() => result.current.setLoadedFeeds(survivorPage));
    expect(result.current.selectedFeedIds).toEqual(["a", "b", "c"]);

    // The user adds the next page to the existing selection.
    act(() =>
      result.current.setRowSelection((previous) => ({
        ...previous,
        ...selectAll(survivorPage),
      })),
    );

    expect(result.current.selectedFeedIds).toEqual(["a", "b", "c", "x", "y"]);
    expect(result.current.selectedFeeds.map((f) => f.id)).toEqual([
      "a",
      "b",
      "c",
      "x",
      "y",
    ]);
  });

  it("clearSelection empties the selection", () => {
    const page = [feed("a"), feed("b")];

    const { result } = renderHook(() => useMultiSelectUserFeedContext(), {
      wrapper,
    });

    act(() => result.current.setLoadedFeeds(page));
    act(() => result.current.setRowSelection(selectAll(page)));
    expect(result.current.selectedFeeds).toHaveLength(2);

    act(() => result.current.clearSelection());

    expect(result.current.selectedFeeds).toHaveLength(0);
  });

  it("supports all-matching selection with matchingFilters and matchingTotal", () => {
    const { result } = renderHook(() => useMultiSelectUserFeedContext(), {
      wrapper,
    });

    act(() => result.current.setSelectAllMatching(true));
    act(() =>
      result.current.setMatchingFilters({
        search: "Alpha",
        filters: { computedStatuses: ["OK"] },
        workspaceId: "ws1",
      }),
    );
    act(() => result.current.setMatchingTotal(842));

    expect(result.current.selectAllMatching).toBe(true);
    expect(result.current.matchingFilters).toEqual({
      search: "Alpha",
      filters: { computedStatuses: ["OK"] },
      workspaceId: "ws1",
    });
    expect(result.current.matchingTotal).toBe(842);
  });

  it("clearSelection also clears all-matching state", () => {
    const { result } = renderHook(() => useMultiSelectUserFeedContext(), {
      wrapper,
    });

    act(() => result.current.setSelectAllMatching(true));
    act(() =>
      result.current.setMatchingFilters({
        search: "Alpha",
        workspaceId: "ws1",
      }),
    );
    act(() => result.current.setRowSelection({ a: true }));
    expect(result.current.selectAllMatching).toBe(true);

    act(() => result.current.clearSelection());

    expect(result.current.selectAllMatching).toBe(false);
    expect(result.current.matchingFilters).toBeNull();
    expect(result.current.rowSelection).toEqual({});
  });

  it("announces all-matching selection via matchingTotal", () => {
    const { result } = renderHook(() => useMultiSelectUserFeedContext(), {
      wrapper,
    });

    act(() => result.current.setMatchingTotal(1100));
    act(() => result.current.setSelectAllMatching(true));

    expect(result.current.matchingTotal.toLocaleString()).toBe("1,100");
  });
});
