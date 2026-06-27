import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { WorkspaceDormantBanner, WorkspaceActivationEmptyState } from "./index";
import { usePaddleContext } from "@/features/subscriptionProducts";
import { useCurrentWorkspace } from "../../contexts/CurrentWorkspaceContext";
import { useWorkspace } from "../../hooks";

vi.mock("@/features/subscriptionProducts", () => ({
  usePaddleContext: vi.fn(),
}));

vi.mock("../../contexts/CurrentWorkspaceContext", () => ({
  useCurrentWorkspace: vi.fn(),
}));

vi.mock("../../hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks")>()),
  useWorkspace: vi.fn(),
}));

// The convert dialog reaches into the feed list, which fetches feeds; stub it so
// the empty state's tests stay focused on the activation/convert routing.
vi.mock("../WorkspaceBilling/ConvertPersonalPlanDialog", () => ({
  ConvertPersonalPlanDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Move your personal plan to this workspace" /> : null,
}));

const mockPaddle = (isConfigured: boolean) => {
  vi.mocked(usePaddleContext).mockReturnValue({ isConfigured } as never);
};

const mockWorkspace = ({
  role = "owner",
  subscription = null,
  conversion = null,
}: {
  role?: "owner" | "admin";
  subscription?: unknown;
  conversion?: unknown;
}) => {
  vi.mocked(useCurrentWorkspace).mockReturnValue({
    id: "workspace-1",
    name: "My Team",
    slug: "my-team",
    myRole: role,
    subscription,
  } as never);
  vi.mocked(useWorkspace).mockReturnValue({
    workspace: {
      id: "workspace-1",
      name: "My Team",
      slug: "my-team",
      myRole: role,
      subscription,
      conversion,
    },
    status: "success",
    error: null,
    fetchStatus: "idle",
    refetch: vi.fn(),
  } as never);
};

const renderInRouter = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ChakraProvider value={system}>
        <MemoryRouter>{ui}</MemoryRouter>
      </ChakraProvider>
    </QueryClientProvider>,
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

    expect(screen.getByText(/workspace owner/i)).toBeInTheDocument();
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

    expect(screen.getByText(/workspace owner/i)).toBeInTheDocument();
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

  it("leads a convert-eligible owner with an inline move-my-plan action", async () => {
    mockPaddle(true);
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 70 },
    });

    renderInRouter(<WorkspaceActivationEmptyState />);

    const convertButton = screen.getByRole("button", {
      name: /move my personal plan here/i,
    });
    expect(convertButton).toHaveAttribute("aria-haspopup", "dialog");

    // The dialog opens in place rather than routing to /billing first.
    convertButton.click();
    expect(
      await screen.findByRole("dialog", { name: /move your personal plan/i }),
    ).toBeInTheDocument();
  });

  it("offers a convert-eligible owner a secondary link to choose a plan instead", () => {
    mockPaddle(true);
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 70 },
    });

    renderInRouter(<WorkspaceActivationEmptyState />);

    const link = screen.getByRole("link", { name: /choose a workspace plan instead/i });
    expect(link).toHaveAttribute("href", "/workspaces/my-team/settings/billing");
  });

  it("keeps the plain Activate workspace route when the owner cannot convert", () => {
    mockPaddle(true);
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: false, ineligibleReason: "PERSONAL_PLAN_INELIGIBLE" },
    });

    renderInRouter(<WorkspaceActivationEmptyState />);

    expect(
      screen.queryByRole("button", { name: /move my personal plan here/i }),
    ).not.toBeInTheDocument();

    const link = screen.getByRole("link", { name: /activate/i });
    expect(link).toHaveAttribute("href", "/workspaces/my-team/settings/billing");
  });

  it("keeps the plain Activate workspace route when conversion is not on offer", () => {
    mockPaddle(true);
    mockWorkspace({ role: "owner", subscription: null, conversion: null });

    renderInRouter(<WorkspaceActivationEmptyState />);

    expect(
      screen.queryByRole("button", { name: /move my personal plan here/i }),
    ).not.toBeInTheDocument();

    const link = screen.getByRole("link", { name: /activate/i });
    expect(link).toHaveAttribute("href", "/workspaces/my-team/settings/billing");
  });
});
