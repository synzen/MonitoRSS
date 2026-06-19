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
  it("derives selectedFeeds as the selected ids intersected with the loaded feeds", () => {
    const pageOne = [feed("a"), feed("b"), feed("c")];

    const { result } = renderHook(() => useMultiSelectUserFeedContext(), {
      wrapper,
    });

    act(() => result.current.setLoadedFeeds(pageOne));
    act(() => result.current.setRowSelection(selectAll(pageOne)));

    expect(result.current.selectedFeeds.map((f) => f.id)).toEqual(["a", "b", "c"]);
  });

  it("drops feeds that leave the loaded list without clearing the rest of the selection", () => {
    // Models a bulk delete: the whole loaded page is selected, then the list
    // refetches to a DISJOINT page (the survivors that shifted up into offset 0).
    // The previous selection ids no longer match any loaded feed, so the derived
    // selection is empty — but no stale references linger.
    const deletedPage = [feed("a"), feed("b"), feed("c")];
    const survivorPage = [feed("x"), feed("y")];

    const { result } = renderHook(() => useMultiSelectUserFeedContext(), {
      wrapper,
    });

    act(() => result.current.setLoadedFeeds(deletedPage));
    act(() => result.current.setRowSelection(selectAll(deletedPage)));
    expect(result.current.selectedFeeds).toHaveLength(3);

    act(() => result.current.setLoadedFeeds(survivorPage));

    expect(result.current.selectedFeeds).toHaveLength(0);
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
    expect(result.current.selectedFeeds).toHaveLength(0);

    // The user selects all again on the survivors.
    act(() => result.current.setRowSelection(selectAll(survivorPage)));

    expect(result.current.selectedFeeds.map((f) => f.id)).toEqual(["x", "y"]);
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
});
