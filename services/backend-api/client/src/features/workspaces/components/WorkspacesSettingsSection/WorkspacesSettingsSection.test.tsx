import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { WorkspacesSettingsSection } from "./index";
import { useWorkspaces } from "../../hooks";

vi.mock("../../hooks", () => ({
  useWorkspaces: vi.fn(),
}));

// The dialog has its own hook dependencies; stub it for these tests.
vi.mock("../CreateWorkspaceDialog", () => ({
  CreateWorkspaceDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog">Create workspace dialog</div> : null,
}));

// The pending-invitations list has its own hook dependencies and is covered by
// its own test; stub it so this test stays focused on the "Your workspaces" section.
vi.mock("../PendingInvitationsList", () => ({
  PendingInvitationsList: () => null,
}));

const mockWorkspaces = (overrides: Record<string, unknown>) =>
  vi.mocked(useWorkspaces).mockReturnValue({
    status: "success",
    workspaces: [],
    refetch: vi.fn(),
    ...overrides,
  } as never);

const renderSection = () =>
  render(
    <ChakraProvider value={system}>
      <MemoryRouter>
        <WorkspacesSettingsSection />
      </MemoryRouter>
    </ChakraProvider>,
  );

describe("WorkspacesSettingsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty state when the user is in no workspaces", () => {
    mockWorkspaces({ workspaces: [] });

    renderSection();

    expect(screen.getByRole("heading", { name: "Your workspaces" })).toBeInTheDocument();
    expect(screen.getByText(/not in any workspaces yet/i)).toBeInTheDocument();
  });

  it("lists each workspace with Open and Settings links using slug, and shows the role", () => {
    mockWorkspaces({
      workspaces: [
        { id: "t1", name: "Acme", slug: "acme-marketing", role: "admin" },
        { id: "t2", name: "Bookclub", slug: "bookclub", role: "owner" },
      ],
    });

    renderSection();

    const openLinks = screen.getAllByRole("link", { name: "Open" });
    expect(openLinks).toHaveLength(2);
    expect(openLinks[0]).toHaveAttribute("href", "/workspaces/acme-marketing/feeds");

    expect(screen.getByRole("link", { name: "Acme settings" })).toHaveAttribute(
      "href",
      "/workspaces/acme-marketing/settings",
    );
    expect(screen.getByRole("link", { name: "Bookclub settings" })).toHaveAttribute(
      "href",
      "/workspaces/bookclub/settings",
    );

    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();

    // No dead "Leave" action (no endpoint yet).
    expect(screen.queryByRole("button", { name: /leave/i })).not.toBeInTheDocument();
  });

  it("opens the create-workspace dialog from the section action", () => {
    mockWorkspaces({ workspaces: [] });

    renderSection();
    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("surfaces a retryable error when the workspaces query fails", () => {
    const refetch = vi.fn();
    mockWorkspaces({
      status: "error",
      workspaces: undefined,
      error: { message: "Boom" },
      refetch,
    });

    renderSection();

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load your workspaces");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });
});
