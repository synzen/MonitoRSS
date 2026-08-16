import "@testing-library/jest-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { system } from "@/utils/theme";
import { getUserFeeds } from "../../../feed/api";
import { MovePersonalFeedsAction } from ".";

vi.mock("../../../feed/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../feed/api")>()),
  getUserFeeds: vi.fn(),
}));

vi.mock("@/features/discordUser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/discordUser")>()),
  DiscordUsername: ({ userId }: { userId: string }) => (
    <span>{userId === "manager-1" ? "Manager Alice" : userId}</span>
  ),
}));

describe("MovePersonalFeedsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserFeeds).mockResolvedValue({
      total: 2,
      results: [
        {
          id: "feed-1",
          title: "First personal feed",
          url: "https://example.com/first.xml",
        },
        {
          id: "feed-2",
          title: "Second personal feed",
          url: "https://example.com/second.xml",
        },
      ],
    } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens a team-named confirmation with every fitting feed selected", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <ChakraProvider value={system}>
          <MemoryRouter>
            <MovePersonalFeedsAction
              workspaceName="Workspace One"
              workspaceSlug="workspace-one"
              allowance={70}
              workspaceHasActiveRedditGrant={false}
              onMoved={vi.fn()}
            />
          </MemoryRouter>
        </ChakraProvider>
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "Move personal feeds" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Move personal feeds to Workspace One",
    });
    expect(
      within(dialog).getByText(/these feeds become owned by Workspace One/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/stay with Workspace One if you leave/i)).toBeInTheDocument();
    const firstFeed = await within(dialog).findByRole("checkbox", {
      name: "First personal feed",
    });
    const secondFeed = await within(dialog).findByRole("checkbox", {
      name: "Second personal feed",
    });
    await waitFor(() => {
      expect(firstFeed).toBeChecked();
      expect(secondFeed).toBeChecked();
    });
    expect(within(dialog).queryByText(/type.*workspace-one.*to confirm/i)).not.toBeInTheDocument();
  });

  it("names sharing impacts and explains the Reddit connection remedy", async () => {
    vi.mocked(getUserFeeds).mockResolvedValue({
      total: 1,
      results: [
        {
          id: "shared-reddit-feed",
          title: "Shared Reddit feed",
          url: "https://www.reddit.com/r/rss/.rss",
          sharedManagers: [{ discordUserId: "manager-1", connectionScoped: false }],
        },
      ],
    } as never);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <ChakraProvider value={system}>
          <MemoryRouter>
            <MovePersonalFeedsAction
              workspaceName="Workspace One"
              workspaceSlug="workspace-one"
              allowance={70}
              workspaceHasActiveRedditGrant={false}
              onMoved={vi.fn()}
            />
          </MemoryRouter>
        </ChakraProvider>
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "Move personal feeds" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Move personal feeds to Workspace One",
    });

    expect(await within(dialog).findByText("Manager Alice")).toBeInTheDocument();
    expect(within(dialog).getByText(/personal sharing will be removed/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/will not be notified/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/may move in a paused.*needs-attention state/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", {
        name: "Connect Reddit for Workspace One",
      }),
    ).toHaveAttribute("href", "/workspaces/workspace-one/settings");
  });

  it("moves the selected feeds and reports the exact moved count", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: { movedCount: 2 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const onMoved = vi.fn();
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <ChakraProvider value={system}>
          <MemoryRouter>
            <MovePersonalFeedsAction
              workspaceName="Workspace One"
              workspaceSlug="workspace-one"
              allowance={70}
              workspaceHasActiveRedditGrant
              onMoved={onMoved}
            />
          </MemoryRouter>
        </ChakraProvider>
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "Move personal feeds" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Move personal feeds to Workspace One",
    });
    const firstFeed = await within(dialog).findByRole("checkbox", {
      name: "First personal feed",
    });
    await waitFor(() => expect(firstFeed).toBeChecked());
    await user.click(within(dialog).getByRole("button", { name: "Move feeds" }));

    await waitFor(() => expect(onMoved).toHaveBeenCalledWith(2));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/workspaces/workspace-one/personal-feed-moves",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ feedIds: ["feed-1", "feed-2"] }),
      }),
    );
    expect(
      screen.getByRole("dialog", {
        name: "Move personal feeds to Workspace One",
      }),
    ).toHaveAttribute("data-state", "closed");
  });
});
