import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "@/utils/theme";
import { ScopeAwareLanding } from "./ScopeAwareLanding";
import { useUserMe } from "@/features/discordUser";
import { useIsWorkspacesEnabled, useWorkspace } from "@/features/workspaces";

vi.mock("@/features/discordUser", () => ({
  useUserMe: vi.fn(),
}));

vi.mock("@/features/workspaces", () => ({
  useIsWorkspacesEnabled: vi.fn(),
  useWorkspace: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();

  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  };
});

const mockState = ({
  enabled = true,
  flagStatus = "success",
  lastActiveWorkspaceSlug,
  workspace,
  workspaceStatus = "success",
}: {
  enabled?: boolean;
  flagStatus?: string;
  lastActiveWorkspaceSlug?: string | null;
  workspace?: { id: string; name: string; slug: string };
  workspaceStatus?: string;
}) => {
  vi.mocked(useIsWorkspacesEnabled).mockReturnValue({
    enabled,
    status: flagStatus,
  } as never);
  vi.mocked(useUserMe).mockReturnValue({
    data: { result: { preferences: { lastActiveWorkspaceSlug } } },
  } as never);
  vi.mocked(useWorkspace).mockReturnValue({
    workspace,
    status: workspaceStatus,
  } as never);
};

const renderLanding = () =>
  render(
    <ChakraProvider value={system}>
      <ScopeAwareLanding />
    </ChakraProvider>,
  );

const navigateTarget = () => screen.getByTestId("navigate").getAttribute("data-to");

describe("ScopeAwareLanding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lands on personal feeds when no last-active workspace is recorded", () => {
    mockState({ lastActiveWorkspaceSlug: null });

    renderLanding();

    expect(navigateTarget()).toBe("/feeds");
  });

  it("lands on the last-active workspace's feeds when it is still accessible", () => {
    mockState({
      lastActiveWorkspaceSlug: "acme-marketing",
      workspace: { id: "w1", name: "Acme", slug: "acme-marketing" },
    });

    renderLanding();

    expect(navigateTarget()).toBe("/workspaces/acme-marketing/feeds");
  });

  it("falls back to personal feeds when the recorded workspace is gone or inaccessible", () => {
    mockState({
      lastActiveWorkspaceSlug: "deleted-team",
      workspace: undefined,
      workspaceStatus: "error",
    });

    renderLanding();

    expect(navigateTarget()).toBe("/feeds");
  });

  it("ignores the recorded workspace when the workspaces feature is disabled", () => {
    mockState({ enabled: false, lastActiveWorkspaceSlug: "acme-marketing" });

    renderLanding();

    expect(navigateTarget()).toBe("/feeds");
    expect(vi.mocked(useWorkspace)).toHaveBeenCalledWith({ workspaceSlug: undefined });
  });

  it("does not navigate while the recorded workspace is being validated", () => {
    mockState({
      lastActiveWorkspaceSlug: "acme-marketing",
      workspace: undefined,
      workspaceStatus: "loading",
    });

    renderLanding();

    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
  });
});
