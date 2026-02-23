import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { FeedCard } from "./index";
import { ApiErrorCode } from "../../../../utils/getStandardErrorCodeMessage copy";

dayjs.extend(relativeTime);

const mockMutateAsync = vi.fn();
const mockReset = vi.fn();

vi.mock("../../hooks/useFeedPreviewByUrl", () => ({
  useFeedPreviewByUrl: () => ({
    mutateAsync: mockMutateAsync,
    status: "idle",
    error: null,
    reset: mockReset,
    data: undefined,
  }),
}));

const defaultFeed = {
  title: "IGN",
  domain: "ign.com",
  description: "Video game news and reviews",
  url: "https://ign.com/rss/articles/feed",
};

const renderCard = (props: Partial<React.ComponentProps<typeof FeedCard>> = {}) => {
  return render(
    <ChakraProvider>
      <MemoryRouter>
        <FeedCard feed={defaultFeed} state="default" onAdd={() => {}} {...props} />
      </MemoryRouter>
    </ChakraProvider>,
  );
};

const getPreviewToggle = () => screen.getByText("Preview articles").closest("summary")!;

describe("FeedCard", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockReset.mockReset();
  });

  describe("Rendering", () => {
    it("renders title and description", () => {
      renderCard();

      expect(screen.getByText("IGN")).toBeInTheDocument();
      expect(screen.getByText("Video game news and reviews")).toBeInTheDocument();
    });

    it("shows feed icon image with correct src", () => {
      renderCard();

      const img = screen.getByRole("img", { hidden: true }) as HTMLImageElement;
      expect(img.src).toContain("https://www.google.com/s2/favicons?sz=32&domain=ign.com");
    });

    it("falls back to letter avatar on image error", () => {
      renderCard();

      const img = screen.getByRole("img", { hidden: true }) as HTMLImageElement;
      fireEvent.error(img);

      expect(screen.getByText("I")).toBeInTheDocument();
      expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument();
    });

    it("shows Most added badge when popular is true", () => {
      renderCard({ feed: { ...defaultFeed, popular: true } });

      expect(screen.getByText("Most added")).toBeInTheDocument();
    });

    it("hides Most added badge when popular is absent", () => {
      renderCard();

      expect(screen.queryByText("Most added")).not.toBeInTheDocument();
    });

    it("hides Most added badge when showPopularBadge is false", () => {
      renderCard({
        feed: { ...defaultFeed, popular: true },
        showPopularBadge: false,
      });

      expect(screen.queryByText("Most added")).not.toBeInTheDocument();
    });

    it("shows category tag when showCategoryTag is set", () => {
      renderCard({ showCategoryTag: "Gaming" });

      expect(screen.getByText("Gaming")).toBeInTheDocument();
    });

    it("hides category tag when showCategoryTag is undefined", () => {
      renderCard();

      expect(screen.queryByText("Gaming")).not.toBeInTheDocument();
    });

    it("shows domain text by default", () => {
      renderCard();

      expect(screen.getByText("ign.com")).toBeInTheDocument();
    });

    it("hides domain text when showDomain is false", () => {
      renderCard({ showDomain: false });

      expect(screen.queryByText("ign.com")).not.toBeInTheDocument();
    });

    it("article element has aria-label matching feed title", () => {
      renderCard();

      const article = screen.getByRole("article");
      expect(article).toHaveAttribute("aria-label", "IGN");
    });

    it("title element has title attribute for tooltip on truncation", () => {
      renderCard();

      const titleEl = screen.getByText("IGN");
      expect(titleEl).toHaveAttribute("title", "IGN");
    });
  });

  describe("Redirect note", () => {
    it("shows 'Originally entered' note when redirectedFrom is provided", () => {
      renderCard({ redirectedFrom: "https://youtube.com/@MKBHD" });

      expect(screen.getByText(/originally entered/i)).toBeInTheDocument();
      expect(screen.getByText(/youtube\.com\/@MKBHD/)).toBeInTheDocument();
    });

    it("does not show redirect note when redirectedFrom is not provided", () => {
      renderCard();

      expect(screen.queryByText(/originally entered/i)).not.toBeInTheDocument();
    });
  });

  describe("Button states", () => {
    it("default state shows Add button with aria-label", () => {
      renderCard();

      const btn = screen.getByRole("button", { name: "Add IGN feed" });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveTextContent("+ Add");
    });

    it("adding state shows busy button", () => {
      renderCard({ state: "adding" });

      const btn = screen.getByRole("button", { name: "Adding IGN feed..." });
      expect(btn).toHaveAttribute("aria-busy", "true");
      expect(btn).toHaveAttribute("aria-disabled", "true");
    });

    it("added state shows Added text and aria-disabled", () => {
      renderCard({ state: "added" });

      const btn = screen.getByRole("button", { name: "IGN feed added" });
      expect(btn).toHaveAttribute("aria-disabled", "true");
      expect(btn).toHaveTextContent("Added");
    });

    it("added state does NOT show feed settings link when feedSettingsUrl is not set", () => {
      renderCard({ state: "added" });

      expect(screen.queryByRole("link", { name: /feed settings/i })).not.toBeInTheDocument();
    });

    it("added state shows feed settings button when feedSettingsUrl is set", () => {
      renderCard({ state: "added", feedSettingsUrl: "/feeds/123" });

      const btn = screen.getByRole("button", { name: "Go to feed settings for IGN" });
      expect(btn).toBeInTheDocument();
    });

    it("added state with feedSettingsUrl shows subtle Added indicator", () => {
      renderCard({ state: "added", feedSettingsUrl: "/feeds/123" });

      expect(screen.getByText("Added")).toBeInTheDocument();
    });

    it("error state shows error message with role alert and Retry button", () => {
      renderCard({ state: "error", errorMessage: "Something went wrong" });

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Something went wrong");

      const retryBtn = screen.getByRole("button", { name: /retry/i });
      expect(retryBtn).toBeInTheDocument();
      expect(retryBtn).toHaveAttribute("aria-describedby", alert.id);
    });

    it("limit-reached state shows disabled Limit reached button", () => {
      renderCard({ state: "limit-reached" });

      const btn = screen.getByRole("button", {
        name: /add ign feed, disabled, feed limit reached/i,
      });
      expect(btn).toHaveAttribute("aria-disabled", "true");
      expect(btn).toHaveTextContent("Limit reached");
    });

    it("added state shows Remove button when onRemove is provided (no settings link)", () => {
      const onRemove = vi.fn();
      renderCard({ state: "added", onRemove });

      const btn = screen.getByRole("button", { name: "Remove IGN feed" });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveTextContent("Remove");
    });

    it("added state shows both settings and Remove buttons when onRemove and feedSettingsUrl are provided", () => {
      const onRemove = vi.fn();
      renderCard({ state: "added", onRemove, feedSettingsUrl: "/feeds/123" });

      expect(
        screen.getByRole("button", { name: "Go to feed settings for IGN" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove IGN feed" })).toBeInTheDocument();
    });

    it("added state shows disabled Added button when onRemove is NOT provided", () => {
      renderCard({ state: "added" });

      const btn = screen.getByRole("button", { name: "IGN feed added" });
      expect(btn).toHaveAttribute("aria-disabled", "true");
    });

    it("removing state shows busy button", () => {
      renderCard({ state: "removing" });

      const btn = screen.getByRole("button", { name: "Removing IGN feed..." });
      expect(btn).toHaveAttribute("aria-busy", "true");
      expect(btn).toHaveAttribute("aria-disabled", "true");
    });

    it("hideActions hides all action buttons", () => {
      renderCard({ hideActions: true });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("Curated error messages", () => {
    it("shows friendly message instead of technical error for curated feeds", () => {
      renderCard({
        state: "error",
        isCurated: true,
        errorCode: ApiErrorCode.FEED_REQUEST_TIMEOUT,
        errorMessage: "Failed to get feed articles - requesting the feed took too long.",
      });

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("This feed can't be reached right now. Try again later.");
      expect(alert).not.toHaveTextContent("requesting the feed took too long");
    });

    it("shows 'Show details' toggle for curated feed errors", () => {
      renderCard({
        state: "error",
        isCurated: true,
        errorCode: ApiErrorCode.FEED_NOT_FOUND,
        errorMessage: "Feed does not exist",
      });

      expect(screen.getByRole("button", { name: /show details/i })).toBeInTheDocument();
    });

    it("clicking 'Show details' reveals feed URL and technical error", () => {
      renderCard({
        state: "error",
        isCurated: true,
        errorCode: ApiErrorCode.FEED_REQUEST_TIMEOUT,
        errorMessage: "Failed to get feed articles - requesting the feed took too long.",
      });

      fireEvent.click(screen.getByRole("button", { name: /show details/i }));

      expect(screen.getByText(/https:\/\/ign\.com\/rss\/articles\/feed/)).toBeInTheDocument();
      expect(
        screen.getByText(/Failed to get feed articles - requesting the feed took too long/),
      ).toBeInTheDocument();
    });

    it("clicking 'Hide details' collapses the detail area", () => {
      renderCard({
        state: "error",
        isCurated: true,
        errorCode: ApiErrorCode.FEED_REQUEST_TIMEOUT,
        errorMessage: "Failed to get feed articles - requesting the feed took too long.",
      });

      fireEvent.click(screen.getByRole("button", { name: /show details/i }));
      expect(screen.getByText(/https:\/\/ign\.com\/rss\/articles\/feed/)).toBeVisible();

      fireEvent.click(screen.getByRole("button", { name: /hide details/i }));
      expect(screen.getByText(/https:\/\/ign\.com\/rss\/articles\/feed/)).not.toBeVisible();
    });

    it("'Show details' toggle has aria-expanded attribute", () => {
      renderCard({
        state: "error",
        isCurated: true,
        errorCode: ApiErrorCode.FEED_NOT_FOUND,
        errorMessage: "Feed does not exist",
      });

      const toggle = screen.getByRole("button", { name: /show details/i });
      expect(toggle).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(toggle);
      const hideToggle = screen.getByRole("button", { name: /hide details/i });
      expect(hideToggle).toHaveAttribute("aria-expanded", "true");
    });

    it("non-curated error shows technical message directly with no toggle", () => {
      renderCard({
        state: "error",
        isCurated: false,
        errorMessage: "Feed does not exist or is not accessible.",
      });

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Feed does not exist or is not accessible.");
      expect(screen.queryByRole("button", { name: /show details/i })).not.toBeInTheDocument();
    });

    it("non-curated error without isCurated prop shows technical message directly", () => {
      renderCard({
        state: "error",
        errorMessage: "Feed does not exist or is not accessible.",
      });

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Feed does not exist or is not accessible.");
      expect(screen.queryByRole("button", { name: /show details/i })).not.toBeInTheDocument();
    });
  });

  describe("Interactions", () => {
    it("clicking Add in default state calls onAdd", () => {
      const onAdd = vi.fn();
      renderCard({ onAdd });

      fireEvent.click(screen.getByRole("button", { name: "Add IGN feed" }));
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it("clicking button in adding state does NOT call onAdd", () => {
      const onAdd = vi.fn();
      renderCard({ state: "adding", onAdd });

      fireEvent.click(screen.getByRole("button", { name: "Adding IGN feed..." }));
      expect(onAdd).not.toHaveBeenCalled();
    });

    it("clicking button in added state does NOT call onAdd", () => {
      const onAdd = vi.fn();
      renderCard({ state: "added", onAdd });

      fireEvent.click(screen.getByRole("button", { name: "IGN feed added" }));
      expect(onAdd).not.toHaveBeenCalled();
    });

    it("clicking button in limit-reached state does NOT call onAdd", () => {
      const onAdd = vi.fn();
      renderCard({ state: "limit-reached", onAdd });

      fireEvent.click(
        screen.getByRole("button", { name: /add ign feed, disabled, feed limit reached/i }),
      );
      expect(onAdd).not.toHaveBeenCalled();
    });

    it("clicking Retry in error state calls onAdd", () => {
      const onAdd = vi.fn();
      renderCard({ state: "error", errorMessage: "Oops", onAdd });

      fireEvent.click(screen.getByRole("button", { name: /retry/i }));
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it("clicking Remove in added state calls onRemove", () => {
      const onRemove = vi.fn();
      renderCard({ state: "added", onRemove });

      fireEvent.click(screen.getByRole("button", { name: "Remove IGN feed" }));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it("clicking button in removing state does NOT call onRemove", () => {
      const onRemove = vi.fn();
      renderCard({ state: "removing", onRemove });

      fireEvent.click(screen.getByRole("button", { name: "Removing IGN feed..." }));
      expect(onRemove).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility announcements", () => {
    it("announces feed removed when state transitions from removing to default", () => {
      const { rerender } = render(
        <ChakraProvider>
          <MemoryRouter>
            <FeedCard feed={defaultFeed} state="removing" onAdd={() => {}} onRemove={() => {}} />
          </MemoryRouter>
        </ChakraProvider>,
      );

      rerender(
        <ChakraProvider>
          <MemoryRouter>
            <FeedCard feed={defaultFeed} state="default" onAdd={() => {}} onRemove={() => {}} />
          </MemoryRouter>
        </ChakraProvider>,
      );

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("IGN feed removed");
    });

    it("announces feed added when state transitions from adding to added", () => {
      const { rerender } = render(
        <ChakraProvider>
          <MemoryRouter>
            <FeedCard feed={defaultFeed} state="adding" onAdd={() => {}} />
          </MemoryRouter>
        </ChakraProvider>,
      );

      rerender(
        <ChakraProvider>
          <MemoryRouter>
            <FeedCard feed={defaultFeed} state="added" onAdd={() => {}} />
          </MemoryRouter>
        </ChakraProvider>,
      );

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("IGN feed added");
    });

    it("inline removing button shows visible Removing text", () => {
      renderCard({
        state: "removing",
        onRemove: () => {},
        feedSettingsUrl: "/feeds/123",
      });

      const btn = screen.getByRole("button", { name: "Removing IGN feed..." });
      expect(btn).toHaveTextContent("Removing...");
    });
  });

  describe("Remove error state", () => {
    it("remove-error state shows inline error message with role alert", () => {
      renderCard({
        state: "remove-error",
        errorMessage: "Network error",
        feedSettingsUrl: "/feeds/123",
        onRemove: vi.fn(),
      });

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Network error");
    });

    it("remove-error state shows red border on card", () => {
      renderCard({
        state: "remove-error",
        errorMessage: "Network error",
        feedSettingsUrl: "/feeds/123",
        onRemove: vi.fn(),
      });

      const article = screen.getByRole("article");
      expect(article).toHaveStyle({ borderColor: "red.400" });
    });

    it("remove-error state shows default error message when errorMessage is not provided", () => {
      renderCard({
        state: "remove-error",
        feedSettingsUrl: "/feeds/123",
        onRemove: vi.fn(),
      });

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Failed to remove feed");
    });

    it("remove-error state shows Feed settings button and Remove button for retry", () => {
      const onRemove = vi.fn();
      renderCard({
        state: "remove-error",
        errorMessage: "Network error",
        feedSettingsUrl: "/feeds/123",
        onRemove,
      });

      expect(
        screen.getByRole("button", { name: "Go to feed settings for IGN" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove IGN feed" })).toBeInTheDocument();
    });

    it("remove-error state Remove button calls onRemove for retry", () => {
      const onRemove = vi.fn();
      renderCard({
        state: "remove-error",
        errorMessage: "Network error",
        feedSettingsUrl: "/feeds/123",
        onRemove,
      });

      fireEvent.click(screen.getByRole("button", { name: "Remove IGN feed" }));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe("Search highlighting", () => {
    it("highlights matching text in title when searchQuery provided", () => {
      renderCard({ searchQuery: "IGN" });

      const mark = document.querySelector("mark");
      expect(mark).toBeInTheDocument();
      expect(mark!.textContent).toBe("IGN");
    });

    it("highlights matching text in description when searchQuery provided", () => {
      renderCard({ searchQuery: "game" });

      const marks = document.querySelectorAll("mark");
      const descriptionMark = Array.from(marks).find((m) => m.textContent === "game");
      expect(descriptionMark).toBeInTheDocument();
    });

    it("highlights matching text in domain when searchQuery provided", () => {
      renderCard({ searchQuery: "ign" });

      const marks = document.querySelectorAll("mark");
      const domainMark = Array.from(marks).find((m) => m.textContent === "ign");
      expect(domainMark).toBeInTheDocument();
    });

    it("does not highlight when searchQuery is not provided", () => {
      renderCard();

      const marks = document.querySelectorAll("mark");
      expect(marks).toHaveLength(0);
    });
  });

  describe("Article preview", () => {
    it("clicking Preview articles shows articles after loading", async () => {
      mockMutateAsync.mockResolvedValue({
        result: {
          requestStatus: "SUCCESS",
          articles: [
            { title: "Preview Article 1", date: "2025-01-15T10:00:00Z" },
            { title: "Preview Article 2" },
          ],
        },
      });

      renderCard({ previewEnabled: true });

      fireEvent.click(getPreviewToggle());

      await waitFor(() => {
        expect(screen.getByText("Preview Article 1")).toBeInTheDocument();
        expect(screen.getByText("Preview Article 2")).toBeInTheDocument();
      });
    });

    it("does not render preview toggle when previewEnabled is false", () => {
      renderCard({ previewEnabled: false });

      expect(screen.queryByText("Preview articles")).not.toBeInTheDocument();
    });

    it("Add button click does NOT toggle preview", async () => {
      mockMutateAsync.mockResolvedValue({
        result: { requestStatus: "SUCCESS", articles: [] },
      });

      const onAdd = vi.fn();
      renderCard({ previewEnabled: true, onAdd });

      fireEvent.click(screen.getByRole("button", { name: "Add IGN feed" }));

      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Recent articles")).not.toBeInTheDocument();
    });

    it("collapsing and re-expanding uses cached data", async () => {
      mockMutateAsync.mockResolvedValue({
        result: {
          requestStatus: "SUCCESS",
          articles: [{ title: "Cached Article" }],
        },
      });

      renderCard({ previewEnabled: true });

      const toggle = getPreviewToggle();

      fireEvent.click(toggle);
      await waitFor(() => {
        expect(screen.getByText("Cached Article")).toBeInTheDocument();
      });

      fireEvent.click(toggle);
      expect(screen.queryByText("Cached Article")).not.toBeInTheDocument();

      fireEvent.click(toggle);
      await waitFor(() => {
        expect(screen.getByText("Cached Article")).toBeInTheDocument();
      });

      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    it("error state shows 'Couldn't load preview' with Retry button", async () => {
      mockMutateAsync.mockRejectedValue(new Error("Network error"));

      renderCard({ previewEnabled: true });

      fireEvent.click(getPreviewToggle());

      await waitFor(() => {
        expect(screen.getByText("Couldn't load preview. Try again later.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
      });
    });

    it("retry triggers new API call", async () => {
      mockMutateAsync.mockRejectedValueOnce(new Error("Network error")).mockResolvedValue({
        result: {
          requestStatus: "SUCCESS",
          articles: [{ title: "Recovered Article" }],
        },
      });

      renderCard({ previewEnabled: true });

      fireEvent.click(getPreviewToggle());

      await waitFor(() => {
        expect(screen.getByText("Couldn't load preview. Try again later.")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByText("Recovered Article")).toBeInTheDocument();
      });

      expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    });

    it("empty articles shows 'No articles found'", async () => {
      mockMutateAsync.mockResolvedValue({
        result: { requestStatus: "SUCCESS", articles: [] },
      });

      renderCard({ previewEnabled: true });

      fireEvent.click(getPreviewToggle());

      await waitFor(() => {
        expect(screen.getByText("No articles found in this feed.")).toBeInTheDocument();
      });
    });

    it("details open attribute toggles correctly", async () => {
      mockMutateAsync.mockResolvedValue({
        result: { requestStatus: "SUCCESS", articles: [] },
      });

      renderCard({ previewEnabled: true });

      const details = screen.getByText("Preview articles").closest("details")!;
      const toggle = getPreviewToggle();

      expect(details).not.toHaveAttribute("open");

      fireEvent.click(toggle);
      await waitFor(() => {
        expect(details).toHaveAttribute("open");
      });

      fireEvent.click(toggle);
      expect(details).not.toHaveAttribute("open");
    });

    it("non-SUCCESS requestStatus shows specific error message", async () => {
      mockMutateAsync.mockResolvedValue({
        result: { requestStatus: "TIMED_OUT", articles: [] },
      });

      renderCard({ previewEnabled: true });

      fireEvent.click(getPreviewToggle());

      await waitFor(() => {
        expect(
          screen.getByText("This feed can't be reached right now. Try again later."),
        ).toBeInTheDocument();
      });
    });

    it("BAD_STATUS_CODE with 403 shows unavailable message", async () => {
      mockMutateAsync.mockResolvedValue({
        result: { requestStatus: "BAD_STATUS_CODE", responseStatusCode: 403, articles: [] },
      });

      renderCard({ previewEnabled: true });

      fireEvent.click(getPreviewToggle());

      await waitFor(() => {
        expect(
          screen.getByText("This feed is no longer available. Try a different feed."),
        ).toBeInTheDocument();
      });
    });

    it("PARSE_ERROR shows broken feed message", async () => {
      mockMutateAsync.mockResolvedValue({
        result: { requestStatus: "PARSE_ERROR", articles: [] },
      });

      renderCard({ previewEnabled: true });

      fireEvent.click(getPreviewToggle());

      await waitFor(() => {
        expect(
          screen.getByText("Something's wrong with this feed. Try a different feed."),
        ).toBeInTheDocument();
      });
    });

    it("article with url renders as external link", async () => {
      mockMutateAsync.mockResolvedValue({
        result: {
          requestStatus: "SUCCESS",
          articles: [{ title: "Linked Article", url: "https://example.com/article" }],
        },
      });

      renderCard({ previewEnabled: true });

      fireEvent.click(getPreviewToggle());

      await waitFor(() => {
        const link = screen.getByRole("link", { name: "Linked Article" });
        expect(link).toHaveAttribute("href", "https://example.com/article");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      });
    });

    it("article without url renders as plain text", async () => {
      mockMutateAsync.mockResolvedValue({
        result: {
          requestStatus: "SUCCESS",
          articles: [{ title: "Plain Article" }],
        },
      });

      renderCard({ previewEnabled: true });

      fireEvent.click(getPreviewToggle());

      await waitFor(() => {
        expect(screen.getByText("Plain Article")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Plain Article" })).not.toBeInTheDocument();
      });
    });
  });
});
