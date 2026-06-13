import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { WorkspaceRedditConnectionSetting } from "./index";

interface MockRedditConnection {
  status: "ACTIVE" | "REVOKED";
  connectedBy: { userId: string; discordUserId: string | null };
}

let mockRedditConnection: MockRedditConnection | null = null;
const mockDisconnect = vi.fn();

vi.mock("@/features/discordUser", () => ({
  useUserMe: () => ({
    data: { result: { id: "self-user-id", externalAccounts: [] } },
    refetch: vi.fn(),
    fetchStatus: "idle",
  }),
  DiscordUsername: ({ userId }: { userId: string }) => <span>{`user:${userId}`}</span>,
  RedditLoginButton: ({ workspace }: { workspace?: { id: string } }) => (
    <button type="button">{workspace ? `connect-workspace-${workspace.id}` : "connect"}</button>
  ),
}));

vi.mock("../../hooks/useWorkspace", () => ({
  useWorkspace: () => ({
    workspace: {
      id: "ws-1",
      name: "Workspace",
      slug: "my-workspace",
      role: "owner",
      redditConnection: mockRedditConnection,
    },
    refetch: vi.fn(),
  }),
}));

vi.mock("../../hooks/useDisconnectWorkspaceReddit", () => ({
  useDisconnectWorkspaceReddit: () => ({
    mutateAsync: mockDisconnect,
    status: "idle",
    error: null,
    reset: vi.fn(),
  }),
}));

const renderSetting = () =>
  render(
    <ChakraProvider value={system}>
      <WorkspaceRedditConnectionSetting workspaceSlug="my-workspace" />
    </ChakraProvider>,
  );

describe("WorkspaceRedditConnectionSetting", () => {
  beforeEach(() => {
    mockRedditConnection = null;
    mockDisconnect.mockReset();
    mockDisconnect.mockResolvedValue(undefined);
  });

  it("shows Not Connected with a workspace-scoped connect button when no connection exists", () => {
    renderSetting();

    expect(screen.getByText("Not Connected")).toBeInTheDocument();
    expect(screen.getByText("connect-workspace-ws-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /disconnect/i })).not.toBeInTheDocument();
  });

  it("shows Connected with attribution to the connecting member", () => {
    mockRedditConnection = {
      status: "ACTIVE",
      connectedBy: { userId: "other-user-id", discordUserId: "discord-123" },
    };
    renderSetting();

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText(/Connected by/)).toBeInTheDocument();
    expect(screen.getByText("user:discord-123")).toBeInTheDocument();
    expect(screen.queryByText(/\(you\)/)).not.toBeInTheDocument();
  });

  it("marks the connection as yours when you connected it", () => {
    mockRedditConnection = {
      status: "ACTIVE",
      connectedBy: { userId: "self-user-id", discordUserId: "discord-self" },
    };
    renderSetting();

    expect(screen.getByText(/\(you\)/)).toBeInTheDocument();
  });

  it("shows a Disconnected state with reconnect guidance when the connection is revoked", () => {
    mockRedditConnection = {
      status: "REVOKED",
      connectedBy: { userId: "other-user-id", discordUserId: "discord-123" },
    };
    renderSetting();

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
    expect(screen.getByText(/Any member can reconnect/i)).toBeInTheDocument();
  });

  it("disconnects via the workspace endpoint", async () => {
    mockRedditConnection = {
      status: "ACTIVE",
      connectedBy: { userId: "other-user-id", discordUserId: "discord-123" },
    };
    renderSetting();

    fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalledWith({ workspaceSlug: "my-workspace" });
    });
  });
});
