import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import { system } from "@/utils/theme";
import { WorkspaceRedditConnectionAlert } from ".";
import { useUserFeedContext } from "../../contexts/UserFeedContext";
import { useFeedScope } from "../../contexts/FeedScopeContext";

vi.mock("../../contexts/UserFeedContext", () => ({
  useUserFeedContext: vi.fn(),
}));

vi.mock("../../contexts/FeedScopeContext", () => ({
  useFeedScope: vi.fn(),
}));

const REDDIT_URL = "https://www.reddit.com/r/rss/.rss";
const NON_REDDIT_URL = "https://example.com/feed.xml";

const setup = (opts: {
  url: string;
  workspaceSlug?: string;
  redditConnection?: { status: "ACTIVE" | "REVOKED" } | null;
}) => {
  vi.mocked(useUserFeedContext).mockReturnValue({
    userFeed: { id: "feed-1", url: opts.url },
  } as never);
  vi.mocked(useFeedScope).mockReturnValue({
    workspaceSlug: opts.workspaceSlug,
    redditConnection: opts.redditConnection,
  } as never);

  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ChakraProvider value={system}>
          <WorkspaceRedditConnectionAlert />
        </ChakraProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("WorkspaceRedditConnectionAlert", () => {
  it("warns a workspace Reddit feed that has no workspace connection", () => {
    setup({ url: REDDIT_URL, workspaceSlug: "acme-team", redditConnection: null });

    expect(screen.getByText(/needs a workspace Reddit connection/i)).toBeVisible();
    const connectLink = screen.getByRole("link", {
      name: /connect reddit to (this )?workspace/i,
    });
    expect(connectLink).toHaveAttribute("href", expect.stringContaining("/workspaces/acme-team"));
  });

  it("warns when the workspace connection is revoked (not active)", () => {
    setup({
      url: REDDIT_URL,
      workspaceSlug: "acme-team",
      redditConnection: { status: "REVOKED" },
    });

    expect(screen.getByText(/needs a workspace Reddit connection/i)).toBeVisible();
  });

  it("stays silent when the workspace already has an active connection", () => {
    setup({
      url: REDDIT_URL,
      workspaceSlug: "acme-team",
      redditConnection: { status: "ACTIVE" },
    });

    expect(screen.queryByText(/needs a workspace Reddit connection/i)).not.toBeInTheDocument();
  });

  it("stays silent for a non-Reddit workspace feed", () => {
    setup({ url: NON_REDDIT_URL, workspaceSlug: "acme-team", redditConnection: null });

    expect(screen.queryByText(/needs a workspace Reddit connection/i)).not.toBeInTheDocument();
  });

  it("stays silent in personal scope (no workspace), where personal Reddit applies", () => {
    setup({ url: REDDIT_URL, workspaceSlug: undefined, redditConnection: null });

    expect(screen.queryByText(/needs a workspace Reddit connection/i)).not.toBeInTheDocument();
  });
});
