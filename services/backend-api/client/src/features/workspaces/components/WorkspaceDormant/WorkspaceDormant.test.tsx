import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { WorkspaceDormantBanner, WorkspaceActivationEmptyState } from "./index";
import { usePaddleContext } from "@/features/subscriptionProducts";
import { useCurrentWorkspace } from "../../contexts/CurrentWorkspaceContext";

vi.mock("@/features/subscriptionProducts", () => ({
  usePaddleContext: vi.fn(),
}));

vi.mock("../../contexts/CurrentWorkspaceContext", () => ({
  useCurrentWorkspace: vi.fn(),
}));

const mockPaddle = (isConfigured: boolean) => {
  vi.mocked(usePaddleContext).mockReturnValue({ isConfigured } as never);
};

const mockWorkspace = ({
  role = "owner",
  subscription = null,
}: {
  role?: "owner" | "admin";
  subscription?: unknown;
}) => {
  vi.mocked(useCurrentWorkspace).mockReturnValue({
    id: "workspace-1",
    name: "My Team",
    slug: "my-team",
    myRole: role,
    subscription,
  } as never);
};

const renderInRouter = (ui: React.ReactElement) =>
  render(
    <ChakraProvider value={system}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ChakraProvider>,
  );

describe("WorkspaceDormantBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the owner an activation link to the Billing page while dormant", () => {
    mockPaddle(true);
    mockWorkspace({ role: "owner", subscription: null });

    renderInRouter(<WorkspaceDormantBanner />);

    const link = screen.getByRole("link", { name: /activate/i });
    expect(link).toHaveAttribute("href", "/workspaces/my-team/settings/billing");
  });

  it("tells admins the owner must activate, without an activation link", () => {
    mockPaddle(true);
    mockWorkspace({ role: "admin", subscription: null });

    renderInRouter(<WorkspaceDormantBanner />);

    expect(screen.getByText(/team owner/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /activate/i })).not.toBeInTheDocument();
  });

  it.each(["owner", "admin"] as const)(
    "gives the %s a way back to personal feeds while dormant",
    (role) => {
      mockPaddle(true);
      mockWorkspace({ role, subscription: null });

      renderInRouter(<WorkspaceDormantBanner />);

      expect(screen.getByText(/your personal feeds are not affected/i)).toBeInTheDocument();

      const link = screen.getByRole("link", { name: /go to your personal feeds/i });
      expect(link).toHaveAttribute("href", "/feeds");
    },
  );

  it("renders nothing once the workspace is subscribed", () => {
    mockPaddle(true);
    mockWorkspace({ role: "owner", subscription: { status: "ACTIVE" } });

    const { container } = renderInRouter(<WorkspaceDormantBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when Paddle is not configured", () => {
    mockPaddle(false);
    mockWorkspace({ role: "owner", subscription: null });

    const { container } = renderInRouter(<WorkspaceDormantBanner />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("WorkspaceActivationEmptyState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invites the owner to activate with a link to the Billing page", () => {
    mockPaddle(true);
    mockWorkspace({ role: "owner", subscription: null });

    renderInRouter(<WorkspaceActivationEmptyState />);

    expect(screen.getByRole("heading", { name: /activate/i })).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /activate/i });
    expect(link).toHaveAttribute("href", "/workspaces/my-team/settings/billing");
  });

  it("tells admins to ask the owner", () => {
    mockPaddle(true);
    mockWorkspace({ role: "admin", subscription: null });

    renderInRouter(<WorkspaceActivationEmptyState />);

    expect(screen.getByText(/team owner/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /activate/i })).not.toBeInTheDocument();
  });

  it("reassures the owner that personal feeds stay free, with a way back", () => {
    mockPaddle(true);
    mockWorkspace({ role: "owner", subscription: null });

    renderInRouter(<WorkspaceActivationEmptyState />);

    expect(screen.getByText(/your personal feeds stay free/i)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /go to your personal feeds/i });
    expect(link).toHaveAttribute("href", "/feeds");
  });

  it("reassures admins that personal feeds are unaffected, with a way back", () => {
    mockPaddle(true);
    mockWorkspace({ role: "admin", subscription: null });

    renderInRouter(<WorkspaceActivationEmptyState />);

    expect(screen.getByText(/your personal feeds are not affected/i)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /go to your personal feeds/i });
    expect(link).toHaveAttribute("href", "/feeds");
  });
});
