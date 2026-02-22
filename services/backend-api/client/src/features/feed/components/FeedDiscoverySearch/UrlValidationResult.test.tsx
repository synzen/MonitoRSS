import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UrlValidationResult } from "./UrlValidationResult";
import { ApiErrorCode } from "@/utils/getStandardErrorCodeMessage copy";
import ApiAdapterError from "@/utils/ApiAdapterError";

const mockMutateAsync = vi.fn();

vi.mock("../../hooks", () => ({
  useCreateUserFeed: () => ({
    mutateAsync: mockMutateAsync,
    status: "idle",
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock("../../hooks/useDeleteUserFeed", () => ({
  useDeleteUserFeed: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("../FixFeedRequestsCTA", () => ({
  FixFeedRequestsCTA: ({ url }: { url: string }) => {
    const isReddit = /^http(s?):\/\/(www.)?(\w+\.)?reddit\.com\/r\//i.test(url);

    if (!isReddit) return null;

    return <div data-testid="fix-feed-requests-cta" data-url={url} />;
  },
}));

const defaultProps = {
  url: "https://example.com/feed.xml",
  validationStatus: "idle" as const,
  validationData: undefined,
  validationError: null,
  isAtLimit: false,
  onTrySearchByName: vi.fn(),
  onRetryValidation: vi.fn(),
};

const renderComponent = (props: Partial<React.ComponentProps<typeof UrlValidationResult>> = {}) => {
  const user = userEvent.setup();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <ChakraProvider>
        <MemoryRouter>
          <UrlValidationResult {...defaultProps} {...props} />
        </MemoryRouter>
      </ChakraProvider>
    </QueryClientProvider>,
  );

  return { user, ...result };
};

describe("UrlValidationResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("State 1: Loading", () => {
    it('shows "Checking URL..." with spinner when validationStatus is loading', () => {
      renderComponent({ validationStatus: "loading" });

      expect(screen.getByText("Checking URL...")).toBeInTheDocument();
    });
  });

  describe("State 2a: Direct match", () => {
    it("shows title from feedTitle", () => {
      renderComponent({
        validationStatus: "success",
        validationData: {
          result: { feedTitle: "My Great Feed" },
        },
      });

      expect(screen.getByText("My Great Feed")).toBeInTheDocument();
    });

    it("falls back to hostname when feedTitle is missing", () => {
      renderComponent({
        url: "https://blog.example.com/feed.xml",
        validationStatus: "success",
        validationData: {
          result: {},
        },
      });

      expect(
        screen.getByRole("button", { name: /add blog\.example\.com feed/i }),
      ).toBeInTheDocument();
    });
  });

  describe("State 2b: Resolved URL (non-platform redirect)", () => {
    it("shows 'Originally entered' note for unknown domain redirects", () => {
      renderComponent({
        url: "https://example.com",
        validationStatus: "success",
        validationData: {
          result: {
            resolvedToUrl: "https://example.com/rss.xml",
            feedTitle: "Example",
          },
        },
      });

      expect(screen.getByText(/originally entered/i)).toBeInTheDocument();
      expect(screen.getByText(/https:\/\/example\.com$/)).toBeInTheDocument();
    });

    it("shows feed title from feedTitle", () => {
      renderComponent({
        url: "https://example.com",
        validationStatus: "success",
        validationData: {
          result: {
            resolvedToUrl: "https://example.com/rss.xml",
            feedTitle: "Example Feed",
          },
        },
      });

      expect(screen.getByText("Example Feed")).toBeInTheDocument();
    });

    it("falls back to resolved URL hostname when feedTitle is missing", () => {
      renderComponent({
        url: "https://example.com",
        validationStatus: "success",
        validationData: {
          result: {
            resolvedToUrl: "https://blog.example.com/rss.xml",
          },
        },
      });

      expect(screen.getAllByText("blog.example.com").length).toBeGreaterThanOrEqual(1);
    });

    it("shows add button for resolved URL", () => {
      renderComponent({
        url: "https://example.com",
        validationStatus: "success",
        validationData: {
          result: {
            resolvedToUrl: "https://example.com/rss.xml",
            feedTitle: "Example",
          },
        },
      });

      expect(screen.getByRole("button", { name: /add example feed/i })).toBeInTheDocument();
    });

    it("shows favicon using resolved URL domain", () => {
      renderComponent({
        url: "https://example.com",
        validationStatus: "success",
        validationData: {
          result: {
            resolvedToUrl: "https://blog.example.com/rss.xml",
            feedTitle: "Example",
          },
        },
      });

      const icon = screen.getByRole("img", { hidden: true });
      expect(icon).toHaveAttribute(
        "src",
        "https://www.google.com/s2/favicons?sz=32&domain=blog.example.com",
      );
    });

    it("shows letter avatar fallback on image error", () => {
      renderComponent({
        url: "https://example.com",
        validationStatus: "success",
        validationData: {
          result: {
            resolvedToUrl: "https://example.com/rss.xml",
            feedTitle: "Example Feed",
          },
        },
      });

      const icon = screen.getByRole("img", { hidden: true });
      fireEvent.error(icon);

      expect(screen.getByText("E")).toBeInTheDocument();
    });
  });

  describe("State 2b-expected: Expected platform resolution (YouTube/Reddit)", () => {
    it("does NOT show 'Originally entered' note for YouTube URL", () => {
      renderComponent({
        url: "https://www.youtube.com/@MKBHD",
        validationStatus: "success",
        validationData: {
          result: {
            resolvedToUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=abc",
            feedTitle: "MKBHD",
          },
        },
      });

      expect(screen.queryByText(/originally entered/i)).not.toBeInTheDocument();
    });

    it("does NOT show 'Originally entered' note for Reddit URL", () => {
      renderComponent({
        url: "https://www.reddit.com/r/gaming",
        validationStatus: "success",
        validationData: {
          result: {
            resolvedToUrl: "https://www.reddit.com/r/gaming/.rss",
            feedTitle: "gaming",
          },
        },
      });

      expect(screen.queryByText(/originally entered/i)).not.toBeInTheDocument();
    });

    it("shows add button for expected resolution", () => {
      renderComponent({
        url: "https://www.youtube.com/@MKBHD",
        validationStatus: "success",
        validationData: {
          result: {
            resolvedToUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=abc",
            feedTitle: "MKBHD",
          },
        },
      });

      expect(screen.getByRole("button", { name: /add mkbhd feed/i })).toBeInTheDocument();
    });

    it("still shows 'Originally entered' for unknown domain with resolved URL", () => {
      renderComponent({
        url: "https://example.com",
        validationStatus: "success",
        validationData: {
          result: {
            resolvedToUrl: "https://example.com/rss.xml",
            feedTitle: "Example",
          },
        },
      });

      expect(screen.getByText(/originally entered/i)).toBeInTheDocument();
    });
  });

  describe("State 2c: No feed found", () => {
    it('shows "Couldn\'t find a feed" for FEED_INVALID error', () => {
      renderComponent({
        validationStatus: "error",
        validationError: new ApiAdapterError("Invalid feed", {
          errorCode: ApiErrorCode.FEED_INVALID,
        }),
      });

      expect(screen.getByText("Couldn't find a feed")).toBeInTheDocument();
    });

    it('shows "Couldn\'t find a feed" for NO_FEED_IN_HTML_PAGE error', () => {
      renderComponent({
        validationStatus: "error",
        validationError: new ApiAdapterError("No feed in page", {
          errorCode: ApiErrorCode.NO_FEED_IN_HTML_PAGE,
        }),
      });

      expect(screen.getByText("Couldn't find a feed")).toBeInTheDocument();
    });

    it('"Try searching by name instead" calls onTrySearchByName', async () => {
      const onTrySearchByName = vi.fn();
      const { user } = renderComponent({
        validationStatus: "error",
        validationError: new ApiAdapterError("Invalid feed", {
          errorCode: ApiErrorCode.FEED_INVALID,
        }),
        onTrySearchByName,
      });

      await user.click(screen.getByRole("button", { name: /try searching by name instead/i }));

      expect(onTrySearchByName).toHaveBeenCalledTimes(1);
    });

    it('shows "Tips for finding feeds" heading', () => {
      renderComponent({
        validationStatus: "error",
        validationError: new ApiAdapterError("Invalid feed", {
          errorCode: ApiErrorCode.FEED_INVALID,
        }),
      });

      expect(screen.getByRole("heading", { name: /tips for finding feeds/i })).toBeInTheDocument();
    });

    it("tips list contains 3 items", () => {
      renderComponent({
        validationStatus: "error",
        validationError: new ApiAdapterError("Invalid feed", {
          errorCode: ApiErrorCode.FEED_INVALID,
        }),
      });

      const list = screen.getByRole("list");
      const items = screen.getAllByRole("listitem");

      expect(list).toBeInTheDocument();
      expect(items).toHaveLength(3);
    });

    it("tips section does not render for request errors", () => {
      renderComponent({
        validationStatus: "error",
        validationError: new ApiAdapterError("Request failed", {
          errorCode: ApiErrorCode.FEED_REQUEST_FAILED,
        }),
      });

      expect(screen.queryByText("Tips for finding feeds")).not.toBeInTheDocument();
    });
  });

  describe("State 2d: Request error", () => {
    it('shows InlineErrorAlert with "Failed to validate feed" for FEED_REQUEST_FAILED', () => {
      renderComponent({
        validationStatus: "error",
        validationError: new ApiAdapterError("Request failed", {
          errorCode: ApiErrorCode.FEED_REQUEST_FAILED,
        }),
      });

      expect(screen.getByText("Failed to validate feed")).toBeInTheDocument();
    });

    it("FixFeedRequestsCTA rendered for Reddit 403/429 URL", () => {
      renderComponent({
        url: "https://www.reddit.com/r/gaming/.rss",
        validationStatus: "error",
        validationError: new ApiAdapterError("Forbidden", {
          errorCode: ApiErrorCode.FEED_REQUEST_FORBIDDEN,
          statusCode: 403,
        }),
      });

      const cta = screen.getByTestId("fix-feed-requests-cta");

      expect(cta).toBeInTheDocument();
      expect(cta).toHaveAttribute("data-url", "https://www.reddit.com/r/gaming/.rss");
    });

    it("FixFeedRequestsCTA not rendered for non-Reddit errors", () => {
      renderComponent({
        url: "https://example.com/feed.xml",
        validationStatus: "error",
        validationError: new ApiAdapterError("Request failed", {
          errorCode: ApiErrorCode.FEED_REQUEST_FAILED,
        }),
      });

      expect(screen.queryByTestId("fix-feed-requests-cta")).not.toBeInTheDocument();
    });
  });

  describe("Add flow", () => {
    it('clicking "+ Add" calls useCreateUserFeed.mutateAsync', async () => {
      mockMutateAsync.mockResolvedValue({ result: { id: "feed-123" } });

      const { user } = renderComponent({
        validationStatus: "success",
        validationData: {
          result: { feedTitle: "Test Feed" },
        },
      });

      await user.click(screen.getByRole("button", { name: /add test feed feed/i }));

      expect(mockMutateAsync).toHaveBeenCalledWith({
        details: { url: "https://example.com/feed.xml", title: "Test Feed" },
      });
    });

    it("sends hostname as title when feedTitle is missing (direct match)", async () => {
      mockMutateAsync.mockResolvedValue({ result: { id: "feed-123" } });

      const { user } = renderComponent({
        url: "https://blog.example.com/feed.xml",
        validationStatus: "success",
        validationData: {
          result: {},
        },
      });

      await user.click(screen.getByRole("button", { name: /add blog\.example\.com feed/i }));

      expect(mockMutateAsync).toHaveBeenCalledWith({
        details: { url: "https://blog.example.com/feed.xml", title: "blog.example.com" },
      });
    });

    it("sends hostname as title when feedTitle is missing (resolved URL)", async () => {
      mockMutateAsync.mockResolvedValue({ result: { id: "feed-123" } });

      const { user } = renderComponent({
        url: "https://example.com",
        validationStatus: "success",
        validationData: {
          result: {
            resolvedToUrl: "https://example.com/rss.xml",
          },
        },
      });

      await user.click(screen.getByRole("button", { name: /add example\.com feed/i }));

      expect(mockMutateAsync).toHaveBeenCalledWith({
        details: { url: "https://example.com/rss.xml", title: "example.com" },
      });
    });

    it('after successful add: "Added" indicator + "Go to feed settings" button visible', async () => {
      mockMutateAsync.mockResolvedValue({ result: { id: "feed-123" } });

      const { user } = renderComponent({
        validationStatus: "success",
        validationData: {
          result: { feedTitle: "Test Feed" },
        },
      });

      await user.click(screen.getByRole("button", { name: /add test feed feed/i }));

      expect(screen.getByText("Added")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /go to feed settings/i })).toBeInTheDocument();
    });

    it("add failure: InlineErrorAlert below card, button stays enabled", async () => {
      mockMutateAsync.mockRejectedValue(
        new ApiAdapterError("Server error", {
          errorCode: ApiErrorCode.INTERNAL_ERROR,
        }),
      );

      const { user } = renderComponent({
        validationStatus: "success",
        validationData: {
          result: { feedTitle: "Test Feed" },
        },
      });

      await user.click(screen.getByRole("button", { name: /add test feed feed/i }));

      expect(screen.getByText("Failed to add feed")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add test feed feed/i })).toBeInTheDocument();
    });

    it('FEED_LIMIT_REACHED add error: "Limit reached" button, no inline alert', async () => {
      mockMutateAsync.mockRejectedValue(
        new ApiAdapterError("Limit reached", {
          errorCode: ApiErrorCode.FEED_LIMIT_REACHED,
        }),
      );

      const { user } = renderComponent({
        validationStatus: "success",
        validationData: {
          result: { feedTitle: "Test Feed" },
        },
      });

      await user.click(screen.getByRole("button", { name: /add test feed feed/i }));

      expect(screen.getByText("Limit reached")).toBeInTheDocument();
      expect(screen.queryByText("Failed to add feed")).not.toBeInTheDocument();
    });

    it('isAtLimit prop true: button shows "Limit reached"', () => {
      renderComponent({
        isAtLimit: true,
        validationStatus: "success",
        validationData: {
          result: { feedTitle: "Test Feed" },
        },
      });

      expect(screen.getByText("Limit reached")).toBeInTheDocument();
    });
  });
});
