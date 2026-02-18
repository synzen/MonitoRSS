import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CuratedCategory, CuratedFeed } from "../features/feed/constants/curatedFeedData";
import { PricingDialogContext } from "../contexts";
import { UserFeeds } from "./UserFeeds";

const mockCategories: Array<CuratedCategory & { count: number }> = [
  { id: "gaming", label: "Gaming", count: 25 },
  { id: "specific-games", label: "Specific Games", count: 22 },
  { id: "anime", label: "Anime & Manga", count: 8 },
  { id: "tech", label: "Tech & Security", count: 15 },
  { id: "sports", label: "Sports", count: 12 },
  { id: "finance", label: "Finance & Crypto", count: 10 },
  { id: "news", label: "World News", count: 10 },
  { id: "entertainment", label: "Entertainment", count: 5 },
];

function makeFeed(overrides: Partial<CuratedFeed> & { url: string }): CuratedFeed {
  return {
    title: `Feed ${overrides.url}`,
    category: "gaming",
    domain: "example.com",
    description: `Description for ${overrides.url}`,
    ...overrides,
  };
}

const allFeeds: CuratedFeed[] = mockCategories.flatMap((cat) =>
  Array.from({ length: 3 }, (_, i) =>
    makeFeed({
      url: `https://example.com/${cat.id}-${i}`,
      title: `${cat.label} Feed ${i}`,
      category: cat.id,
    })
  )
);

const mockCreateUserFeed = vi.fn();
const mockUseUserFeedsReturn = vi.fn();

vi.mock("../features/feed", async () => {
  const actual = (await vi.importActual("../features/feed")) as Record<string, unknown>;

  return {
    ...actual,
    UserFeedsTable: () => <div data-testid="user-feeds-table" />,
    BrowseFeedsModal: ({
      isOpen,
      onClose,
      onAdd,
    }: {
      isOpen: boolean;
      onClose: () => void;
      onAdd: (feed: CuratedFeed) => void;
    }) =>
      isOpen ? (
        <div role="dialog">
          <span>Add a Feed</span>
          <button aria-label="Close" onClick={onClose}>
            Close
          </button>
          <button
            onClick={() =>
              onAdd({
                url: "https://example.com/test-feed",
                title: "Test Feed",
                category: "gaming",
                domain: "example.com",
                description: "A test feed",
              })
            }
          >
            Add test feed
          </button>
        </div>
      ) : null,
    CloneUserFeedDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
    FeedManagementInvitesDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
    useUserFeeds: () => mockUseUserFeedsReturn(),
    useDeleteUserFeeds: () => ({ mutateAsync: vi.fn() }),
    useDisableUserFeeds: () => ({ mutateAsync: vi.fn() }),
    useEnableUserFeeds: () => ({ mutateAsync: vi.fn() }),
    useUserFeedManagementInvitesCount: () => ({ data: { total: 0 } }),
    useCreateUserFeed: () => ({ mutateAsync: mockCreateUserFeed }),
    useCuratedFeeds: (options?: { search?: string; category?: string }) => {
      let feeds = allFeeds;

      if (options?.category) {
        feeds = allFeeds.filter((f) => f.category === options.category);
      } else if (options?.search) {
        const q = options.search.toLowerCase();
        feeds = allFeeds.filter((f) => f.title.toLowerCase().includes(q));
      }

      return {
        data: { feeds, categories: mockCategories },
        getHighlightFeeds: () =>
          mockCategories.map((cat) => ({
            category: cat,
            feeds: allFeeds.filter((f) => f.category === cat.id).slice(0, 3),
          })),
        getCategoryPreviewText: (categoryId: string) => {
          const catFeeds = allFeeds.filter((f) => f.category === categoryId);

          return catFeeds
            .slice(0, 3)
            .map((f) => f.title)
            .join(", ");
        },
        isLoading: false,
        error: null,
      };
    },
  };
});

vi.mock("../features/discordUser", () => ({
  useUserMe: () => ({ data: { result: { preferences: {} } } }),
  useDiscordUserMe: () => ({ data: { maxUserFeeds: 25 } }),
}));

vi.mock("../features/feed/hooks/useCreateUserFeedUrlValidation", () => ({
  useCreateUserFeedUrlValidation: () => ({
    mutateAsync: vi.fn(),
    status: "idle",
    error: null,
    data: undefined,
    reset: vi.fn(),
  }),
}));

vi.mock("../features/feed/components/CopyUserFeedSettingsDialog", () => ({
  CopyUserFeedSettingsDialog: () => null,
}));

vi.mock("../components/ReducedLimitAlert", () => ({
  ReducedLimitAlert: () => null,
}));

vi.mock("../features/feed/components/FeedLimitBar", () => ({
  FeedLimitBar: () => null,
}));

const renderPage = () => {
  const user = userEvent.setup();
  const result = render(
    <ChakraProvider>
      <MemoryRouter>
        <PricingDialogContext.Provider value={{ onOpen: vi.fn() }}>
          <UserFeeds />
        </PricingDialogContext.Provider>
      </MemoryRouter>
    </ChakraProvider>
  );

  return { user, ...result };
};

describe("UserFeeds — Discovery Mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserFeedsReturn.mockReturnValue({ data: { results: [], total: 0 } });
  });

  it("shows discovery UI when total is 0", () => {
    renderPage();
    expect(screen.getByText("Get news delivered to your Discord")).toBeInTheDocument();
    expect(
      screen.getByText("Browse popular feeds to get started, or paste any URL")
    ).toBeInTheDocument();
  });

  it("shows search bar in discovery mode", () => {
    renderPage();
    expect(screen.getByRole("search")).toBeInTheDocument();
  });

  it("shows category card grid with all categories plus Browse All", () => {
    renderPage();
    const categoryList = screen.getByRole("list", { name: "Feed categories" });
    const items = within(categoryList).getAllByRole("listitem");

    expect(items).toHaveLength(mockCategories.length + 1);
  });

  it("shows category cards as buttons with accessible names including preview text", () => {
    renderPage();
    const gamingButton = screen.getByRole("button", {
      name: /^Gaming —/,
    });

    expect(gamingButton).toBeInTheDocument();
  });

  it("shows category preview text from getCategoryPreviewText", () => {
    renderPage();
    expect(screen.getByText("Gaming Feed 0, Gaming Feed 1, Gaming Feed 2")).toBeInTheDocument();
  });

  it("shows Browse All card with feed count", () => {
    renderPage();
    expect(screen.getByText("Browse All")).toBeInTheDocument();
    expect(screen.getByText(`See all ${allFeeds.length} feeds →`)).toBeInTheDocument();
  });

  it("shows tip text", () => {
    renderPage();
    expect(screen.getByText(/Tip: Paste a YouTube channel/)).toBeInTheDocument();
  });

  it("does not show user feeds table in discovery mode", () => {
    renderPage();
    expect(screen.queryByTestId("user-feeds-table")).not.toBeInTheDocument();
  });

  it("does not show added count when no feeds have been added", () => {
    renderPage();
    expect(screen.queryByText(/feed.*added/i)).not.toBeInTheDocument();
  });
});

describe("UserFeeds — Category card interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserFeedsReturn.mockReturnValue({ data: { results: [], total: 0 } });
  });

  it("clicking a category card opens the browse modal", async () => {
    const { user } = renderPage();
    const gamingButton = screen.getByRole("button", {
      name: /^Gaming —/,
    });
    await user.click(gamingButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Add a Feed")).toBeInTheDocument();
  });

  it("clicking Browse All opens the modal", async () => {
    const { user } = renderPage();
    const browseAllButton = screen.getByText("Browse All").closest("button")!;
    await user.click(browseAllButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("UserFeeds — Search interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserFeedsReturn.mockReturnValue({ data: { results: [], total: 0 } });
  });

  it("hides category cards when search is active", async () => {
    const { user } = renderPage();
    const searchInput = screen.getByLabelText("Search popular feeds or paste a URL");

    await user.type(searchInput, "Gaming");
    await user.click(screen.getByRole("button", { name: "Go" }));

    expect(screen.queryByRole("list", { name: "Feed categories" })).not.toBeInTheDocument();
  });

  it("restores category cards when search is cleared", async () => {
    const { user } = renderPage();
    const searchInput = screen.getByLabelText("Search popular feeds or paste a URL");

    await user.type(searchInput, "Gaming");
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(screen.queryByRole("list", { name: "Feed categories" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("list", { name: "Feed categories" })).toBeInTheDocument();
  });

  it("hides tip text when search is active", async () => {
    const { user } = renderPage();
    const searchInput = screen.getByLabelText("Search popular feeds or paste a URL");

    await user.type(searchInput, "Gaming");
    await user.click(screen.getByRole("button", { name: "Go" }));

    expect(screen.queryByText(/Tip: Paste a YouTube channel/)).not.toBeInTheDocument();
  });
});

describe("UserFeeds — Feed adding & inline banner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserFeedsReturn.mockReturnValue({ data: { results: [], total: 0 } });
    mockCreateUserFeed.mockResolvedValue({ result: { id: "feed-123" } });
  });

  it("replaces hero text with success banner after adding a feed", async () => {
    const { user } = renderPage();
    const searchInput = screen.getByLabelText("Search popular feeds or paste a URL");

    await user.type(searchInput, "Gaming");
    await user.click(screen.getByRole("button", { name: "Go" }));

    const addButtons = screen.getAllByRole("button", { name: /^Add .+ feed$/ });
    await user.click(addButtons[0]);

    expect(screen.getByRole("heading", { level: 2, name: /1 feed added!/ })).toBeInTheDocument();
    expect(screen.queryByText("Get news delivered to your Discord")).not.toBeInTheDocument();
  });

  it("success banner is inside an aria-live region for screen reader announcements", async () => {
    const { user } = renderPage();
    const searchInput = screen.getByLabelText("Search popular feeds or paste a URL");

    await user.type(searchInput, "Gaming");
    await user.click(screen.getByRole("button", { name: "Go" }));

    const addButtons = screen.getAllByRole("button", { name: /^Add .+ feed$/ });
    await user.click(addButtons[0]);

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveTextContent("1 feed added!");
  });

  it("stays in discovery mode after adding a feed", async () => {
    const { user } = renderPage();
    const searchInput = screen.getByLabelText("Search popular feeds or paste a URL");

    await user.type(searchInput, "Gaming");
    await user.click(screen.getByRole("button", { name: "Go" }));

    const addButtons = screen.getAllByRole("button", { name: /^Add .+ feed$/ });
    await user.click(addButtons[0]);

    expect(screen.getByRole("heading", { level: 2, name: /1 feed added!/ })).toBeInTheDocument();
    expect(screen.queryByTestId("user-feeds-table")).not.toBeInTheDocument();
  });

  it("shows 'View your feeds' button in success banner", async () => {
    const { user } = renderPage();
    const searchInput = screen.getByLabelText("Search popular feeds or paste a URL");

    await user.type(searchInput, "Gaming");
    await user.click(screen.getByRole("button", { name: "Go" }));

    const addButtons = screen.getAllByRole("button", { name: /^Add .+ feed$/ });
    await user.click(addButtons[0]);

    expect(screen.getByRole("button", { name: /View your feeds/ })).toBeInTheDocument();
  });
});

describe("UserFeeds — Exit discovery mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateUserFeed.mockResolvedValue({ result: { id: "feed-123" } });
  });

  it("exits discovery mode and shows feed table when clicking 'View your feeds'", async () => {
    let totalFeeds = 0;
    mockUseUserFeedsReturn.mockImplementation(() => ({
      data: { results: [], total: totalFeeds },
    }));

    const { user, rerender } = renderPage();

    const searchInput = screen.getByLabelText("Search popular feeds or paste a URL");
    await user.type(searchInput, "Gaming");
    await user.click(screen.getByRole("button", { name: "Go" }));

    const addButtons = screen.getAllByRole("button", { name: /^Add .+ feed$/ });
    await user.click(addButtons[0]);

    totalFeeds = 1;

    await user.click(screen.getByRole("button", { name: /View your feeds/ }));

    expect(screen.queryByText("Get news delivered to your Discord")).not.toBeInTheDocument();
    expect(screen.getByTestId("user-feeds-table")).toBeInTheDocument();
  });
});

describe("UserFeeds — Non-discovery mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows feed table when user has feeds", () => {
    mockUseUserFeedsReturn.mockReturnValue({
      data: { results: [{ id: "1" }], total: 5 },
    });
    renderPage();

    expect(screen.getByTestId("user-feeds-table")).toBeInTheDocument();
    expect(screen.queryByText("Get news delivered to your Discord")).not.toBeInTheDocument();
  });

  it("re-enters discovery mode when all feeds are deleted", async () => {
    mockUseUserFeedsReturn.mockReturnValue({
      data: { results: [{ id: "1" }], total: 5 },
    });
    const { rerender } = renderPage();

    expect(screen.getByTestId("user-feeds-table")).toBeInTheDocument();

    mockUseUserFeedsReturn.mockReturnValue({
      data: { results: [], total: 0 },
    });
    rerender(
      <ChakraProvider>
        <MemoryRouter>
          <PricingDialogContext.Provider value={{ onOpen: vi.fn() }}>
            <UserFeeds />
          </PricingDialogContext.Provider>
        </MemoryRouter>
      </ChakraProvider>
    );

    expect(screen.getByText("Get news delivered to your Discord")).toBeInTheDocument();
    expect(screen.queryByTestId("user-feeds-table")).not.toBeInTheDocument();
  });
});

describe("UserFeeds — Returning user Add Feed button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserFeedsReturn.mockReturnValue({
      data: { results: [{ id: "1" }], total: 5 },
    });
    mockCreateUserFeed.mockResolvedValue({ result: { id: "feed-new" } });
  });

  it("'Add Feed' button opens browse modal", async () => {
    const { user } = renderPage();

    await user.click(screen.getByRole("button", { name: /Add Feed/ }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Add a Feed")).toBeInTheDocument();
  });

  it("dropdown still has 'Add multiple feeds' option", async () => {
    const { user } = renderPage();

    await user.click(screen.getByRole("button", { name: "Additional add feed options" }));

    expect(screen.getByText("Add multiple feeds")).toBeInTheDocument();
  });

  it("shows success banner when modal closed after adding feeds", async () => {
    const { user } = renderPage();

    await user.click(screen.getByRole("button", { name: /Add Feed/ }));
    await user.click(screen.getByText("Add test feed"));
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.getByText("1 feed added")).toBeInTheDocument();
    expect(
      screen.getByText("Click a feed to set up where articles are delivered.")
    ).toBeInTheDocument();
  });

  it("does not show success banner when modal closed without adding feeds", async () => {
    const { user } = renderPage();

    await user.click(screen.getByRole("button", { name: /Add Feed/ }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByText(/feed.* added/)).not.toBeInTheDocument();
  });
});
