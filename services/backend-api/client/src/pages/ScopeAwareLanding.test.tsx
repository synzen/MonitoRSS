import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "@/utils/theme";
import { ScopeAwareLanding } from "./ScopeAwareLanding";
import { useUserMe } from "@/features/discordUser";
import { useWorkspace } from "@/features/workspaces";

vi.mock("@/features/discordUser", () => ({
  useUserMe: vi.fn(),
}));

vi.mock("@/features/workspaces", () => ({
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
  userStatus = "success",
  lastActiveWorkspaceSlug,
  workspace,
  workspaceStatus = "success",
}: {
  userStatus?: string;
  lastActiveWorkspaceSlug?: string | null;
  workspace?: { id: string; name: string; slug: string };
  workspaceStatus?: string;
}) => {
  vi.mocked(useUserMe).mockReturnValue({
    data: { result: { preferences: { lastActiveWorkspaceSlug } } },
    status: userStatus,
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
