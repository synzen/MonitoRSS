import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CuratedFeed, CuratedCategory } from "../../types";
import { PricingDialogContext } from "../../../../contexts";
import { BrowseFeedsModal } from "./index";

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

function makeHighlightFeeds(): CuratedFeed[] {
  const feeds: CuratedFeed[] = [];

  mockCategories.forEach((cat) => {
    for (let i = 0; i < 3; i++) {
      feeds.push(
        makeFeed({
          url: `https://example.com/${cat.id}-${i}`,
          title: `${cat.label} Feed ${i}`,
          category: cat.id,
          popular: i === 0,
        })
      );
    }
  });

  return feeds;
}

function makeCategoryFeeds(categoryId: string, count: number): CuratedFeed[] {
  return Array.from({ length: count }, (_, i) =>
    makeFeed({
      url: `https://example.com/${categoryId}-feed-${i}`,
      title: `${categoryId} Feed ${i}`,
      category: categoryId,
      popular: i === 0,
    })
  );
}

const allHighlightFeeds = makeHighlightFeeds();

let overrideCategoryFeeds: CuratedFeed[] | null = null;

vi.mock("../../hooks", () => ({
  useCuratedFeeds: (options?: { search?: string; category?: string }) => {
    let feeds = allHighlightFeeds;

    if (options?.category) {
      feeds =
        overrideCategoryFeeds || allHighlightFeeds.filter((f) => f.category === options.category);
    } else if (options?.search) {
      const q = options.search.toLowerCase();
      feeds = allHighlightFeeds.filter((f) => f.title.toLowerCase().includes(q));
    }

    return {
      data: { feeds, categories: mockCategories },
      getHighlightFeeds: () =>
        mockCategories.map((cat) => ({
          category: cat,
          feeds: allHighlightFeeds.filter((f) => f.category === cat.id).slice(0, 3),
        })),
      getCategoryPreviewText: () => "",
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  },
  useUserFeeds: () => ({ data: { total: 5 } }),
  useCreateUserFeed: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("../../../discordUser", () => ({
  useDiscordUserMe: () => ({ data: { maxUserFeeds: 25 } }),
}));

const mockValidateUrl = vi.fn();

vi.mock("../../hooks/useCreateUserFeedUrlValidation", () => ({
  useCreateUserFeedUrlValidation: () => ({
    mutateAsync: mockValidateUrl,
    status: "idle",
    error: null,
    data: undefined,
    reset: vi.fn(),
  }),
}));

vi.mock("../../hooks/useFeedPreviewByUrl", () => ({
  useFeedPreviewByUrl: () => ({
    mutateAsync: vi.fn(),
    status: "idle",
    error: null,
    reset: vi.fn(),
    data: undefined,
  }),
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  feedActionStates: {} as Record<string, import("../../types/FeedActionState").FeedActionState>,
  isAtLimit: false,
  onAdd: vi.fn(),
};

const renderModal = (props: Partial<React.ComponentProps<typeof BrowseFeedsModal>> = {}) => {
  const user = userEvent.setup();
  const result = render(
    <ChakraProvider>
      <MemoryRouter>
        <PricingDialogContext.Provider value={{ onOpen: vi.fn() }}>
          <BrowseFeedsModal {...defaultProps} {...props} />
        </PricingDialogContext.Provider>
      </MemoryRouter>
    </ChakraProvider>
  );

  return { user, ...result };
};

describe("BrowseFeedsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    overrideCategoryFeeds = null;
  });

  describe("Modal structure", () => {
    it("renders title as h2", () => {
      renderModal();

      const heading = screen.getByRole("heading", { name: "Add a Feed", level: 2 });
      expect(heading).toBeInTheDocument();
    });

    it("renders feed limit bar", () => {
      renderModal();

      expect(screen.getByText(/Feed Limit/)).toBeInTheDocument();
    });

    it("renders search input", () => {
      renderModal();

      expect(screen.getByRole("search")).toBeInTheDocument();
    });

    it("renders category pills", () => {
      renderModal();

      expect(screen.getByRole("radiogroup", { name: "Feed categories" })).toBeInTheDocument();
    });
  });

  describe("Highlights view (All selected)", () => {
    it("shows 8 category sections with h3 headings", () => {
      renderModal();

      const headings = screen.getAllByRole("heading", { level: 3 });
      expect(headings).toHaveLength(8);

      mockCategories.forEach((cat) => {
        expect(screen.getByRole("heading", { name: cat.label, level: 3 })).toBeInTheDocument();
      });
    });

    it("each section shows exactly 3 feed cards", () => {
      renderModal();

      mockCategories.forEach((cat) => {
        const list = screen.getByRole("list", { name: `${cat.label} feeds` });
        const items = within(list).getAllByRole("listitem");
        expect(items).toHaveLength(3);
      });
    });

    it("See all button selects that category pill", async () => {
      const { user } = renderModal();

      const seeAllBtn = screen.getByRole("button", { name: "See all Gaming feeds" });
      await user.click(seeAllBtn);

      const gamingRadio = screen.getByRole("radio", { name: /Gaming/ });
      expect(gamingRadio).toHaveAttribute("aria-checked", "true");
    });

    it("Most added badge is hidden in highlights view", () => {
      renderModal();

      expect(screen.queryByText("Most added")).not.toBeInTheDocument();
    });

    it("domain text is hidden in highlights view", () => {
      renderModal();

      expect(screen.queryByText("example.com")).not.toBeInTheDocument();
    });

    it("each section has aria-labelledby pointing to heading", () => {
      renderModal();

      mockCategories.forEach((cat) => {
        const heading = screen.getByRole("heading", { name: cat.label, level: 3 });
        const section = heading.closest("section");
        expect(section).toHaveAttribute("aria-labelledby", heading.id);
      });
    });

    it("feed lists use role list with aria-label", () => {
      renderModal();

      mockCategories.forEach((cat) => {
        const list = screen.getByRole("list", { name: `${cat.label} feeds` });
        expect(list).toHaveAttribute("role", "list");
      });
    });
  });

  describe("Category view (specific pill selected)", () => {
    it("selecting a category pill shows that category's feeds", async () => {
      const { user } = renderModal();

      await user.click(screen.getByRole("radio", { name: /Gaming/ }));

      expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
      const list = screen.getByRole("list", { name: /Gaming feeds/ });
      expect(list).toBeInTheDocument();
    });

    it("shows Most added badge on popular feeds in category view", async () => {
      const { user } = renderModal();

      await user.click(screen.getByRole("radio", { name: /Gaming/ }));

      expect(screen.getByText("Most added")).toBeInTheDocument();
    });

    it("shows domain text in category view", async () => {
      const { user } = renderModal();

      await user.click(screen.getByRole("radio", { name: /Gaming/ }));

      const list = screen.getByRole("list", { name: /Gaming feeds/ });
      expect(within(list).getAllByText("example.com").length).toBeGreaterThan(0);
    });
  });

  describe("Category view with many feeds", () => {
    const manyFeeds = makeCategoryFeeds("gaming", 30);

    beforeEach(() => {
      overrideCategoryFeeds = manyFeeds;
    });

    it("shows first 20 feeds and Show more button when >20 feeds", async () => {
      const { user } = renderModal();

      await user.click(screen.getByRole("radio", { name: /Gaming/ }));

      const list = screen.getByRole("list", { name: /Gaming feeds/ });
      const items = within(list).getAllByRole("listitem");
      expect(items).toHaveLength(20);
      expect(screen.getByRole("button", { name: /Show more/ })).toBeInTheDocument();
    });

    it("Show more reveals next batch", async () => {
      const { user } = renderModal();

      await user.click(screen.getByRole("radio", { name: /Gaming/ }));
      await user.click(screen.getByRole("button", { name: /Show more/ }));

      const list = screen.getByRole("list", { name: /Gaming feeds/ });
      const items = within(list).getAllByRole("listitem");
      expect(items).toHaveLength(30);
    });

    it("Show more button disappears when all feeds shown", async () => {
      const { user } = renderModal();

      await user.click(screen.getByRole("radio", { name: /Gaming/ }));
      await user.click(screen.getByRole("button", { name: /Show more/ }));

      expect(screen.queryByRole("button", { name: /Show more/ })).not.toBeInTheDocument();
    });

    it("count text shows when total > 20", async () => {
      const { user } = renderModal();

      await user.click(screen.getByRole("radio", { name: /Gaming/ }));

      expect(screen.getByText("Showing 20 of 30 feeds")).toBeInTheDocument();
    });

    it("count text updates after Show more", async () => {
      const { user } = renderModal();

      await user.click(screen.getByRole("radio", { name: /Gaming/ }));
      await user.click(screen.getByRole("button", { name: /Show more/ }));

      expect(screen.getByText("Showing 30 of 30 feeds")).toBeInTheDocument();
    });
  });

  describe("Categories with few feeds", () => {
    it("shows all items, no Show more, no count text for <=20 feeds", async () => {
      const { user } = renderModal();

      await user.click(screen.getByRole("radio", { name: /Gaming/ }));

      const list = screen.getByRole("list", { name: /Gaming feeds/ });
      const items = within(list).getAllByRole("listitem");
      expect(items).toHaveLength(3);
      expect(screen.queryByRole("button", { name: /Show more/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/Showing .* of .* feeds/)).not.toBeInTheDocument();
    });
  });

  describe("initialCategory prop", () => {
    it("opens with specified category pre-selected", () => {
      renderModal({ initialCategory: "tech" });

      const techRadio = screen.getByRole("radio", { name: /Tech/ });
      expect(techRadio).toHaveAttribute("aria-checked", "true");

      expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    });

    it("re-opening with a different initialCategory selects the new category", () => {
      const { rerender } = renderModal({ initialCategory: "tech" });

      expect(screen.getByRole("radio", { name: /Tech/ })).toHaveAttribute("aria-checked", "true");

      rerender(
        <ChakraProvider>
          <MemoryRouter>
            <PricingDialogContext.Provider value={{ onOpen: vi.fn() }}>
              <BrowseFeedsModal {...defaultProps} initialCategory="tech" isOpen={false} />
            </PricingDialogContext.Provider>
          </MemoryRouter>
        </ChakraProvider>
      );

      rerender(
        <ChakraProvider>
          <MemoryRouter>
            <PricingDialogContext.Provider value={{ onOpen: vi.fn() }}>
              <BrowseFeedsModal {...defaultProps} initialCategory="sports" isOpen={true} />
            </PricingDialogContext.Provider>
          </MemoryRouter>
        </ChakraProvider>
      );

      expect(screen.getByRole("radio", { name: /Sports/ })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: /Tech/ })).toHaveAttribute("aria-checked", "false");
    });

    it("re-opening with no initialCategory shows highlights view", async () => {
      const { user, rerender } = renderModal({ initialCategory: "gaming" });

      expect(screen.getByRole("radio", { name: /Gaming/ })).toHaveAttribute("aria-checked", "true");

      rerender(
        <ChakraProvider>
          <MemoryRouter>
            <PricingDialogContext.Provider value={{ onOpen: vi.fn() }}>
              <BrowseFeedsModal {...defaultProps} initialCategory="gaming" isOpen={false} />
            </PricingDialogContext.Provider>
          </MemoryRouter>
        </ChakraProvider>
      );

      rerender(
        <ChakraProvider>
          <MemoryRouter>
            <PricingDialogContext.Provider value={{ onOpen: vi.fn() }}>
              <BrowseFeedsModal {...defaultProps} initialCategory={undefined} isOpen={true} />
            </PricingDialogContext.Provider>
          </MemoryRouter>
        </ChakraProvider>
      );

      expect(screen.getByRole("radio", { name: /All/ })).toHaveAttribute("aria-checked", "true");
      expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(8);
    });
  });

  describe("Search + pill interaction", () => {
    it("clicking a pill during search clears search and shows category feeds", async () => {
      const { user } = renderModal();

      const searchInput = screen.getByLabelText(/search/i);
      await user.type(searchInput, "test query");
      await user.click(screen.getByRole("button", { name: "Go" }));

      await user.click(screen.getByRole("radio", { name: /Gaming/ }));

      const gamingRadio = screen.getByRole("radio", { name: /Gaming/ });
      expect(gamingRadio).toHaveAttribute("aria-checked", "true");

      const list = screen.getByRole("list", { name: /Gaming feeds/ });
      expect(list).toBeInTheDocument();
    });
  });

  describe("Highlights view accessibility", () => {
    it("highlights view cards have no Add buttons", () => {
      renderModal();

      const allButtons = screen.getAllByRole("button");
      const addButtons = allButtons.filter((btn) =>
        btn.getAttribute("aria-label")?.match(/^Add .* feed$/)
      );
      expect(addButtons).toHaveLength(0);
    });
  });

  describe("Search in modal", () => {
    it("text search shows results with gray category tags", async () => {
      const { user } = renderModal();

      const searchInput = screen.getByLabelText(/search/i);
      await user.type(searchInput, "Gaming Feed 0");
      await user.click(screen.getByRole("button", { name: "Go" }));

      const list = screen.getByRole("list", { name: /search results/i });
      expect(within(list).getByText("Gaming")).toBeInTheDocument();
    });

    it("search results use progressive disclosure", async () => {
      const { user } = renderModal();

      const searchInput = screen.getByLabelText(/search/i);
      await user.type(searchInput, "Feed");
      await user.click(screen.getByRole("button", { name: "Go" }));

      const list = screen.getByRole("list", { name: /search results/i });
      expect(within(list).getAllByRole("listitem")).toHaveLength(20);
      expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /show more/i }));

      expect(within(list).getAllByRole("listitem")).toHaveLength(24);
      expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
    });

    it("during search, previously selected pill retains aria-checked", async () => {
      const { user } = renderModal();

      await user.click(screen.getByRole("radio", { name: /Gaming/ }));

      const searchInput = screen.getByLabelText(/search/i);
      await user.type(searchInput, "Feed");
      await user.click(screen.getByRole("button", { name: "Go" }));

      const gamingRadio = screen.getByRole("radio", { name: /Gaming/ });
      expect(gamingRadio).toHaveAttribute("aria-checked", "true");
    });

    it("URL validation happy path works inside modal", async () => {
      const { user } = renderModal();

      const searchInput = screen.getByLabelText(/search/i);
      await user.type(searchInput, "https://example.com/feed.xml{Enter}");

      expect(mockValidateUrl).toHaveBeenCalledWith({
        details: { url: "https://example.com/feed.xml" },
      });
    });
  });

  describe("Feed limit integration", () => {
    it("FeedLimitBar shown at top of modal body", () => {
      renderModal();

      const feedLimitText = screen.getByText(/Feed Limit/);
      expect(feedLimitText).toBeInTheDocument();

      const searchForm = screen.getByRole("search");
      const feedLimitElement = feedLimitText.closest('[role="status"]') || feedLimitText;
      const modalBody = searchForm.closest(".chakra-modal__body") || searchForm.parentElement;

      if (modalBody) {
        const children = Array.from(modalBody.querySelectorAll("*"));
        const limitIndex = children.indexOf(feedLimitElement);
        const searchIndex = children.indexOf(searchForm);
        expect(limitIndex).toBeLessThan(searchIndex);
      }
    });

    it("at limit: all Add buttons become disabled in category view", async () => {
      const { user } = renderModal({ isAtLimit: true });

      await user.click(screen.getByRole("radio", { name: /Gaming/ }));

      const disabledButtons = screen.getAllByRole("button", {
        name: /add .* feed, disabled, feed limit reached/i,
      });
      expect(disabledButtons.length).toBeGreaterThan(0);
      disabledButtons.forEach((btn) => {
        expect(btn).toHaveAttribute("aria-disabled", "true");
        expect(btn).toHaveTextContent("+ Add");
      });
    });
  });

  describe("Feed add flow", () => {
    it("clicking Add calls onAdd with feed object in category view", async () => {
      const onAdd = vi.fn();
      const { user } = renderModal({ onAdd });

      await user.click(screen.getByRole("radio", { name: /Gaming/ }));

      const firstFeed = allHighlightFeeds.find((f) => f.category === "gaming")!;
      await user.click(screen.getByRole("button", { name: `Add ${firstFeed.title} feed` }));

      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ url: firstFeed.url, title: firstFeed.title })
      );
    });

    it("adding state shows spinner on card in category view", async () => {
      const firstFeed = allHighlightFeeds.find((f) => f.category === "gaming")!;
      const { user } = renderModal({
        feedActionStates: { [firstFeed.url]: { status: "adding" } },
        initialCategory: "gaming",
      });

      const addingButton = screen.getByRole("button", {
        name: `Adding ${firstFeed.title} feed...`,
      });
      expect(addingButton).toBeInTheDocument();
      expect(addingButton).toHaveAttribute("aria-disabled", "true");
    });

    it("added state shows checkmark on card in category view", () => {
      const firstFeed = allHighlightFeeds.find((f) => f.category === "gaming")!;
      renderModal({
        feedActionStates: {
          [firstFeed.url]: { status: "added", settingsUrl: "/feeds/1", feedId: "1" },
        },
        initialCategory: "gaming",
      });

      const addedButton = screen.getByRole("button", {
        name: `${firstFeed.title} feed added`,
      });
      expect(addedButton).toBeInTheDocument();
    });

    it("error state shows error message and Retry button in category view", async () => {
      const onAdd = vi.fn();
      const firstFeed = allHighlightFeeds.find((f) => f.category === "gaming")!;
      const { user } = renderModal({
        onAdd,
        initialCategory: "gaming",
        feedActionStates: {
          [firstFeed.url]: { status: "error", message: "Network error" },
        },
      });

      const friendlyMessage = "This feed can't be reached right now. Try again later.";
      expect(screen.getByText(friendlyMessage)).toBeInTheDocument();
      expect(screen.getByText(friendlyMessage).closest('[role="alert"]')).toBeInTheDocument();

      const retryButton = screen.getByRole("button", { name: /retry/i });
      await user.click(retryButton);

      expect(onAdd).toHaveBeenCalled();
    });

    it("added feeds persist across category switches", async () => {
      const gamingFeed = allHighlightFeeds.find((f) => f.category === "gaming")!;
      const { user } = renderModal({
        feedActionStates: {
          [gamingFeed.url]: { status: "added", settingsUrl: "/feeds/1", feedId: "1" },
        },
        initialCategory: "gaming",
      });

      expect(
        screen.getByRole("button", { name: `${gamingFeed.title} feed added` })
      ).toBeInTheDocument();

      await user.click(screen.getByRole("radio", { name: /Anime/ }));
      await user.click(screen.getByRole("radio", { name: /Gaming/ }));

      expect(
        screen.getByRole("button", { name: `${gamingFeed.title} feed added` })
      ).toBeInTheDocument();
    });

    it("re-opening modal preserves Added states in category view", () => {
      const firstFeed = allHighlightFeeds.find((f) => f.category === "gaming")!;
      const feedActionStates = {
        [firstFeed.url]: { status: "added" as const, settingsUrl: "/feeds/1", feedId: "1" },
      };

      const { rerender } = renderModal({ feedActionStates, initialCategory: "gaming" });

      expect(
        screen.getByRole("button", { name: `${firstFeed.title} feed added` })
      ).toBeInTheDocument();

      rerender(
        <ChakraProvider>
          <MemoryRouter>
            <PricingDialogContext.Provider value={{ onOpen: vi.fn() }}>
              <BrowseFeedsModal
                {...defaultProps}
                feedActionStates={feedActionStates}
                initialCategory="gaming"
                isOpen={false}
              />
            </PricingDialogContext.Provider>
          </MemoryRouter>
        </ChakraProvider>
      );

      rerender(
        <ChakraProvider>
          <MemoryRouter>
            <PricingDialogContext.Provider value={{ onOpen: vi.fn() }}>
              <BrowseFeedsModal
                {...defaultProps}
                feedActionStates={feedActionStates}
                initialCategory="gaming"
                isOpen={true}
              />
            </PricingDialogContext.Provider>
          </MemoryRouter>
        </ChakraProvider>
      );

      expect(
        screen.getByRole("button", { name: `${firstFeed.title} feed added` })
      ).toBeInTheDocument();
    });
  });
});
