import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { SelectableUserFeedList } from "./SelectableUserFeedList";

const FEED_A = { id: "feed-a", title: "Feed A", url: "https://a.example.com/rss" };
const FEED_B = { id: "feed-b", title: "Feed B", url: "https://b.example.com/rss" };

let mockHasNextPage = false;
const mockFetchNextPage = vi.fn();

// FEED_B lives on a second page to simulate feeds revealed via "View more feeds".
vi.mock("../../hooks/useUserFeedsInfinite", () => ({
  useUserFeedsInfinite: () => ({
    data: {
      pages: [
        { total: 2, results: [FEED_A] },
        { total: 2, results: [FEED_B] },
      ],
    },
    status: "success",
    error: null,
    fetchNextPage: mockFetchNextPage,
    isFetching: false,
    setSearch: vi.fn(),
    hasNextPage: mockHasNextPage,
    isFetchingNextPage: false,
    search: "",
  }),
}));

interface RenderOptions {
  isSelectedAll?: boolean;
  selectedIds?: string[];
  excludedIds?: string[];
  onExcludedIdsChange?: (ids: string[]) => void;
  onSelectedIdsChange?: (ids: string[]) => void;
}

function renderList(opts: RenderOptions = {}) {
  const queryClient = new QueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <ChakraProvider value={system}>
        <SelectableUserFeedList
          selectedIds={opts.selectedIds ?? []}
          onSelectedIdsChange={opts.onSelectedIdsChange ?? vi.fn()}
          isSelectedAll={opts.isSelectedAll ?? false}
          onSelectAll={vi.fn()}
          excludedIds={opts.excludedIds ?? []}
          onExcludedIdsChange={opts.onExcludedIdsChange ?? vi.fn()}
          description="Target feeds"
        />
      </ChakraProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockHasNextPage = false;
  mockFetchNextPage.mockClear();
});

describe("SelectableUserFeedList", () => {
  it("checks every feed across pages by default when Select all is on", () => {
    renderList({ isSelectedAll: true, excludedIds: [] });

    expect(screen.getByRole("checkbox", { name: /Select all 2 matching feeds/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Feed A/ })).toBeChecked();
    // Feed B is on the second page (revealed via "View more feeds") and must also start checked.
    expect(screen.getByRole("checkbox", { name: /Feed B/ })).toBeChecked();
  });

  it("excludes a feed (instead of disabling) when unchecked under Select all", async () => {
    const onExcludedIdsChange = vi.fn();
    renderList({ isSelectedAll: true, excludedIds: [], onExcludedIdsChange });

    const feedA = screen.getByRole("checkbox", { name: /Feed A/ });
    expect(feedA).toBeEnabled();

    await userEvent.click(feedA);

    expect(onExcludedIdsChange).toHaveBeenCalledWith([FEED_A.id]);
  });

  it("renders an excluded feed as unchecked with an indeterminate master checkbox", () => {
    renderList({ isSelectedAll: true, excludedIds: [FEED_A.id] });

    expect(
      screen.getByRole("checkbox", { name: /Select all 2 matching feeds/ }),
    ).toBePartiallyChecked();
    expect(screen.getByRole("checkbox", { name: /Feed A/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Feed B/ })).toBeChecked();
  });

  it("shows an indeterminate master checkbox when only some feeds are selected manually", () => {
    renderList({ isSelectedAll: false, selectedIds: [FEED_A.id] });

    expect(
      screen.getByRole("checkbox", { name: /Select all 2 matching feeds/ }),
    ).toBePartiallyChecked();
    expect(screen.getByRole("checkbox", { name: /Feed A/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Feed B/ })).not.toBeChecked();
  });

  it("loads more feeds when View more feeds is clicked", async () => {
    mockHasNextPage = true;
    renderList({ isSelectedAll: true });

    await userEvent.click(screen.getByRole("button", { name: /View more feeds/ }));

    expect(mockFetchNextPage).toHaveBeenCalled();
  });
});
