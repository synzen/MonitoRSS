import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { system } from "@/utils/theme";
import { FeedScopeProvider, type FeedScope } from "../../contexts/FeedScopeContext";
import { FixFeedRequestsCTA } from ".";

let mockExternalAccounts: Array<{ type: string; status: string }> | undefined;

vi.mock("../../../discordUser", () => ({
  useUserMe: () => ({
    data: { result: { externalAccounts: mockExternalAccounts } },
  }),
  RedditLoginButton: ({
    onConnected,
    workspace,
  }: {
    onConnected?: () => void;
    workspace?: { id: string };
  }) => (
    <button type="button" onClick={() => onConnected?.()}>
      {workspace ? `reddit-login-workspace-${workspace.id}` : "reddit-login"}
    </button>
  ),
}));

const renderCTA = (props: Partial<React.ComponentProps<typeof FixFeedRequestsCTA>>) =>
  render(
    <ChakraProvider value={system}>
      <FixFeedRequestsCTA url="https://www.reddit.com/r/gaming/.rss" {...props} />
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

    expect(screen.getByText("Connect your Reddit account to continue")).toBeInTheDocument();
  });

  describe("variant=required", () => {
    it("shows first-time mandatory copy when no reddit account exists", () => {
      mockExternalAccounts = undefined;
      renderCTA({ variant: "required" });

      expect(screen.getByText("Connect your Reddit account to continue")).toBeInTheDocument();
      expect(screen.getByText(/heavily rate-limits unauthenticated requests/i)).toBeInTheDocument();
    });

    it("shows reconnect copy when reddit account exists but is revoked", () => {
      mockExternalAccounts = [{ type: "reddit", status: "REVOKED" }];
      renderCTA({ variant: "required" });

      expect(screen.getByText("Reconnect your Reddit account")).toBeInTheDocument();
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

      expect(screen.getByText("Connect your Reddit account")).toBeInTheDocument();
      expect(screen.getByText(/heavily rate-limits unauthenticated requests/i)).toBeInTheDocument();
    });

    it("renders nothing when reddit is already active", () => {
      mockExternalAccounts = [{ type: "reddit", status: "ACTIVE" }];
      const { container } = renderCTA({});

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("workspace scope", () => {
    const renderInWorkspace = (
      scope: FeedScope,
      props: Partial<React.ComponentProps<typeof FixFeedRequestsCTA>> = {},
    ) =>
      render(
        <ChakraProvider value={system}>
          <FeedScopeProvider value={scope}>
            <FixFeedRequestsCTA
              url="https://www.reddit.com/r/gaming/.rss"
              variant="required"
              {...props}
            />
          </FeedScopeProvider>
        </ChakraProvider>,
      );

    it("gates on the WORKSPACE connection even when the personal account is active", () => {
      // No fallback: the member's personal connection never powers workspace feeds.
      mockExternalAccounts = [{ type: "reddit", status: "ACTIVE" }];
      renderInWorkspace({ workspaceId: "ws-1", redditConnection: null });

      expect(screen.getByText("Connect a Reddit account to continue")).toBeInTheDocument();
      expect(screen.getByText("reddit-login-workspace-ws-1")).toBeInTheDocument();
    });

    it("renders nothing when the workspace connection is active, even without a personal one", () => {
      mockExternalAccounts = undefined;
      const { container } = renderInWorkspace({
        workspaceId: "ws-1",
        redditConnection: { status: "ACTIVE" },
      });

      expect(container).toBeEmptyDOMElement();
    });

    it("shows workspace reconnect copy when the workspace connection is revoked", () => {
      mockExternalAccounts = undefined;
      renderInWorkspace({
        workspaceId: "ws-1",
        redditConnection: { status: "REVOKED" },
      });

      expect(screen.getByText("Reconnect this workspace's Reddit account")).toBeInTheDocument();
      expect(screen.getByText(/Any member can reconnect/i)).toBeInTheDocument();
    });
  });
});
