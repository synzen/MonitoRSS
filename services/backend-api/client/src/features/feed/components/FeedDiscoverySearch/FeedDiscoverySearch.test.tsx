import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CuratedFeed } from "../../types";
import { FeedDiscoverySearch } from "./index";

const mockCategories = [
  { id: "gaming", label: "Gaming", count: 3 },
  { id: "tech", label: "Tech & Security", count: 2 },
];

const mockFeeds: CuratedFeed[] = [
  {
    url: "https://feeds.feedburner.com/ign/games",
    title: "IGN",
    category: "gaming",
    domain: "ign.com",
    description: "Gaming news",
    popular: true,
  },
  {
    url: "https://www.pcgamer.com/rss/",
    title: "PC Gamer",
    category: "gaming",
    domain: "pcgamer.com",
    description: "PC gaming news",
  },
  {
    url: "https://store.steampowered.com/feeds/news.xml",
    title: "Steam News",
    category: "gaming",
    domain: "store.steampowered.com",
    description: "Steam platform updates",
  },
  {
    url: "https://feeds.feedburner.com/TheHackersNews",
    title: "The Hacker News",
    category: "tech",
    domain: "thehackernews.com",
    description: "Cybersecurity news",
  },
  {
    url: "https://feeds.feedburner.com/TechCrunch",
    title: "TechCrunch",
    category: "tech",
    domain: "techcrunch.com",
    description: "Startup and tech coverage",
  },
];

function generateManyFeeds(count: number): CuratedFeed[] {
  return Array.from({ length: count }, (_, i) => ({
    url: `https://example.com/feed-${i}`,
    title: `Test Feed ${i}`,
    category: "gaming",
    domain: "example.com",
    description: `Description for feed ${i}`,
  }));
}

let mockSearchParam: string | undefined;

vi.mock("../../hooks", () => ({
  useCuratedFeeds: (options?: { search?: string; category?: string }) => {
    mockSearchParam = options?.search;
    let feeds = mockFeeds;

    if (options?.search) {
      const q = options.search.toLowerCase();
      feeds = mockFeeds
        .map((f) => {
          let score = 0;
          if (f.title.toLowerCase().startsWith(q)) score += 100;
          else if (f.title.toLowerCase().includes(q)) score += 75;
          if (f.domain.toLowerCase().includes(q)) score += 50;
          if (f.description.toLowerCase().includes(q)) score += 25;

          return { feed: f, score };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ feed }) => feed);
    }

    return {
      data: { feeds, categories: mockCategories },
      getHighlightFeeds: () => [],
      getCategoryPreviewText: () => "",
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  },
}));

const mockValidateUrl = vi.fn();
const mockResetValidation = vi.fn();

vi.mock("../../hooks/useCreateUserFeedUrlValidation", () => ({
  useCreateUserFeedUrlValidation: () => ({
    mutateAsync: mockValidateUrl,
    status: "idle",
    error: null,
    data: undefined,
    reset: mockResetValidation,
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

vi.mock("./UrlValidationResult", () => ({
  UrlValidationResult: (props: { url: string; validationStatus: string }) => (
    <div
      data-testid="url-validation-result"
      data-url={props.url}
      data-status={props.validationStatus}
    />
  ),
}));

const defaultProps = {
  feedActionStates: {} as Record<string, import("../../types/FeedActionState").FeedActionState>,
  isAtLimit: false,
  onAdd: vi.fn(),
};

const renderSearch = (props: Partial<React.ComponentProps<typeof FeedDiscoverySearch>> = {}) => {
  const user = userEvent.setup();

  const result = render(
    <ChakraProvider>
      <MemoryRouter>
        <FeedDiscoverySearch {...defaultProps} {...props} />
      </MemoryRouter>
    </ChakraProvider>
  );

  return { user, ...result };
};

describe("FeedDiscoverySearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParam = undefined;
  });

  describe("Search submission", () => {
    it("shows filtered results when typing text and pressing Enter", async () => {
      const { user } = renderSearch();

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "IGN{Enter}");

      expect(screen.getByText("1 result")).toBeInTheDocument();
      expect(screen.getByText("IGN")).toBeInTheDocument();
    });

    it("shows filtered results when typing text and clicking Go", async () => {
      const { user } = renderSearch();

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "IGN");
      await user.click(screen.getByRole("button", { name: "Go" }));

      expect(screen.getByText("1 result")).toBeInTheDocument();
      expect(screen.getByText("IGN")).toBeInTheDocument();
    });

    it("does not show results when typing without submitting", async () => {
      const { user } = renderSearch();

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "IGN");

      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("does not trigger results for empty/whitespace search", async () => {
      const { user } = renderSearch();

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "   {Enter}");

      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("clears active search when pressing Enter with empty input", async () => {
      const onSearchChange = vi.fn();
      const { user } = renderSearch({ onSearchChange });

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "IGN{Enter}");

      expect(screen.getByText("1 result")).toBeInTheDocument();

      await user.clear(input);
      await user.type(input, "{Enter}");

      expect(screen.queryByRole("list")).not.toBeInTheDocument();
      expect(onSearchChange).toHaveBeenLastCalledWith("");
    });
  });

  describe("Clear behavior", () => {
    it("clears input and results when clear button is clicked, and focuses input", async () => {
      const { user } = renderSearch();

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "IGN{Enter}");

      expect(screen.getByText("IGN")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Clear search" }));

      expect(input).toHaveValue("");
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
      expect(input).toHaveFocus();
    });

    it("hides clear button when input is empty", () => {
      renderSearch();

      expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
    });
  });

  describe("No matches", () => {
    it("shows no matches message when 0 results", async () => {
      const { user } = renderSearch();

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "zzzznonexistent{Enter}");

      expect(
        screen.getByText(
          "No matches in our popular feeds list. Many websites have feeds - try pasting a URL (e.g., a YouTube channel or news site) and we'll check automatically."
        )
      ).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has result count in aria-live polite container", async () => {
      const { user } = renderSearch();

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "game{Enter}");

      const liveRegions = document.querySelectorAll('[aria-live="polite"]');
      const hasResultCount = Array.from(liveRegions).some((el) =>
        el.textContent?.includes("result")
      );

      expect(hasResultCount).toBe(true);
    });

    it("input has accessible label", () => {
      renderSearch();

      expect(screen.getByLabelText("Search popular feeds or paste a URL")).toBeInTheDocument();
    });

    it("clear button has accessible label", async () => {
      const { user } = renderSearch();

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "test");

      expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
    });

    it("results list has role=list with descriptive aria-label", async () => {
      const { user } = renderSearch();

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "game{Enter}");

      const list = screen.getByRole("list", { name: /search results/i });

      expect(list).toBeInTheDocument();
      expect(list.getAttribute("aria-label")).toMatch(/showing \d+ of \d+/);
    });
  });

  describe("Category tags", () => {
    it("shows category tags on each search result card", async () => {
      const { user } = renderSearch();

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "Hacker{Enter}");

      expect(screen.getByText("Tech & Security")).toBeInTheDocument();
    });
  });

  describe("URL detection", () => {
    it("detects URL input and renders UrlValidationResult", async () => {
      const { user } = renderSearch();

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "https://example.com/feed.xml{Enter}");

      expect(screen.getByTestId("url-validation-result")).toBeInTheDocument();
      expect(
        screen.queryByText(
          "No matches in our popular feeds list. Many websites have feeds - try pasting a URL (e.g., a YouTube channel or news site) and we'll check automatically."
        )
      ).not.toBeInTheDocument();
    });

    it("http:// prefix triggers validateUrl", async () => {
      const { user } = renderSearch();

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "http://example.com/feed{Enter}");

      expect(mockValidateUrl).toHaveBeenCalledWith({
        details: { url: "http://example.com/feed" },
      });
    });

    it("https:// prefix triggers validateUrl", async () => {
      const { user } = renderSearch();

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "https://example.com/feed{Enter}");

      expect(mockValidateUrl).toHaveBeenCalledWith({
        details: { url: "https://example.com/feed" },
      });
    });

    it("bare domain does NOT trigger validation", async () => {
      const { user } = renderSearch();

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "example.com{Enter}");

      expect(mockValidateUrl).not.toHaveBeenCalled();
    });
  });

  describe("Progressive disclosure", () => {
    it("shows first 20 results and a Show more button when >20 results", async () => {
      const manyFeeds = generateManyFeeds(25);

      vi.mocked(await import("../../hooks").then((m) => m.useCuratedFeeds));

      // Override the mock for this test
      const hookModule = await import("../../hooks");
      const originalMock = hookModule.useCuratedFeeds;

      vi.spyOn(hookModule, "useCuratedFeeds").mockImplementation((options) => {
        if (options?.search) {
          return {
            data: { feeds: manyFeeds, categories: mockCategories },
            getHighlightFeeds: () => [],
            getCategoryPreviewText: () => "",
            isLoading: false as const,
            error: null,
            refetch: vi.fn(),
          };
        }

        return originalMock(options);
      });

      const { user } = renderSearch();
      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "Test{Enter}");

      const list = screen.getByRole("list");
      const items = within(list).getAllByRole("listitem");

      expect(items).toHaveLength(20);
      expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();

      vi.mocked(hookModule.useCuratedFeeds).mockRestore();
    });

    it("shows more results when Show more is clicked", async () => {
      const manyFeeds = generateManyFeeds(25);

      const hookModule = await import("../../hooks");

      vi.spyOn(hookModule, "useCuratedFeeds").mockImplementation((options) => {
        if (options?.search) {
          return {
            data: { feeds: manyFeeds, categories: mockCategories },
            getHighlightFeeds: () => [],
            getCategoryPreviewText: () => "",
            isLoading: false as const,
            error: null,
            refetch: vi.fn(),
          };
        }

        return {
          data: { feeds: [], categories: mockCategories },
          getHighlightFeeds: () => [],
          getCategoryPreviewText: () => "",
          isLoading: false as const,
          error: null,
          refetch: vi.fn(),
        };
      });

      const { user } = renderSearch();
      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "Test{Enter}");

      await user.click(screen.getByRole("button", { name: /show more/i }));

      const list = screen.getByRole("list");
      const items = within(list).getAllByRole("listitem");

      expect(items).toHaveLength(25);
      expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();

      vi.mocked(hookModule.useCuratedFeeds).mockRestore();
    });
  });

  describe("Feed states", () => {
    it("passes through feedActionStates to FeedCard", async () => {
      const { user } = renderSearch({
        feedActionStates: {
          "https://feeds.feedburner.com/ign/games": { status: "added", settingsUrl: "/feeds/1" },
        },
      });

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "IGN{Enter}");

      expect(screen.getByRole("button", { name: "IGN feed added" })).toBeInTheDocument();
    });

    it("shows limit-reached on default-state cards when isAtLimit is true", async () => {
      const { user } = renderSearch({
        isAtLimit: true,
      });

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "IGN{Enter}");

      expect(
        screen.getByRole("button", { name: /add ign feed, disabled, feed limit reached/i })
      ).toBeInTheDocument();
    });

    it("does not override added state when isAtLimit is true", async () => {
      const { user } = renderSearch({
        isAtLimit: true,
        feedActionStates: {
          "https://feeds.feedburner.com/ign/games": { status: "added", settingsUrl: "/feeds/1" },
        },
      });

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "IGN{Enter}");

      expect(screen.getByRole("button", { name: "IGN feed added" })).toBeInTheDocument();
    });
  });

  describe("Callbacks", () => {
    it("calls onAdd with the feed object when Add is clicked", async () => {
      const onAdd = vi.fn();
      const { user } = renderSearch({ onAdd });

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "IGN{Enter}");

      await user.click(screen.getByRole("button", { name: "Add IGN feed" }));

      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://feeds.feedburner.com/ign/games",
          title: "IGN",
        })
      );
    });

    it("calls onSearchChange on search submit", async () => {
      const onSearchChange = vi.fn();
      const { user } = renderSearch({ onSearchChange });

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "IGN{Enter}");

      expect(onSearchChange).toHaveBeenCalledWith("IGN");
    });

    it("calls onSearchChange with empty string on clear", async () => {
      const onSearchChange = vi.fn();
      const { user } = renderSearch({ onSearchChange });

      const input = screen.getByLabelText("Search popular feeds or paste a URL");
      await user.type(input, "IGN{Enter}");

      await user.click(screen.getByRole("button", { name: "Clear search" }));

      expect(onSearchChange).toHaveBeenLastCalledWith("");
    });
  });
});
