import "@testing-library/jest-dom";
import { useReducer } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { ConvertPersonalPlanDialog } from "./ConvertPersonalPlanDialog";
import { useUserFeedsInfinite } from "../../../feed/hooks/useUserFeedsInfinite";

vi.mock("../../../feed/hooks/useUserFeedsInfinite", () => ({
  useUserFeedsInfinite: vi.fn(),
}));

vi.mock("../../../feed/api", () => ({
  getUserFeeds: vi.fn(),
}));

vi.mock("../../hooks", () => ({
  useConvertWorkspaceBilling: () => ({
    mutateAsync: vi.fn(),
    error: null,
  }),
}));

const REDDIT_URL = "https://www.reddit.com/r/rss/.rss";
const NON_REDDIT_URL = "https://example.com/feed.xml";

const installFeeds = (allFeeds: Array<{ id: string; title: string; url: string }>) => {
  let rerender: () => void = () => {};

  vi.mocked(useUserFeedsInfinite).mockImplementation(() => {
    const [, force] = useReducer((n: number) => n + 1, 0);
    rerender = force;

    return {
      data: { pages: [{ total: allFeeds.length, results: allFeeds }] },
      status: "success",
      error: null,
      fetchNextPage: vi.fn(),
      isFetching: false,
      setSearch: vi.fn(() => rerender()),
      hasNextPage: false,
      isFetchingNextPage: false,
      search: "",
    } as never;
  });
};

const renderDialog = (props: { workspaceHasActiveRedditGrant: boolean }) =>
  render(
    <MemoryRouter>
      <ChakraProvider value={system}>
        <ConvertPersonalPlanDialog
          open
          onClose={vi.fn()}
          onConverted={vi.fn()}
          workspaceSlug="acme-team"
          feedLimit={70}
          workspaceHasActiveRedditGrant={props.workspaceHasActiveRedditGrant}
        />
      </ChakraProvider>
    </MemoryRouter>,
  );

describe("ConvertPersonalPlanDialog reddit warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("warns when a selected Reddit feed is moving and the workspace has no grant", async () => {
    installFeeds([
      { id: "feed-1", title: "Reddit One", url: REDDIT_URL },
      { id: "feed-2", title: "Plain Feed", url: NON_REDDIT_URL },
    ]);

    renderDialog({ workspaceHasActiveRedditGrant: false });

    // The warning prose appears both in the visible alert (its text aria-hidden)
    // and the live region, so it renders at least once.
    await waitFor(() =>
      expect(screen.getAllByText(/uses your Reddit connection/i).length).toBeGreaterThanOrEqual(1),
    );
  });

  it("does not warn when the workspace already has an active Reddit grant", async () => {
    installFeeds([{ id: "feed-1", title: "Reddit One", url: REDDIT_URL }]);

    renderDialog({ workspaceHasActiveRedditGrant: true });

    await screen.findByText(/Move your personal plan to this workspace/i);
    expect(screen.queryByText(/uses your Reddit connection/i)).not.toBeInTheDocument();
  });

  it("does not warn when no Reddit feed is selected", async () => {
    installFeeds([{ id: "feed-1", title: "Plain Feed", url: NON_REDDIT_URL }]);

    renderDialog({ workspaceHasActiveRedditGrant: false });

    await screen.findByText(/Move your personal plan to this workspace/i);
    expect(screen.queryByText(/uses your Reddit connection/i)).not.toBeInTheDocument();
  });

  it("offers a Connect Reddit to workspace action that opens the workspace settings in a new tab", async () => {
    installFeeds([{ id: "feed-1", title: "Reddit One", url: REDDIT_URL }]);

    renderDialog({ workspaceHasActiveRedditGrant: false });

    const connectLink = await screen.findByRole("link", {
      name: /connect reddit to (this )?workspace/i,
    });
    expect(connectLink).toHaveAttribute("target", "_blank");
    expect(connectLink).toHaveAttribute("href", expect.stringContaining("/workspaces/acme-team"));
  });

  it("drops the warning when the only Reddit feed is unselected", async () => {
    installFeeds([{ id: "feed-1", title: "Reddit One", url: REDDIT_URL }]);

    renderDialog({ workspaceHasActiveRedditGrant: false });

    await waitFor(() =>
      expect(screen.getAllByText(/uses your Reddit connection/i).length).toBeGreaterThanOrEqual(1),
    );

    // The list auto-opens when a breaking reddit feed is selected, so the row is
    // reachable. Unselect it -> the warning clears.
    const label = screen.getByText("Reddit One", { exact: true });
    await userEvent.click(label);

    await waitFor(() =>
      expect(screen.queryByText(/uses your Reddit connection/i)).not.toBeInTheDocument(),
    );
  });
});
