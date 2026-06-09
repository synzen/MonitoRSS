import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { system } from "@/utils/theme";
import { FixFeedRequestsCTA } from ".";

let mockExternalAccounts: Array<{ type: string; status: string }> | undefined;

vi.mock("../../../discordUser", () => ({
  useUserMe: () => ({
    data: { result: { externalAccounts: mockExternalAccounts } },
  }),
  RedditLoginButton: ({ onConnected }: { onConnected?: () => void }) => (
    <button type="button" onClick={() => onConnected?.()}>
      reddit-login
    </button>
  ),
}));

const renderCTA = (
  props: Partial<React.ComponentProps<typeof FixFeedRequestsCTA>>,
) =>
  render(
    <ChakraProvider value={system}>
      <FixFeedRequestsCTA
        url="https://www.reddit.com/r/gaming/.rss"
        {...props}
      />
    </ChakraProvider>,
  );

describe("FixFeedRequestsCTA", () => {
  it("renders nothing for non-reddit URLs", () => {
    mockExternalAccounts = undefined;
    const { container } = renderCTA({ url: "https://example.com/feed.xml" });

    expect(container).toBeEmptyDOMElement();
  });

  it("matches non-/r/ reddit URLs (widened from /r/-only)", () => {
    mockExternalAccounts = undefined;
    renderCTA({
      url: "https://www.reddit.com/user/someone/.rss",
      variant: "required",
    });

    expect(
      screen.getByText("Connect your Reddit account to continue"),
    ).toBeInTheDocument();
  });

  describe("variant=required", () => {
    it("shows first-time mandatory copy when no reddit account exists", () => {
      mockExternalAccounts = undefined;
      renderCTA({ variant: "required" });

      expect(
        screen.getByText("Connect your Reddit account to continue"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/heavily rate-limits unauthenticated requests/i),
      ).toBeInTheDocument();
    });

    it("shows reconnect copy when reddit account exists but is revoked", () => {
      mockExternalAccounts = [{ type: "reddit", status: "REVOKED" }];
      renderCTA({ variant: "required" });

      expect(
        screen.getByText("Reconnect your Reddit account"),
      ).toBeInTheDocument();
      expect(screen.getByText(/no longer active/i)).toBeInTheDocument();
    });

    it("renders nothing when reddit is already active (stale gate)", () => {
      mockExternalAccounts = [{ type: "reddit", status: "ACTIVE" }];
      const { container } = renderCTA({ variant: "required" });

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("variant=rate-limited (default)", () => {
    it("shows rate-limit copy for a never-connected user", () => {
      mockExternalAccounts = undefined;
      renderCTA({});

      expect(
        screen.getByText("Connect your Reddit account"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/heavily rate-limits unauthenticated requests/i),
      ).toBeInTheDocument();
    });

    it("renders nothing when reddit is already active", () => {
      mockExternalAccounts = [{ type: "reddit", status: "ACTIVE" }];
      const { container } = renderCTA({});

      expect(container).toBeEmptyDOMElement();
    });
  });
});
