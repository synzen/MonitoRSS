import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PricingDialogContext } from "../../../../contexts";
import { FeedLimitBar } from "./index";

vi.mock("../../hooks", () => ({
  useUserFeeds: vi.fn(),
}));

vi.mock("../../../discordUser", () => ({
  useDiscordUserMe: vi.fn(),
}));

import { useUserFeeds } from "../../hooks";
import { useDiscordUserMe } from "../../../discordUser";

const mockOnOpen = vi.fn();

const renderBar = () => {
  return render(
    <ChakraProvider>
      <PricingDialogContext.Provider value={{ onOpen: mockOnOpen }}>
        <FeedLimitBar />
      </PricingDialogContext.Provider>
    </ChakraProvider>,
  );
};

describe("FeedLimitBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Normal state (12/25)", () => {
    beforeEach(() => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 12 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);
    });

    it("shows Feed Limit: 12/25", () => {
      renderBar();

      expect(screen.getByText("Feed Limit: 12/25")).toBeInTheDocument();
    });

    it("shows Increase Limits button", () => {
      renderBar();

      expect(screen.getByRole("button", { name: /increase limits/i })).toBeInTheDocument();
    });

    it("limit count area has role status", () => {
      renderBar();

      expect(screen.getByRole("status")).toHaveTextContent("Feed Limit: 12/25");
    });
  });

  describe("Boundary: 4 remaining (21/25)", () => {
    beforeEach(() => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 21 },
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
        data: { results: [], total: 22 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);
    });

    it("shows warning with Warning: and remaining count", () => {
      renderBar();

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(/warning/i);
      expect(status).toHaveTextContent("3 remaining");
    });

    it("shows Increase Limits button", () => {
      renderBar();

      expect(screen.getByRole("button", { name: /increase limits/i })).toBeInTheDocument();
    });
  });

  describe("At limit (25/25)", () => {
    beforeEach(() => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 25 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);
    });

    it("shows red count text", () => {
      renderBar();

      expect(screen.getByRole("status")).toHaveTextContent("Feed Limit: 25/25");
    });

    it("warning banner has role alert", () => {
      renderBar();

      expect(screen.getByRole("alert")).toHaveTextContent(/reached your feed limit/i);
    });

    it("Increase Limits button is inside the warning banner", () => {
      renderBar();

      expect(screen.getByRole("button", { name: /increase limits/i })).toBeInTheDocument();
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

    it("Increase Limits click at limit calls onOpen from PricingDialogContext", () => {
      vi.mocked(useUserFeeds).mockReturnValue({
        data: { results: [], total: 25 },
      } as never);
      vi.mocked(useDiscordUserMe).mockReturnValue({
        data: { maxUserFeeds: 25 },
      } as never);

      renderBar();

      fireEvent.click(screen.getByRole("button", { name: /increase limits/i }));
      expect(mockOnOpen).toHaveBeenCalledTimes(1);
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
});
