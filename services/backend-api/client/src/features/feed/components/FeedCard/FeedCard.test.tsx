import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { FeedCard } from "./index";
import { ApiErrorCode } from "../../../../utils/getStandardErrorCodeMessage copy";

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
    </ChakraProvider>
  );
};

describe("FeedCard", () => {
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
  });

  describe("Button states", () => {
    it("default state shows Add button with aria-label", () => {
      renderCard();

      const btn = screen.getByRole("button", { name: "Add IGN feed" });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveTextContent("+ Add");
    });

    it("adding state shows spinner and aria-disabled", () => {
      renderCard({ state: "adding" });

      const btn = screen.getByRole("button", { name: "Adding IGN feed..." });
      expect(btn).toHaveAttribute("aria-disabled", "true");
    });

    it("added state shows Added text and aria-disabled", () => {
      renderCard({ state: "added" });

      const btn = screen.getByRole("button", { name: "IGN feed added" });
      expect(btn).toHaveAttribute("aria-disabled", "true");
      expect(btn).toHaveTextContent("Added");
    });

    it("added state does NOT show Go to feed settings link when feedSettingsUrl is not set", () => {
      renderCard({ state: "added" });

      expect(screen.queryByText("Go to feed settings")).not.toBeInTheDocument();
    });

    it("added state shows Go to feed settings link when feedSettingsUrl is set", () => {
      renderCard({ state: "added", feedSettingsUrl: "/feeds/123" });

      const link = screen.getByRole("link", { name: "Go to feed settings for IGN" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/feeds/123");
    });

    it("error state shows error message with role alert and Retry button", () => {
      renderCard({ state: "error", errorMessage: "Something went wrong" });

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Something went wrong");

      const retryBtn = screen.getByRole("button", { name: /retry/i });
      expect(retryBtn).toBeInTheDocument();
      expect(retryBtn).toHaveAttribute("aria-describedby", alert.id);
    });

    it("limit-reached state shows Limit reached text and aria-disabled", () => {
      renderCard({ state: "limit-reached" });

      const btn = screen.getByRole("button", { name: /limit reached/i });
      expect(btn).toHaveAttribute("aria-disabled", "true");
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
      expect(alert).toHaveTextContent(
        "This feed can't be reached right now. Try again later."
      );
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
        screen.getByText(/Failed to get feed articles - requesting the feed took too long/)
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

      fireEvent.click(screen.getByRole("button", { name: /limit reached/i }));
      expect(onAdd).not.toHaveBeenCalled();
    });

    it("clicking Retry in error state calls onAdd", () => {
      const onAdd = vi.fn();
      renderCard({ state: "error", errorMessage: "Oops", onAdd });

      fireEvent.click(screen.getByRole("button", { name: /retry/i }));
      expect(onAdd).toHaveBeenCalledTimes(1);
    });
  });
});
