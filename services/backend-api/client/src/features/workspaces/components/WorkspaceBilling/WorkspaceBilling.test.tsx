import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  useConvertWorkspaceBilling,
  useWorkspaceUpdatePaymentMethodTransaction,
} from "../../hooks";
import { usePersonalConvertibleFeeds } from "../../hooks/usePersonalConvertibleFeeds";

const h = vi.hoisted(() => ({
  openCheckout: vi.fn(),
  getPricePreview: vi.fn(),
  cancel: vi.fn(),
  resume: vi.fn(),
  update: vi.fn(),
  convert: vi.fn(),
  refetchWorkspace: vi.fn(),
  updatePaymentMethod: vi.fn(),
  refetchPaymentMethodTransaction: vi.fn(),
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
  useConvertWorkspaceBilling: vi.fn(),
  useWorkspaceUpdatePaymentMethodTransaction: vi.fn(),
  useWorkspaceBillingChangePreview: vi.fn(() => ({
    preview: undefined,
    status: "idle",
    error: null,
  })),
}));

vi.mock("../../hooks/usePersonalConvertibleFeeds", () => ({
  usePersonalConvertibleFeeds: vi.fn(),
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
    updatePaymentMethod: h.updatePaymentMethod,
    isSubscriptionCreated: false,
    ...overrides,
  } as never);
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
  } as never);

  vi.mocked(useWorkspace).mockReturnValue({
    workspace: {
      id: "workspace-1",
      name: "My Team",
      slug: "my-team",
      role,
      maxFeeds: 0,
      subscription,
      conversion,
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
    vi.mocked(useConvertWorkspaceBilling).mockReturnValue({
      mutateAsync: h.convert,
      status: "idle",
      error: null,
    } as never);
    vi.mocked(usePersonalConvertibleFeeds).mockReturnValue({
      feeds: [],
      status: "success",
    } as never);
    h.refetchPaymentMethodTransaction.mockResolvedValue({
      data: { data: { paddleTransactionId: "txn_default" } },
    });
    vi.mocked(useWorkspaceUpdatePaymentMethodTransaction).mockReturnValue({
      refetch: h.refetchPaymentMethodTransaction,
      error: null,
      fetchStatus: "idle",
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
    expect(
      screen.queryByRole("button", { name: /update payment method/i }),
    ).not.toBeInTheDocument();
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
    // Updating the card stays available even with a cancellation scheduled, so
    // the owner can keep the subscription billable if they later resume.
    expect(screen.getByRole("button", { name: /update payment method/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /keep subscription/i }));

    await waitFor(() => expect(h.resume).toHaveBeenCalled());
  });

  it("lets the owner update the payment method, opening the Paddle overlay with the fetched transaction", async () => {
    h.refetchPaymentMethodTransaction.mockResolvedValue({
      data: { data: { paddleTransactionId: "txn_update_card" } },
    });
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });

    renderBilling();

    fireEvent.click(await screen.findByRole("button", { name: /update payment method/i }));

    await waitFor(() => expect(h.updatePaymentMethod).toHaveBeenCalledWith("txn_update_card"));
  });

  it("marks the update-payment-method button as aria-disabled and blocks re-click when the transaction fails to load", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });
    vi.mocked(useWorkspaceUpdatePaymentMethodTransaction).mockReturnValue({
      refetch: h.refetchPaymentMethodTransaction,
      error: { message: "Could not reach Paddle" },
      fetchStatus: "idle",
    } as never);

    renderBilling();

    expect(await screen.findByText(/failed to start payment method update/i)).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /update payment method/i });
    // SafeLoadingButton signals the failed state via aria-disabled (never the
    // native disabled attribute), so the button stays focusable and announced
    // rather than dropping out of the tab order.
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();

    // Clicking while errored must not re-mint a transaction or reopen Paddle.
    fireEvent.click(button);
    expect(h.refetchPaymentMethodTransaction).not.toHaveBeenCalled();
    expect(h.updatePaymentMethod).not.toHaveBeenCalled();
  });

  it("does not offer to update the payment method on a dormant workspace with no subscription", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    // The activation pitch renders, but there is no card to update yet.
    await screen.findByRole("button", { name: /subscribe to tier 2/i });
    expect(
      screen.queryByRole("button", { name: /update payment method/i }),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when Paddle is not configured", () => {
    mockPaddle({ isConfigured: false });
    mockWorkspace({ role: "owner", subscription: null });

    const { container } = renderBilling();

    expect(container).toBeEmptyDOMElement();
  });

  it("offers the owner a convert entry point when their personal plan is eligible", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 70 },
    });

    renderBilling();

    expect(
      await screen.findByRole("button", { name: /move my plan to this team/i }),
    ).toBeInTheDocument();
  });

  const personalFeed = (overrides: Record<string, unknown> = {}) => ({
    id: "feed-1",
    title: "My Feed",
    url: "https://example.com/feed.xml",
    createdAt: "2024-01-01T00:00:00.000Z",
    healthStatus: "ok",
    computedStatus: "ok",
    ownedByUser: true,
    connectionCount: 1,
    ...overrides,
  });

  const openConvertDialog = async () => {
    fireEvent.click(await screen.findByRole("button", { name: /move my plan to this team/i }));
  };

  it("lists the owner's personal feeds in the convert dialog with a live capacity counter", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 70 },
    });
    vi.mocked(usePersonalConvertibleFeeds).mockReturnValue({
      feeds: [
        personalFeed({ id: "feed-1", title: "Alpha Feed" }),
        personalFeed({ id: "feed-2", title: "Beta Feed" }),
      ],
      status: "success",
    } as never);

    renderBilling();
    await openConvertDialog();

    expect(await screen.findByText("Alpha Feed")).toBeInTheDocument();
    expect(screen.getByText("Beta Feed")).toBeInTheDocument();
    // Safe default: all feeds selected → 2 of 70 slots.
    expect(screen.getByText(/Selected 2 \/ 70 team slots/)).toBeInTheDocument();
  });

  it("marks a deselected feed as one that will be disabled", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 70 },
    });
    vi.mocked(usePersonalConvertibleFeeds).mockReturnValue({
      feeds: [personalFeed({ id: "feed-1", title: "Alpha Feed" })],
      status: "success",
    } as never);

    renderBilling();
    await openConvertDialog();

    const checkbox = await screen.findByRole("checkbox", { name: /alpha feed/i });
    await userEvent.click(checkbox);

    // The per-feed inline marker (distinct from the summary line).
    expect(await screen.findByText(/^will be disabled$/i)).toBeInTheDocument();
  });

  it("converts the selected feeds after the owner types the team slug to confirm", async () => {
    h.convert.mockResolvedValue(undefined);
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 70 },
    });
    vi.mocked(usePersonalConvertibleFeeds).mockReturnValue({
      feeds: [
        personalFeed({ id: "feed-1", title: "Alpha Feed" }),
        personalFeed({ id: "feed-2", title: "Beta Feed" }),
      ],
      status: "success",
    } as never);

    renderBilling();
    await openConvertDialog();

    // Leave Beta behind.
    await userEvent.click(await screen.findByRole("checkbox", { name: /beta feed/i }));

    const confirmButton = screen.getByRole("button", { name: /^move plan$/i });
    // SafeLoadingButton expresses "disabled" via aria-disabled (it never drops
    // out of the focus order), so the gate is the aria attribute, not native.
    expect(confirmButton).toHaveAttribute("aria-disabled", "true");

    fireEvent.change(screen.getByLabelText(/type "my-team" to confirm/i), {
      target: { value: "my-team" },
    });
    expect(confirmButton).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(h.convert).toHaveBeenCalledWith({
        workspaceSlug: "my-team",
        feedIds: ["feed-1"],
      }),
    );
  });

  it("surfaces an error in the convert dialog when the personal feed list fails to load", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 70 },
    });
    vi.mocked(usePersonalConvertibleFeeds).mockReturnValue({
      feeds: [],
      status: "error",
      error: { message: "Failed to load feeds" },
    } as never);

    renderBilling();
    await openConvertDialog();

    // The fetch failure must be visible, not a silently empty feed list.
    expect(await screen.findByText(/could not load your feeds/i)).toBeInTheDocument();
  });

  it("keeps the confirm button disabled while more feeds are selected than the plan allows", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 1 },
    });
    vi.mocked(usePersonalConvertibleFeeds).mockReturnValue({
      feeds: [
        personalFeed({ id: "feed-1", title: "Alpha Feed" }),
        personalFeed({ id: "feed-2", title: "Beta Feed" }),
      ],
      status: "success",
    } as never);

    renderBilling();
    await openConvertDialog();

    // Both feeds selected by default, but the plan only allows 1: over capacity.
    expect(await screen.findByText(/Selected 2 \/ 1 team slots/)).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: /^move plan$/i });

    // Typing the slug is not enough: an over-capacity selection must stay
    // blocked client-side instead of round-tripping to a server rejection.
    fireEvent.change(screen.getByLabelText(/type "my-team" to confirm/i), {
      target: { value: "my-team" },
    });
    expect(confirmButton).toHaveAttribute("aria-disabled", "true");

    // Deselecting back to within capacity unblocks it.
    await userEvent.click(screen.getByRole("checkbox", { name: /beta feed/i }));
    expect(confirmButton).not.toHaveAttribute("aria-disabled", "true");
  });

  it("shows the confirming state after a successful conversion while the webhook lands", async () => {
    h.convert.mockResolvedValue(undefined);
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 70 },
    });
    vi.mocked(usePersonalConvertibleFeeds).mockReturnValue({
      feeds: [personalFeed({ id: "feed-1", title: "Alpha Feed" })],
      status: "success",
    } as never);

    renderBilling();
    await openConvertDialog();

    fireEvent.change(await screen.findByLabelText(/type "my-team" to confirm/i), {
      target: { value: "my-team" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^move plan$/i }));

    expect(await screen.findByText(/confirming your subscription/i)).toBeInTheDocument();
  });

  it("selects every feed with Bring all after some were deselected", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 70 },
    });
    vi.mocked(usePersonalConvertibleFeeds).mockReturnValue({
      feeds: [
        personalFeed({ id: "feed-1", title: "Alpha Feed" }),
        personalFeed({ id: "feed-2", title: "Beta Feed" }),
      ],
      status: "success",
    } as never);

    renderBilling();
    await openConvertDialog();

    await userEvent.click(await screen.findByRole("checkbox", { name: /alpha feed/i }));
    expect(await screen.findByText(/Selected 1 \/ 70 team slots/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /bring all/i }));
    expect(await screen.findByText(/Selected 2 \/ 70 team slots/)).toBeInTheDocument();
    expect(screen.queryByText(/will be disabled/i)).not.toBeInTheDocument();
  });

  it("tells a Free/Tier 1 owner to buy a team plan directly instead of offering conversion", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: false, ineligibleReason: "PERSONAL_PLAN_INELIGIBLE" },
    });

    renderBilling();

    expect(await screen.findByText(/buy a team plan directly/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /move my plan to this team/i }),
    ).not.toBeInTheDocument();
  });

  it("shows no conversion entry point when conversion is not on offer", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null, conversion: null });

    renderBilling();

    // The activation pitch still renders, but nothing about conversion.
    await screen.findByRole("button", { name: /subscribe to tier 2/i });
    expect(
      screen.queryByRole("button", { name: /move my plan to this team/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/buy a team plan directly/i)).not.toBeInTheDocument();
  });
});
