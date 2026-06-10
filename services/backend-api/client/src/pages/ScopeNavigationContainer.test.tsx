import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScopeNavigationContainer } from "./ScopeNavigationContainer";
import { useScopeCrumbLabel } from "../contexts/ScopeLabelContext";
import { useDiscordAuthStatus, useUpdateUserMe, useUserMe } from "@/features/discordUser";
import { useWorkspaces } from "@/features/workspaces";

vi.mock("@/features/discordUser", () => ({
  useDiscordAuthStatus: vi.fn(),
  useUserMe: vi.fn(),
  useUpdateUserMe: vi.fn(),
}));

vi.mock("@/features/workspaces", () => ({
  useWorkspaces: vi.fn(),
}));

const LabelProbe = () => <span data-testid="scope-label">{useScopeCrumbLabel()}</span>;

const mutateAsync = vi.fn().mockResolvedValue({});

const mockState = ({
  authenticated = true,
  workspacesFeature = true,
  workspaces = [{ id: "w1", name: "Acme", slug: "acme-marketing", role: "admin" }],
  lastActiveWorkspaceSlug = null,
}: {
  authenticated?: boolean;
  workspacesFeature?: boolean;
  workspaces?: Array<{ id: string; name: string; slug: string; role: string }>;
  lastActiveWorkspaceSlug?: string | null;
}) => {
  vi.mocked(useDiscordAuthStatus).mockReturnValue({
    data: { authenticated },
  } as never);
  vi.mocked(useUserMe).mockReturnValue({
    data: authenticated
      ? {
          result: {
            capabilities: { workspaces: workspacesFeature },
            featureFlags: { workspaces: workspacesFeature },
            preferences: { lastActiveWorkspaceSlug },
          },
        }
      : undefined,
  } as never);
  vi.mocked(useWorkspaces).mockReturnValue({ workspaces } as never);
  vi.mocked(useUpdateUserMe).mockReturnValue({ mutateAsync } as never);
};

const renderAt = (pathname: string) =>
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <ScopeNavigationContainer>
        <LabelProbe />
      </ScopeNavigationContainer>
    </MemoryRouter>,
  );

describe("ScopeNavigationContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({});
  });

  describe("scope label", () => {
    it("labels workspace routes with the workspace name", () => {
      mockState({});

      renderAt("/workspaces/acme-marketing/feeds");

      expect(screen.getByTestId("scope-label")).toHaveTextContent("Acme");
    });

    it("labels personal routes with Personal once the user has a workspace", () => {
      mockState({});

      renderAt("/feeds");

      expect(screen.getByTestId("scope-label")).toHaveTextContent("Personal");
    });

    it("falls back to Feeds for users with no workspaces", () => {
      mockState({ workspaces: [] });

      renderAt("/feeds");

      expect(screen.getByTestId("scope-label")).toHaveTextContent("Feeds");
    });

    it("falls back to Feeds when the feature is disabled", () => {
      mockState({ workspacesFeature: false });

      renderAt("/feeds");

      expect(screen.getByTestId("scope-label")).toHaveTextContent("Feeds");
    });
  });

  describe("last-active scope recording", () => {
    it("records the workspace slug when entering a workspace route", async () => {
      mockState({ lastActiveWorkspaceSlug: null });

      renderAt("/workspaces/acme-marketing/feeds");

      await waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledWith({
          details: { preferences: { lastActiveWorkspaceSlug: "acme-marketing" } },
        });
      });
    });

    it("records personal scope (null) when on the personal feed area", async () => {
      mockState({ lastActiveWorkspaceSlug: "acme-marketing" });

      renderAt("/feeds");

      await waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledWith({
          details: { preferences: { lastActiveWorkspaceSlug: null } },
        });
      });
    });

    it("does not record on scope-neutral routes like account settings", () => {
      mockState({ lastActiveWorkspaceSlug: "acme-marketing" });

      renderAt("/settings");

      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it("does not re-record an unchanged scope", () => {
      mockState({ lastActiveWorkspaceSlug: "acme-marketing" });

      renderAt("/workspaces/acme-marketing/feeds");

      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it("does not record an unknown workspace slug", () => {
      mockState({ lastActiveWorkspaceSlug: null });

      renderAt("/workspaces/not-my-team/feeds");

      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it("records nothing for users with no workspaces", () => {
      mockState({ workspaces: [], lastActiveWorkspaceSlug: null });

      renderAt("/feeds");

      expect(mutateAsync).not.toHaveBeenCalled();
    });
  });
});
