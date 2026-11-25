import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { PricingDialogContext } from "@/features/subscriptionProducts";
import { FeedLimitBar } from "./index";
import { FeedScopeProvider } from "../../contexts/FeedScopeContext";

import { useUserFeeds } from "../../hooks";
import { useDiscordUserMe, useUserMe } from "../../../discordUser";

vi.mock("../../hooks", () => ({
  useUserFeeds: vi.fn(),
}));

vi.mock("../../../discordUser", () => ({
  useDiscordUserMe: vi.fn(),
  useUserMe: vi.fn(),
}));

const mockOnOpen = vi.fn();

const renderBar = (props: { showOnlyWhenConstrained?: boolean } = {}) => {
  return render(
    <ChakraProvider value={system}>
      <PricingDialogContext.Provider value={{ onOpen: mockOnOpen }}>
        <FeedLimitBar {...props} />
      </PricingDialogContext.Provider>
    </ChakraProvider>,
  );
};

describe("FeedLimitBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUserMe).mockReturnValue({
      data: { result: { capabilities: { premiumFeeds: true } } },
    } as never);
  });

  describe("Normal state (12/25)", () => {
    beforeEach(() => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 12, premiumFeedCount: 0 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);
    });

    it("shows Feed Limit: 12/25", () => {
      renderBar();

      expect(screen.getByText("Feed Limit: 12/25")).toBeInTheDocument();
    });

    it("shows Premium Feed Limit below the feed limit", () => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 12, premiumFeedCount: 2 },
      } as never);

      renderBar();

      expect(screen.getByText("Premium Feed Limit: 2/2")).toBeInTheDocument();
    });

    it("hides Premium Feed Limit when the user does not have the premium feeds capability", () => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 12, premiumFeedCount: 2 },
      } as never);
      vi.mocked(useUserMe).mockReturnValue({
        data: { result: { capabilities: { premiumFeeds: false } } },
      } as never);

      renderBar();

      expect(screen.getByText("Feed Limit: 12/25")).toBeInTheDocument();
      expect(
        screen.queryByText("Premium Feed Limit: 2/2"),
      ).not.toBeInTheDocument();
    });

    it("shows Increase Limits button", () => {
      renderBar();

      expect(
        screen.getByRole("button", { name: /increase limits/i }),
      ).toBeInTheDocument();
    });

    it("limit count area has role status", () => {
      renderBar();

      expect(screen.getAllByRole("status")[0]).toHaveTextContent(
        "Feed Limit: 12/25",
      );
    });
  });

  describe("Boundary: 4 remaining (21/25)", () => {
    beforeEach(() => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 21, premiumFeedCount: 0 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);
    });

    it("shows normal state without warning", () => {
      renderBar();

      expect(screen.getByText("Feed Limit: 21/25")).toBeInTheDocument();
      expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument();
    });
  });

  describe("Boundary: 3 remaining (22/25)", () => {
    beforeEach(() => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 22, premiumFeedCount: 0 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);
    });

    it("shows warning with Warning: and remaining count", () => {
      renderBar();

      const status = screen.getAllByRole("status")[0];
      expect(status).toHaveTextContent(/warning/i);
      expect(status).toHaveTextContent("3 remaining");
    });

    it("shows Increase Limits button", () => {
      renderBar();

      expect(
        screen.getByRole("button", { name: /increase limits/i }),
      ).toBeInTheDocument();
    });
  });

  describe("At limit (25/25)", () => {
    beforeEach(() => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 25, premiumFeedCount: 0 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);
    });

    it("shows feed limit reached text", () => {
      renderBar();

      expect(screen.getAllByRole("status")[0]).toHaveTextContent(
        "Feed limit reached (25/25)",
      );
    });

    it("shows Increase Limits button", () => {
      renderBar();

      expect(
        screen.getByRole("button", { name: /increase limits/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Interactions", () => {
    it("Increase Limits click calls onOpen from PricingDialogContext", () => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 12 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);

      renderBar();

      fireEvent.click(screen.getByRole("button", { name: /increase limits/i }));
      expect(mockOnOpen).toHaveBeenCalledTimes(1);
    });

    it("Increase Limits click at limit opens the pricing dialog targeted at the workspace panel", () => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 25 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);

      renderBar();

      // At the personal limit the upsell points at workspaces (more capacity),
      // so the dialog opens pre-targeted to the workspace region.
      fireEvent.click(screen.getByRole("button", { name: /increase limits/i }));
      expect(mockOnOpen).toHaveBeenCalledTimes(1);
      expect(mockOnOpen).toHaveBeenCalledWith("workspace");
    });
  });

  describe("showOnlyWhenConstrained", () => {
    it("does not show the bar when only the premium limit is constrained without the capability", () => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 12, premiumFeedCount: 2 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);
      vi.mocked(useUserMe).mockReturnValue({
        data: { result: { capabilities: { premiumFeeds: false } } },
      } as never);

      renderBar({ showOnlyWhenConstrained: true });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("hides bar when user has plenty of headroom", () => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 12 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);

      renderBar({ showOnlyWhenConstrained: true });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("shows bar when near limit (3 remaining)", () => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 22, premiumFeedCount: 0 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);

      renderBar({ showOnlyWhenConstrained: true });

      expect(screen.getAllByRole("status")[0]).toHaveTextContent("3 remaining");
    });

    it("shows bar when at limit", () => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 25, premiumFeedCount: 0 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);

      renderBar({ showOnlyWhenConstrained: true });

      expect(screen.getAllByRole("status")[0]).toHaveTextContent(
        "Feed limit reached (25/25)",
      );
    });

    it("does not show warning for small limits with plenty of headroom (0/3)", () => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 0, premiumFeedCount: 0 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 3 },
      } as never);

      renderBar({ showOnlyWhenConstrained: true });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("shows warning for small limits when at limit (3/3)", () => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 3, premiumFeedCount: 0 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 3 },
      } as never);

      renderBar({ showOnlyWhenConstrained: true });

      expect(screen.getAllByRole("status")[0]).toHaveTextContent(
        "Feed limit reached (3/3)",
      );
    });
  });

  describe("Loading state", () => {
    it("returns null when useUserFeeds data is undefined", () => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: undefined,
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);

      renderBar();

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("returns null when useDiscordUserMe data is undefined", () => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 12 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: undefined,
      } as never);

      renderBar();

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("Workspace scope", () => {
    const renderWorkspaceBar = () =>
      render(
        <ChakraProvider value={system}>
          <PricingDialogContext.Provider value={{ onOpen: mockOnOpen }}>
            <FeedScopeProvider
              value={{
                workspaceId: "t1",
                workspaceSlug: "my-workspace",
                maxFeeds: 140,
              }}
            >
              <FeedLimitBar />
            </FeedScopeProvider>
          </PricingDialogContext.Provider>
        </ChakraProvider>,
      );

    beforeEach(() => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 5, premiumFeedCount: 1 },
      } as never);
      // Personal max must be ignored in workspace scope.
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);
    });

    it("uses the workspace's feed limit, not the personal one", () => {
      renderWorkspaceBar();

      expect(screen.getByText("Feed Limit: 5/140")).toBeInTheDocument();
      expect(screen.getByText("Premium Feed Limit: 1/10")).toBeInTheDocument();
    });

    it("hides the Increase Limits upsell in workspace scope", () => {
      renderWorkspaceBar();

      expect(
        screen.queryByRole("button", { name: /increase limits/i }),
      ).not.toBeInTheDocument();
    });
  });
});
