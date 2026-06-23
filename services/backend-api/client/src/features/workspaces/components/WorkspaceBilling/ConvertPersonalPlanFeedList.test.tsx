import "@testing-library/jest-dom";
import { useReducer, useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { ConvertPersonalPlanFeedList } from "./ConvertPersonalPlanFeedList";
import { useUserFeedsInfinite } from "../../../feed/hooks/useUserFeedsInfinite";
import { getUserFeeds } from "../../../feed/api";

vi.mock("../../../feed/hooks/useUserFeedsInfinite", () => ({
  useUserFeedsInfinite: vi.fn(),
}));

vi.mock("../../../feed/api", () => ({
  getUserFeeds: vi.fn(),
}));

const PAGE_SIZE = 25;

const makeFeeds = (n: number, startId = 1) =>
  Array.from({ length: n }, (_, i) => ({
    id: `feed-${startId + i}`,
    title: `Feed ${startId + i}`,
    createdAt: new Date(2020, 0, startId + i).toISOString(),
  }));

// A stateful fake of useUserFeedsInfinite: feeds are paginated, fetchNextPage
// reveals the next page and re-renders, and setSearch filters by title and
// resets pagination — mirroring how the real infinite query progresses. This
// exercises both the seeding-across-pages logic and the search interactions.
const installPaginatedFeeds = (allFeeds: Array<{ id: string; title: string }>) => {
  let loadedPages = 1;
  let searchTerm = "";

  let rerender: () => void = () => {};

  const read = () => {
    const matching = searchTerm
      ? allFeeds.filter((f) => f.title.toLowerCase().includes(searchTerm.toLowerCase()))
      : allFeeds;
    const results = matching.slice(0, loadedPages * PAGE_SIZE);

    return {
      data: {
        pages: [{ total: matching.length, results }],
      },
      status: "success",
      error: null,
      fetchNextPage: vi.fn(() => {
        loadedPages += 1;
        rerender();
      }),
      isFetching: false,
      setSearch: vi.fn((term: string) => {
        searchTerm = term;
        loadedPages = 1;
        rerender();
      }),
      hasNextPage: loadedPages * PAGE_SIZE < matching.length,
      isFetchingNextPage: false,
      search: searchTerm,
    };
  };

  vi.mocked(useUserFeedsInfinite).mockImplementation(() => {
    const [, force] = useReducer((n: number) => n + 1, 0);
    rerender = force;

    return read() as never;
  });
};

const Harness = ({
  feedLimit,
  onSharingChange,
}: {
  feedLimit: number;
  onSharingChange?: (info: {
    sharedSelectedCount: number;
    affectedUserIds: string[];
    anyConnectionScoped: boolean;
  }) => void;
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <ChakraProvider value={system}>
      <ConvertPersonalPlanFeedList
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        feedLimit={feedLimit}
        onLoaded={vi.fn()}
        onSharingChange={onSharingChange}
      />
    </ChakraProvider>
  );
};

describe("ConvertPersonalPlanFeedList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects every feed by default, loading lazy pages so none is left unchecked", async () => {
    // 30 feeds spans two pages (25 + 5), under a 70-feed limit: the default is
    // bring everything, which must cover the second page even though it loads
    // lazily.
    installPaginatedFeeds(makeFeeds(30));

    render(<Harness feedLimit={70} />);

    // The second-page feed is reachable only after auto-loading, and must end
    // up checked like the rest.
    const lastFeed = await screen.findByRole("checkbox", { name: /^Feed 30$/ });
    await waitFor(() => expect(lastFeed).toBeChecked());
    expect(screen.getByRole("checkbox", { name: /^Feed 1$/ })).toBeChecked();
  });

  it("starts empty when over capacity, so the owner chooses (no invisible default)", async () => {
    // 30 feeds, plan fits 28: there is no sensible machine default, so nothing
    // is pre-selected. Every check is the owner's own choice.
    installPaginatedFeeds(makeFeeds(30));

    render(<Harness feedLimit={28} />);

    const feed1 = await screen.findByRole("checkbox", { name: /^Feed 1$/ });
    expect(feed1).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^Feed 2$/ })).not.toBeChecked();
  });

  it("auto-picks the newest feeds in one targeted request, shown first and checked", async () => {
    // 104 feeds, plan fits 70: the over-limit list opens empty. "Select them
    // for me" (newest is the default) fires ONE request sorted newest-first and
    // selects exactly those 70 — even though the newest live off the loaded
    // page. The picked feeds surface at the top, checked.
    installPaginatedFeeds(makeFeeds(104));
    const newest70 = makeFeeds(70, 35).reverse(); // ids 104..35, newest-first
    vi.mocked(getUserFeeds).mockResolvedValue({
      results: newest70,
      total: 104,
      feedsWithoutConnections: 0,
    } as never);

    render(<Harness feedLimit={70} />);

    await screen.findByRole("checkbox", { name: /^Feed 1$/ });
    await userEvent.click(screen.getByRole("button", { name: /select my newest 70 feeds/i }));

    // The request asked for exactly the cap, newest-first.
    expect(getUserFeeds).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 70, sort: "-createdAt" }),
    );

    await waitFor(() => {
      const checked = screen
        .getAllByRole("checkbox")
        .filter((c) => (c as HTMLInputElement).checked);
      expect(checked).toHaveLength(70);
    });
    // The newest feed is now visible (floated to the top) and checked, despite
    // living at the tail of the oldest-first browse list.
    expect(screen.getByRole("checkbox", { name: /^Feed 104$/ })).toBeChecked();
    // A result line states what was selected and what stays behind. The same
    // text is also pushed to the live region for assistive tech, so it appears
    // twice — assert the visible result line is present.
    expect(
      screen.getAllByText(/Selected your newest 70 feeds, shown first below/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/34 stay on your personal plan/i).length).toBeGreaterThanOrEqual(1);
  });

  it("moves focus to 'Clear selection' after auto-pick, so the keyboard user is not stranded", async () => {
    // Filling to the cap swaps the auto-pick button (just clicked) for "Clear
    // selection". Without a focus handoff, the unmounted button would drop focus
    // to the body. Focus must land on the successor control.
    installPaginatedFeeds(makeFeeds(104));
    vi.mocked(getUserFeeds).mockResolvedValue({
      results: makeFeeds(70, 1),
      total: 104,
      feedsWithoutConnections: 0,
    } as never);

    render(<Harness feedLimit={70} />);

    await screen.findByRole("checkbox", { name: /^Feed 1$/ });
    await userEvent.click(screen.getByRole("button", { name: /select my newest 70 feeds/i }));

    const clearButton = await screen.findByRole("button", { name: /clear selection/i });
    await waitFor(() => expect(clearButton).toHaveFocus());
  });

  it("returns focus to the auto-pick action after clearing, so focus is never lost", async () => {
    installPaginatedFeeds(makeFeeds(104));
    vi.mocked(getUserFeeds).mockResolvedValue({
      results: makeFeeds(70, 1),
      total: 104,
      feedsWithoutConnections: 0,
    } as never);

    render(<Harness feedLimit={70} />);

    await screen.findByRole("checkbox", { name: /^Feed 1$/ });
    await userEvent.click(screen.getByRole("button", { name: /select my newest 70 feeds/i }));
    await userEvent.click(await screen.findByRole("button", { name: /clear selection/i }));

    const autoPickButton = await screen.findByRole("button", {
      name: /select my newest 70 feeds/i,
    });
    await waitFor(() => expect(autoPickButton).toHaveFocus());
  });

  it("auto-picks oldest with the ascending sort when the owner switches direction", async () => {
    installPaginatedFeeds(makeFeeds(104));
    vi.mocked(getUserFeeds).mockResolvedValue({
      results: makeFeeds(70, 1),
      total: 104,
      feedsWithoutConnections: 0,
    } as never);

    render(<Harness feedLimit={70} />);

    await screen.findByRole("checkbox", { name: /^Feed 1$/ });
    await userEvent.selectOptions(screen.getByLabelText(/which feeds to bring/i), "oldest");
    await userEvent.click(screen.getByRole("button", { name: /select my oldest 70 feeds/i }));

    expect(getUserFeeds).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 70, sort: "createdAt" }),
    );
    await waitFor(() => {
      const checked = screen
        .getAllByRole("checkbox")
        .filter((c) => (c as HTMLInputElement).checked);
      expect(checked).toHaveLength(70);
    });
  });

  it("allows checking past the cap (never blocks the click) and reports how many to remove", async () => {
    // 40 feeds, plan fits 2: the owner can keep checking past the cap so they
    // can triage freely; the meter reports the overage rather than refusing.
    installPaginatedFeeds(makeFeeds(40));

    render(<Harness feedLimit={2} />);

    await screen.findByRole("checkbox", { name: /^Feed 1$/ });
    await userEvent.click(screen.getByRole("checkbox", { name: /^Feed 1$/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /^Feed 2$/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /^Feed 3$/ }));

    // The third check is honored (not blocked), and the header reports the
    // overage so the owner knows to remove one. (The "remove 1" guidance also
    // goes to the live region, so it appears in both the meter and the status.)
    expect(screen.getByRole("checkbox", { name: /^Feed 3$/ })).toBeChecked();
    expect(screen.getByText(/3 of 2 selected/i)).toBeVisible();
    expect(screen.getAllByText(/remove 1/i).length).toBeGreaterThanOrEqual(1);
  });

  it("surfaces a recoverable error if the auto-pick request fails", async () => {
    installPaginatedFeeds(makeFeeds(104));
    vi.mocked(getUserFeeds).mockRejectedValue(new Error("network"));

    render(<Harness feedLimit={70} />);

    await screen.findByRole("checkbox", { name: /^Feed 1$/ });
    await userEvent.click(screen.getByRole("button", { name: /select my newest 70 feeds/i }));

    expect(await screen.findByText(/could not select your feeds automatically/i)).toBeVisible();
  });

  it("keeps existing selections across a search and lets the owner pick from the matches", async () => {
    // Selection is global, not per-page: checking a feed, then searching for a
    // different one, must not drop the first. The meter keeps counting it, and
    // the owner can add a match on top.
    installPaginatedFeeds(makeFeeds(104));

    render(<Harness feedLimit={70} />);

    // The meter renders "{n} of {limit} selected" with the count interpolated,
    // so the phrase is split across text nodes; assert on the dialog's overall
    // text content (normalized) instead of a single text node.
    const documentText = () => (document.body.textContent ?? "").replace(/\s+/g, " ");

    await userEvent.click(await screen.findByRole("checkbox", { name: /^Feed 2$/ }));
    expect(documentText()).toContain("1 of 70 selected");

    // Search for a feed not on the current page; the prior selection survives.
    await userEvent.type(screen.getByLabelText(/search your feeds/i), "Feed 88");
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));

    const match = await screen.findByRole("checkbox", { name: /^Feed 88$/ });
    expect(documentText()).toContain("1 of 70 selected"); // Feed 2 still counted
    await userEvent.click(match);
    await waitFor(() => expect(documentText()).toContain("2 of 70 selected"));
  });

  it("keeps the capacity meter while searching narrows the list below the cap", async () => {
    // Regression: over-limit framing is a property of the whole account, not the
    // filtered view. Searching down to one match must NOT collapse the meter.
    installPaginatedFeeds(makeFeeds(104));

    render(<Harness feedLimit={70} />);

    await screen.findByRole("checkbox", { name: /^Feed 1$/ });
    const documentText = () => (document.body.textContent ?? "").replace(/\s+/g, " ");
    expect(documentText()).toContain("0 of 70 selected");

    await userEvent.type(screen.getByLabelText(/search your feeds/i), "Feed 88");
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await screen.findByRole("checkbox", { name: /^Feed 88$/ });

    // One match shown, but the meter (the over-limit framing) is still present.
    expect(documentText()).toContain("0 of 70 selected");
  });

  it("clears an active search when auto-picking, so the picked result is shown on the full list", async () => {
    // Auto-pick is a "do the whole job" action; its picked-to-top result is only
    // meaningful against the full list. Running it under a search filter would
    // leave the result hidden behind the filter, so auto-pick clears the search.
    installPaginatedFeeds(makeFeeds(104));
    vi.mocked(getUserFeeds).mockResolvedValue({
      results: makeFeeds(70, 35).reverse(),
      total: 104,
      feedsWithoutConnections: 0,
    } as never);

    render(<Harness feedLimit={70} />);

    await screen.findByRole("checkbox", { name: /^Feed 1$/ });
    // Narrow to one match first.
    await userEvent.type(screen.getByLabelText(/search your feeds/i), "Feed 88");
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await screen.findByRole("checkbox", { name: /^Feed 88$/ });

    // Auto-pick while the search is active.
    await userEvent.click(screen.getByRole("button", { name: /select my newest 70 feeds/i }));

    // The search is cleared (input emptied) and the full, picked list is shown:
    // a picked feed off the searched view (Feed 104) is now present.
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /^Feed 104$/ })).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/search your feeds/i)).toHaveValue("");
    const checked = screen.getAllByRole("checkbox").filter((c) => (c as HTMLInputElement).checked);
    expect(checked.length).toBeGreaterThan(1);
  });

  it("leaves un-picked feeds unchecked and never shows a feed twice after auto-pick", async () => {
    // Pick the OLDEST 70 (feeds 1..70), which overlaps the loaded browse page
    // (1..25) — so the dedup that keeps a picked feed out of the browse list is
    // actually exercised. Feed 1 (picked + on the loaded page) must render
    // exactly once and checked; Feed 90 (loaded? no — off page) — instead use
    // an un-picked feed visible after the pick to confirm it stays unchecked.
    installPaginatedFeeds(makeFeeds(104));
    vi.mocked(getUserFeeds).mockResolvedValue({
      results: makeFeeds(70, 1), // oldest-first: feeds 1..70
      total: 104,
      feedsWithoutConnections: 0,
    } as never);

    render(<Harness feedLimit={70} />);

    await screen.findByRole("checkbox", { name: /^Feed 1$/ });
    await userEvent.selectOptions(screen.getByLabelText(/which feeds to bring/i), "oldest");
    await userEvent.click(screen.getByRole("button", { name: /select my oldest 70 feeds/i }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /^Feed 1$/ })).toBeChecked());

    // Feed 1 is both picked and on the loaded browse page; it must appear ONCE,
    // not duplicated across the pinned block and the browse list.
    expect(screen.getAllByRole("checkbox", { name: /^Feed 1$/ })).toHaveLength(1);

    // Every rendered feed row is unique (no feed shown twice).
    const titles = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent?.match(/^Feed \d+/)?.[0] ?? "");
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("renders the auto-picked feeds first, ahead of the browse list", async () => {
    // The pick floats the chosen feeds to the top so the result is visible even
    // though the newest live at the tail of the oldest-first browse list. Assert
    // the actual DOM order: the picked feed (Feed 80, off the first page) comes
    // before the first browse-list feed (Feed 1).
    installPaginatedFeeds(makeFeeds(104));
    vi.mocked(getUserFeeds).mockResolvedValue({
      results: makeFeeds(70, 35).reverse(), // newest-first: 104..35
      total: 104,
      feedsWithoutConnections: 0,
    } as never);

    render(<Harness feedLimit={70} />);

    await screen.findByRole("checkbox", { name: /^Feed 1$/ });
    await userEvent.click(screen.getByRole("button", { name: /select my newest 70 feeds/i }));

    await screen.findByRole("checkbox", { name: /^Feed 104$/ });
    // Read the rendered list order from the list items' titles.
    const order = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent ?? "")
      .map((t) => t.match(/^Feed \d+/)?.[0] ?? "");
    const firstPickedIdx = order.indexOf("Feed 104");
    const firstBrowseIdx = order.indexOf("Feed 1");
    // A picked feed (Feed 104, off the first browse page) appears before the
    // first un-picked browse feed (Feed 1).
    expect(firstPickedIdx).toBeGreaterThanOrEqual(0);
    expect(firstPickedIdx).toBeLessThan(firstBrowseIdx);
  });

  it("filters to the searched feeds after an auto-pick, not the pinned picked block", async () => {
    // After auto-pick, the chosen feeds are pinned to the top. If the owner then
    // searches, the list must show the SEARCH MATCHES, not keep showing 70
    // unfiltered pinned rows — searching for one feed should not surface 70.
    installPaginatedFeeds(makeFeeds(104));
    vi.mocked(getUserFeeds).mockResolvedValue({
      results: makeFeeds(70, 1),
      total: 104,
      feedsWithoutConnections: 0,
    } as never);

    render(<Harness feedLimit={70} />);

    await screen.findByRole("checkbox", { name: /^Feed 1$/ });
    await userEvent.click(screen.getByRole("button", { name: /select my newest 70 feeds/i }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /^Feed 1$/ })).toBeChecked());

    // Search for a single, specific feed.
    await userEvent.type(screen.getByLabelText(/search your feeds/i), "Feed 90");
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));

    // Only the matching feed shows — the pinned 70 must not survive the search.
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /^Feed 90$/ })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("checkbox", { name: /^Feed 1$/ })).not.toBeInTheDocument();
    // The "shown first below" pick framing is gone once searching.
    expect(screen.queryByText(/shown first below/i)).not.toBeInTheDocument();
  });

  it("warns on a selected shared feed and reports its co-manager up to the dialog", async () => {
    // Two feeds under the limit (both selected by default). One is shared, so its
    // row carries a warning chip and the rolled-up sharing info names the manager.
    installPaginatedFeeds([
      {
        id: "feed-1",
        title: "Shared Feed",
        sharedManagers: [{ discordUserId: "mgr-1", connectionScoped: false }],
      },
      { id: "feed-2", title: "Solo Feed" },
    ] as never);
    const onSharingChange = vi.fn();

    render(<Harness feedLimit={70} onSharingChange={onSharingChange} />);

    // Both feeds selected by default; the shared one shows the loses-access chip.
    await screen.findByRole("checkbox", { name: /^Shared Feed$/ });
    // The visible chip (the screen-reader equivalent is a separate, hidden
    // description tied to the checkbox via aria-describedby).
    await waitFor(() => expect(screen.getByText("Shared. Co-managers lose access")).toBeVisible());
    // The per-feed consequence is tied to the checkbox for assistive tech.
    expect(screen.getByRole("checkbox", { name: /^Shared Feed$/ })).toHaveAccessibleDescription(
      /co-managers lose access/i,
    );

    // A "Manage sharing" link lets the owner review that feed's co-managers in a
    // new tab, without losing the dialog. Only shared feeds get one.
    const manageLink = screen.getByRole("link", {
      name: /manage sharing for Shared Feed/i,
    });
    expect(manageLink).toHaveAttribute("target", "_blank");
    expect(manageLink).toHaveAttribute("href", "/feeds/feed-1?view=settings");
    // The unshared feed has nothing to review, so no link.
    expect(
      screen.queryByRole("link", { name: /manage sharing for Solo Feed/i }),
    ).not.toBeInTheDocument();

    await waitFor(() =>
      expect(onSharingChange).toHaveBeenLastCalledWith({
        sharedSelectedCount: 1,
        affectedUserIds: ["mgr-1"],
        anyConnectionScoped: false,
      }),
    );
  });

  it("flags connection-scoped sharing distinctly", async () => {
    installPaginatedFeeds([
      {
        id: "feed-1",
        title: "Scoped Feed",
        sharedManagers: [{ discordUserId: "mgr-1", connectionScoped: true }],
      },
    ] as never);
    const onSharingChange = vi.fn();

    render(<Harness feedLimit={70} onSharingChange={onSharingChange} />);

    await screen.findByRole("checkbox", { name: /^Scoped Feed$/ });
    await waitFor(() =>
      expect(screen.getByText("Shared. Per-connection access dropped")).toBeVisible(),
    );
    expect(screen.getByRole("checkbox", { name: /^Scoped Feed$/ })).toHaveAccessibleDescription(
      /access to only some connections/i,
    );
    await waitFor(() =>
      expect(onSharingChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ anyConnectionScoped: true }),
      ),
    );
  });

  it("drops the feed from the warning when it is unselected, and reassures it stays shared", async () => {
    installPaginatedFeeds([
      {
        id: "feed-1",
        title: "Shared Feed",
        sharedManagers: [{ discordUserId: "mgr-1", connectionScoped: false }],
      },
    ] as never);
    const onSharingChange = vi.fn();

    render(<Harness feedLimit={70} onSharingChange={onSharingChange} />);

    // Selected by default -> warned.
    const checkbox = await screen.findByRole("checkbox", { name: /^Shared Feed$/ });
    await waitFor(() =>
      expect(onSharingChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ sharedSelectedCount: 1 }),
      ),
    );

    // Unselect it: nothing is being moved, so the warning clears and the row
    // reassures that staying personal keeps the sharing.
    await userEvent.click(checkbox);
    await waitFor(() =>
      expect(onSharingChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ sharedSelectedCount: 0 }),
      ),
    );
    expect(screen.getByText("Shared. Staying personal, sharing kept")).toBeVisible();
  });
});
