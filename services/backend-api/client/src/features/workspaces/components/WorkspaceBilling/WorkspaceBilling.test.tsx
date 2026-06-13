import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { PRICE_IDS, ProductKey } from "@/constants";
import { WorkspaceBilling } from "./index";
import { usePaddleContext } from "@/features/subscriptionProducts";
import { useCurrentWorkspace } from "../../contexts/CurrentWorkspaceContext";
import {
  useWorkspace,
  useCancelWorkspaceBilling,
  useResumeWorkspaceBilling,
  useUpdateWorkspaceBilling,
} from "../../hooks";

const h = vi.hoisted(() => ({
  openCheckout: vi.fn(),
  getPricePreview: vi.fn(),
  cancel: vi.fn(),
  resume: vi.fn(),
  update: vi.fn(),
  refetchWorkspace: vi.fn(),
}));

vi.mock("@/features/subscriptionProducts", () => ({
  usePaddleContext: vi.fn(),
}));

vi.mock("../../contexts/CurrentWorkspaceContext", () => ({
  useCurrentWorkspace: vi.fn(),
}));

vi.mock("../../hooks", () => ({
  useWorkspace: vi.fn(),
  useCancelWorkspaceBilling: vi.fn(),
  useResumeWorkspaceBilling: vi.fn(),
  useUpdateWorkspaceBilling: vi.fn(),
  useWorkspaceBillingChangePreview: vi.fn(() => ({
    preview: undefined,
    status: "idle",
    error: null,
  })),
}));

const PRICE_PREVIEWS = [
  {
    id: ProductKey.Tier2,
    name: "Tier 2",
    prices: [
      {
        id: PRICE_IDS[ProductKey.Tier2].month,
        interval: "month",
        formattedPrice: "$10.00",
        currencyCode: "USD",
        quantity: 1,
      },
      {
        id: PRICE_IDS[ProductKey.Tier2].year,
        interval: "year",
        formattedPrice: "$100.00",
        currencyCode: "USD",
        quantity: 1,
      },
    ],
  },
  {
    id: ProductKey.Tier3,
    name: "Tier 3",
    prices: [
      {
        id: PRICE_IDS[ProductKey.Tier3].month,
        interval: "month",
        formattedPrice: "$20.00",
        currencyCode: "USD",
        quantity: 1,
      },
      {
        id: PRICE_IDS[ProductKey.Tier3].year,
        interval: "year",
        formattedPrice: "$200.00",
        currencyCode: "USD",
        quantity: 1,
      },
    ],
  },
];

const mockPaddle = (overrides: Record<string, unknown> = {}) => {
  vi.mocked(usePaddleContext).mockReturnValue({
    isConfigured: true,
    isLoaded: true,
    openCheckout: h.openCheckout,
    getPricePreview: h.getPricePreview,
    isSubscriptionCreated: false,
    ...overrides,
  } as never);
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
  } as never);

  vi.mocked(useWorkspace).mockReturnValue({
    workspace: {
      id: "workspace-1",
      name: "My Team",
      slug: "my-team",
      role,
      maxFeeds: 0,
      subscription,
    },
    status: "success",
    error: null,
    fetchStatus: "idle",
    refetch: h.refetchWorkspace,
  } as never);
};

const activeSubscription = (overrides: Record<string, unknown> = {}) => ({
  productKey: "tier2",
  status: "ACTIVE",
  cancellationDate: null,
  nextBillDate: "2027-03-01T00:00:00.000Z",
  billingInterval: "month",
  billingPeriodEnd: "2027-03-01T00:00:00.000Z",
  currencyCode: "USD",
  addons: [],
  ...overrides,
});

const renderBilling = () =>
  render(
    <MemoryRouter>
      <ChakraProvider value={system}>
        <WorkspaceBilling />
      </ChakraProvider>
    </MemoryRouter>,
  );

describe("WorkspaceBilling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    h.getPricePreview.mockResolvedValue(PRICE_PREVIEWS);
    vi.mocked(useCancelWorkspaceBilling).mockReturnValue({
      mutateAsync: h.cancel,
      status: "idle",
      error: null,
    } as never);
    vi.mocked(useResumeWorkspaceBilling).mockReturnValue({
      mutateAsync: h.resume,
      status: "idle",
      error: null,
    } as never);
    vi.mocked(useUpdateWorkspaceBilling).mockReturnValue({
      mutateAsync: h.update,
      status: "idle",
      error: null,
    } as never);
  });

  it("offers Tier 2/Tier 3 checkout to the owner of an unsubscribed workspace, carrying the workspace id", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    expect(await screen.findByText("$10.00", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("$20.00", { exact: false })).toBeInTheDocument();

    const subscribeButtons = screen.getAllByRole("button", { name: /subscribe/i });
    expect(subscribeButtons).toHaveLength(2);

    fireEvent.click(subscribeButtons[0]);

    expect(h.openCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        displayMode: "overlay",
        prices: [{ priceId: PRICE_IDS[ProductKey.Tier2].month, quantity: 1 }],
        customData: { workspaceId: "workspace-1" },
      }),
    );
  });

  it("shows tier features, the recommended tier, and payment terms on the activation cards", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    const tier2Card = (await screen.findByText("Track 70 news feeds")).closest(
      '[role="listitem"]',
    ) as HTMLElement;
    expect(screen.getByText("Track 140 news feeds")).toBeInTheDocument();
    expect(screen.getByText("Expandable with additional feeds")).toBeInTheDocument();
    expect(within(tier2Card).getByText("Recommended")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /terms and conditions/i })).toHaveAttribute(
      "href",
      "https://monitorss.xyz/terms",
    );
    expect(screen.getByRole("link", { name: /privacy policy/i })).toHaveAttribute(
      "href",
      "https://monitorss.xyz/privacy-policy",
    );
  });

  it("keeps showing the subscription-confirmation state across a remount while the webhook is pending", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    const firstMount = renderBilling();

    fireEvent.click((await screen.findAllByRole("button", { name: /subscribe/i }))[0]);
    const { onCompleted } = h.openCheckout.mock.calls[0][0] as { onCompleted: () => void };
    act(() => onCompleted());

    expect(await screen.findByText(/confirming your subscription/i)).toBeInTheDocument();

    // The owner navigates away and back before the activation webhook lands;
    // payment already succeeded, so the page must not fall back to the
    // "activate this team" pitch as if nothing happened.
    firstMount.unmount();
    renderBilling();

    expect(await screen.findByText(/confirming your subscription/i)).toBeInTheDocument();
  });

  it("shows subscription status to admins with no billing controls", async () => {
    mockPaddle();
    mockWorkspace({ role: "admin", subscription: activeSubscription() });

    renderBilling();

    expect(await screen.findByText(/tier 2/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /subscribe/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel subscription/i })).not.toBeInTheDocument();
    expect(screen.getByText(/only the team owner can manage billing/i)).toBeInTheDocument();
  });

  it("lets the owner cancel an active subscription after confirming", async () => {
    h.cancel.mockResolvedValue(undefined);
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });

    renderBilling();

    fireEvent.click(await screen.findByRole("button", { name: /cancel subscription/i }));

    const confirmButton = await screen.findByRole("button", { name: /^confirm$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(h.cancel).toHaveBeenCalled());
  });

  it("shows the scheduled cancellation and lets the owner resume", async () => {
    h.resume.mockResolvedValue(undefined);
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: activeSubscription({
        cancellationDate: "2027-03-01T00:00:00.000Z",
      }),
    });

    renderBilling();

    expect(await screen.findByText(/will be canceled/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /keep subscription/i }));

    await waitFor(() => expect(h.resume).toHaveBeenCalled());
  });

  it("renders nothing when Paddle is not configured", () => {
    mockPaddle({ isConfigured: false });
    mockWorkspace({ role: "owner", subscription: null });

    const { container } = renderBilling();

    expect(container).toBeEmptyDOMElement();
  });
});
