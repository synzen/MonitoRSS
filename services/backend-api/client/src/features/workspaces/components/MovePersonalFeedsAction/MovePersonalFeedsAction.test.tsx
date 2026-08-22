import "@testing-library/jest-dom";
import { Button, ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MenuContent, MenuRoot, MenuTrigger } from "@/components/ui/menu";
import { system } from "@/utils/theme";
import { getUserFeeds } from "../../../feed/api";
import { MovePersonalFeedsAction } from ".";

vi.mock("../../../feed/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../feed/api")>()),
  getUserFeeds: vi.fn(),
}));

vi.mock("@/features/discordUser", () => ({
  DiscordUsername: ({ userId }: { userId: string }) => (
    <span>{userId === "manager-1" ? "Manager Alice" : userId}</span>
  ),
}));

const renderAction = (
  props: Partial<ComponentProps<typeof MovePersonalFeedsAction>> = {},
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  }),
) => {
  const onMoved = props.onMoved ?? vi.fn();
  const action = (
    <MovePersonalFeedsAction
      workspaceName="Workspace One"
      workspaceSlug="workspace-one"
      allowance={70}
      workspaceHasActiveRedditGrant={false}
      onMoved={onMoved}
      {...props}
    />
  );

  render(
    <QueryClientProvider client={queryClient}>
      <ChakraProvider value={system}>
        <MemoryRouter>
          {props.presentation === "menu" ? (
            <MenuRoot lazyMount={false} unmountOnExit={false}>
              <MenuTrigger asChild>
                <Button>More ways to add feeds</Button>
              </MenuTrigger>
              <MenuContent>{action}</MenuContent>
            </MenuRoot>
          ) : (
            action
          )}
        </MemoryRouter>
      </ChakraProvider>
    </QueryClientProvider>,
  );

  return { onMoved, queryClient, user: userEvent.setup() };
};

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
    const { user } = renderAction();

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

  it("uses the shared feed-move warnings", async () => {
    vi.mocked(getUserFeeds).mockResolvedValue({
      total: 1,
      results: [
        {
          id: "shared-reddit-feed",
          title: "Shared Reddit feed",
          url: "https://www.reddit.com/r/rss/.rss",
          sharedManagers: [{ discordUserId: "manager-1", connectionScoped: true }],
        },
      ],
    } as never);
    const { user } = renderAction();

    await user.click(await screen.findByRole("button", { name: "Move personal feeds" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Move personal feeds to Workspace One",
    });

    expect(await within(dialog).findByText("Manager Alice")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/feed sharing does not move into a workspace/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/access to only specific connections/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/these feeds will pause until you connect Reddit/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", {
        name: "Connect Reddit to this workspace (opens in a new tab)",
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
    const { onMoved, user } = renderAction({
      workspaceHasActiveRedditGrant: true,
    });

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

  it("starts oversized selections empty and caps age shortcuts at the remaining slots", async () => {
    const { user } = renderAction({
      allowance: 1,
      workspaceHasActiveRedditGrant: true,
    });

    await user.click(await screen.findByRole("button", { name: "Move personal feeds" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Move personal feeds to Workspace One",
    });
    const firstFeed = await within(dialog).findByRole("checkbox", {
      name: "First personal feed",
    });
    const secondFeed = await within(dialog).findByRole("checkbox", {
      name: "Second personal feed",
    });

    expect(firstFeed).not.toBeChecked();
    expect(secondFeed).not.toBeChecked();
    expect(
      within(dialog).getByRole("button", { name: "Select my newest 1 feeds" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Move feeds" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("explains full workspace capacity in the disabled menu action", async () => {
    const { user } = renderAction({
      allowance: 0,
      workspaceRole: "owner",
      presentation: "menu",
      workspaceHasActiveRedditGrant: true,
    });

    await user.click(screen.getByRole("button", { name: "More ways to add feeds" }));

    expect(
      await screen.findByRole("menuitem", {
        name: "Move personal feeds — workspace full",
      }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "Manage feed capacity" })).toHaveAttribute(
      "href",
      "/workspaces/workspace-one/settings/billing",
    );
  });

  it("directs admins to the owner when the workspace is full", async () => {
    const { user } = renderAction({
      allowance: 0,
      workspaceRole: "admin",
      presentation: "menu",
    });

    await user.click(screen.getByRole("button", { name: "More ways to add feeds" }));

    expect(
      await screen.findByRole("menuitem", {
        name: "Move personal feeds — contact the owner for capacity",
      }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.queryByRole("menuitem", { name: "Manage feed capacity" }),
    ).not.toBeInTheDocument();
  });

  it("opens the move dialog from the menu presentation", async () => {
    const { user } = renderAction({
      presentation: "menu",
      workspaceHasActiveRedditGrant: true,
    });

    await user.click(screen.getByRole("button", { name: "More ways to add feeds" }));
    await user.click(await screen.findByRole("menuitem", { name: "Move personal feeds" }));

    expect(
      await screen.findByRole("dialog", {
        name: "Move personal feeds to Workspace One",
      }),
    ).toBeInTheDocument();
  });

  it("shows the personal-feed query failure in the menu", async () => {
    vi.mocked(getUserFeeds).mockRejectedValue(new Error("Request failed"));
    const { user } = renderAction({ presentation: "menu" });

    await user.click(screen.getByRole("button", { name: "More ways to add feeds" }));

    expect(
      await screen.findByRole("menuitem", {
        name: "Could not check personal feeds",
      }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("does not add a menu action when there are no personal feeds", async () => {
    vi.mocked(getUserFeeds).mockResolvedValue({
      total: 0,
      results: [],
    } as never);
    const { user } = renderAction({ presentation: "menu" });

    await user.click(screen.getByRole("button", { name: "More ways to add feeds" }));

    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: /personal feeds/i })).not.toBeInTheDocument(),
    );
  });

  it("keeps the dialog selection visible and refreshes data after a capacity conflict", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "WORKSPACE_PERSONAL_FEED_MOVE_CAPACITY_CHANGED",
          message: "The workspace's available feed capacity changed",
          timestamp: Date.now() / 1000,
          errors: [],
          isStandardized: true,
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { user } = renderAction(
      { allowance: 2, workspaceHasActiveRedditGrant: true },
      queryClient,
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

    expect(
      await within(dialog).findByText(/available capacity changed.*no feeds were moved/i),
    ).toBeInTheDocument();
    expect(firstFeed).toBeChecked();
    expect(dialog).toHaveAttribute("data-state", "open");
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["user-feeds"] }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["workspace"] });
  });

  it.each([
    {
      code: "WORKSPACE_PERSONAL_FEED_MOVE_FEED_MISSING",
      message: /selected feeds no longer exist.*no feeds were moved/i,
      sourceChanged: true,
    },
    {
      code: "WORKSPACE_PERSONAL_FEED_MOVE_OWNERSHIP_CHANGED",
      message: /selected feeds are no longer your personal feeds.*no feeds were moved/i,
      sourceChanged: true,
    },
    {
      code: "WORKSPACE_PERSONAL_FEED_MOVE_MEMBERSHIP_CHANGED",
      message: /workspace membership changed.*no feeds were moved/i,
      sourceChanged: false,
    },
  ])("keeps the selected rows visible after $code", async ({ code, message, sourceChanged }) => {
    let mutationAttempted = false;
    const initialResponse = {
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
    };
    vi.mocked(getUserFeeds).mockImplementation(async () =>
      mutationAttempted && sourceChanged
        ? ({ total: 1, results: [initialResponse.results[1]] } as never)
        : (initialResponse as never),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        mutationAttempted = true;

        return new Response(
          JSON.stringify({
            code,
            message: "The move could not be completed",
            timestamp: Date.now() / 1000,
            errors: [],
            isStandardized: true,
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );
    const { user } = renderAction({ workspaceHasActiveRedditGrant: true });

    await user.click(await screen.findByRole("button", { name: "Move personal feeds" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Move personal feeds to Workspace One",
    });
    const firstFeed = await within(dialog).findByRole("checkbox", {
      name: "First personal feed",
    });
    const secondFeed = await within(dialog).findByRole("checkbox", {
      name: "Second personal feed",
    });
    await waitFor(() => expect(firstFeed).toBeChecked());
    await user.click(secondFeed);
    await user.click(within(dialog).getByRole("button", { name: "Move feeds" }));

    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    await waitFor(() => expect(getUserFeeds).toHaveBeenCalledTimes(4));
    expect(within(dialog).getByRole("checkbox", { name: "First personal feed" })).toBeChecked();
    expect(dialog).toHaveAttribute("data-state", "open");
  });
});
