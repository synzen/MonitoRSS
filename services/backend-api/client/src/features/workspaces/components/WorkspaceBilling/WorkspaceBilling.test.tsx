import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { PRICE_IDS, ProductKey } from "@/constants";
import { WorkspaceBilling, TIER_FEED_LIMITS } from "./index";
import { usePaddleContext } from "@/features/subscriptionProducts";
import { useCurrentWorkspace } from "../../contexts/CurrentWorkspaceContext";
import {
  useWorkspace,
  useCancelWorkspaceBilling,
  useResumeWorkspaceBilling,
  useUpdateWorkspaceBilling,
  useConvertWorkspaceBilling,
  useWorkspaceUpdatePaymentMethodTransaction,
  useWorkspaceBillingChangePreview,
} from "../../hooks";
import { useUserFeedsInfinite } from "../../../feed/hooks/useUserFeedsInfinite";
import { getUserFeeds } from "../../../feed/api";

const h = vi.hoisted(() => ({
  openCheckout: vi.fn(),
  getPricePreview: vi.fn(),
  getChargePreview: vi.fn(),
  cancel: vi.fn(),
  resume: vi.fn(),
  update: vi.fn(),
  convert: vi.fn(),
  refetchWorkspace: vi.fn(),
  updatePaymentMethod: vi.fn(),
  resetCheckoutData: vi.fn(),
  refetchPaymentMethodTransaction: vi.fn(),
}));

vi.mock("@/features/subscriptionProducts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/subscriptionProducts")>()),
  usePaddleContext: vi.fn(),
}));

vi.mock("../../contexts/CurrentWorkspaceContext", () => ({
  useCurrentWorkspace: vi.fn(),
}));

// The activation-polling hook is the real implementation: the confirming ->
// active flow these tests assert on is exactly its behavior, so mocking it would
// test the mock. Everything else in the barrel is faked.
vi.mock("../../hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks")>()),
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

vi.mock("../../../feed/hooks/useUserFeedsInfinite", () => ({
  useUserFeedsInfinite: vi.fn(),
}));

// The convert dialog's auto-pick ("Select them for me") fetches the cap's worth
// of feeds directly. Mocked so the over-limit flow can be driven without a
// network round-trip; the detailed auto-pick contract lives in the feed-list
// unit test.
vi.mock("../../../feed/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../feed/api")>()),
  getUserFeeds: vi.fn(),
}));

// Drives the convert dialog's feed list. Feeds are returned as a single page by
// default (the common case is a handful of feeds); pass multiple pages to
// exercise pagination. `total` defaults to the flattened feed count.
const mockConvertibleFeeds = (
  feeds: Array<{ id: string; title: string }>,
  opts: { status?: string; error?: unknown; total?: number; hasNextPage?: boolean } = {},
) => {
  // Reset first: a mockImplementation set elsewhere (e.g. the feed-list unit
  // test's paginated fake, which shares this mocked module) would otherwise take
  // precedence over mockReturnValue and feed this suite the wrong data.
  vi.mocked(useUserFeedsInfinite).mockReset();
  vi.mocked(useUserFeedsInfinite).mockReturnValue({
    data: {
      pages: [{ total: opts.total ?? feeds.length, results: feeds }],
    },
    status: opts.status ?? "success",
    error: opts.error ?? null,
    fetchNextPage: vi.fn(),
    isFetching: false,
    setSearch: vi.fn(),
    hasNextPage: opts.hasNextPage ?? false,
    isFetchingNextPage: false,
    search: "",
  } as never);
};

const PRICE_PREVIEWS = [
  {
    id: ProductKey.Tier2,
    name: "Tier 2",
    prices: [
      {
        id: PRICE_IDS[ProductKey.Tier2].month,
        interval: "month",
        formattedPrice: "$10.00",
        unitAmount: 1000,
        currencyCode: "USD",
        quantity: 1,
      },
      {
        id: PRICE_IDS[ProductKey.Tier2].year,
        interval: "year",
        formattedPrice: "$100.00",
        unitAmount: 10000,
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
  {
    id: ProductKey.Tier3Feed,
    name: "Tier 3 Feed",
    prices: [
      {
        id: PRICE_IDS[ProductKey.Tier3Feed].month,
        interval: "month",
        formattedPrice: "$0.50",
        unitAmount: 50,
        currencyCode: "USD",
        quantity: 1,
      },
      {
        id: PRICE_IDS[ProductKey.Tier3Feed].year,
        interval: "year",
        formattedPrice: "$5.00",
        unitAmount: 500,
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
    getChargePreview: h.getChargePreview,
    updatePaymentMethod: h.updatePaymentMethod,
    resetCheckoutData: h.resetCheckoutData,
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
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <ChakraProvider value={system}>
          <WorkspaceBilling />
        </ChakraProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("WorkspaceBilling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    // One price preview powers the whole capacity slider: it carries the Tier2
    // base and Tier3Feed per-feed unit prices (with unitAmount in minor units),
    // from which the slider derives any detent. $10.00 base + $0.50/feed, so 70
    // feeds = $10.00 and 100 feeds = 1000 + 30*50 = $25.00.
    h.getPricePreview.mockResolvedValue(PRICE_PREVIEWS);
    // The Tier 3 card asks for the authoritative recurring total whenever extra
    // feeds are chosen; default to a recognizable combined figure.
    h.getChargePreview.mockResolvedValue({ totalFormatted: "$35.00" });
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
    mockConvertibleFeeds([]);
    h.refetchPaymentMethodTransaction.mockResolvedValue({
      data: { data: { paddleTransactionId: "txn_default" } },
    });
    vi.mocked(useWorkspaceUpdatePaymentMethodTransaction).mockReturnValue({
      refetch: h.refetchPaymentMethodTransaction,
      error: null,
      fetchStatus: "idle",
    } as never);
  });

  it("offers a single Team plan with a capacity slider (not separate tier cards) to the owner of an unsubscribed workspace", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    // The capacity selector is one slider over the whole Team plan, not a grid of
    // Tier 2 / Tier 3 cards each with their own price and Subscribe button.
    const slider = await screen.findByRole("slider", { name: /how many feeds/i });
    expect(slider).toBeInTheDocument();
    // The slider starts at the base capacity and announces feeds, not an index.
    expect(slider).toHaveAttribute("aria-valuetext", "70 feeds");

    // One Subscribe action for the single plan, not one per tier.
    expect(screen.getAllByRole("button", { name: /subscribe/i })).toHaveLength(1);
  });

  it("subscribes the unsubscribed owner at the base capacity, carrying the workspace id, via an inline dialog", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    const subscribeButton = await screen.findByRole("button", { name: /subscribe/i });
    fireEvent.click(subscribeButton);

    // At base capacity the basket is just the Tier 2 base. Checkout renders inline
    // inside a dialog (frameTarget), never as Paddle's page-leaking overlay; the
    // open is gated on the frame container mounting, so wait for the call.
    await waitFor(() =>
      expect(h.openCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          frameTarget: expect.any(String),
          prices: [{ priceId: PRICE_IDS[ProductKey.Tier2].month, quantity: 1 }],
          customData: { workspaceId: "workspace-1" },
        }),
      ),
    );
    expect(h.openCheckout.mock.calls[0][0]).not.toHaveProperty("displayMode", "overlay");
  });

  it("frames activation around co-managing feeds, not creating a workspace the owner already has", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    // The owner is already inside the workspace, so the pitch is the one real
    // benefit of paying (a team managing shared feeds), not "create a workspace".
    expect(await screen.findByText(/manage this workspace's feeds together/i)).toBeInTheDocument();
    expect(screen.queryByText(/create a shared workspace/i)).not.toBeInTheDocument();
  });

  it("shows the base price, capacity, and payment terms on the activation slider", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    // At the base detent the headline is the base workspace price for 70 feeds.
    // formatCurrency drops a trailing ".00", so $10.00 renders as "$10".
    expect(await screen.findByText("$10", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/70 feeds \/ month/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /terms and conditions/i })).toHaveAttribute(
      "href",
      "https://monitorss.xyz/terms",
    );
    expect(screen.getByRole("link", { name: /privacy policy/i })).toHaveAttribute(
      "href",
      "https://monitorss.xyz/privacy-policy",
    );
  });

  it("folds the slider overage above the base into one activation checkout with a live price", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    // Base price before moving the slider (formatCurrency drops the ".00").
    expect(await screen.findByText("$10", { exact: false })).toBeInTheDocument();

    // Slide one detent up: 70 -> 100 feeds, i.e. 30 add-on feeds above the base.
    const slider = await screen.findByRole("slider", { name: /how many feeds/i });
    slider.focus();
    await userEvent.keyboard("{ArrowRight}");

    // The headline reflects the combined recurring total derived from the single
    // preview (base $10.00 + 30 add-on feeds * $0.50 = $25.00, rendered "$25" as
    // formatCurrency drops the ".00"), with no per-detent round-trip: the whole
    // range is priced from that one preview.
    const total = await screen.findByText("$25", { exact: false });

    // The price summary is a polite live region that settles once resolved.
    const liveRegion = total.closest('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    await waitFor(() => expect(liveRegion).toHaveAttribute("aria-busy", "false"));

    // Subscribing buys exactly that capacity in one basket.
    fireEvent.click(screen.getByRole("button", { name: /subscribe to team, 100 feeds total/i }));
    await waitFor(() =>
      expect(h.openCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          prices: [
            { priceId: PRICE_IDS[ProductKey.Tier2].month, quantity: 1 },
            { priceId: PRICE_IDS[ProductKey.Tier3Feed].month, quantity: 30 },
          ],
          customData: { workspaceId: "workspace-1" },
        }),
      ),
    );
  });

  it("places the payment-terms consent above the Subscribe buttons so it is read before committing", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    // Subscribing is the act of consent: a keyboard/screen-reader user must meet
    // the terms before, not after, the button that binds them. Assert the
    // disclosure precedes the first Subscribe button in DOM (and tab) order.
    const terms = await screen.findByRole("link", { name: /terms and conditions/i });
    const firstSubscribe = screen.getAllByRole("button", { name: /subscribe to/i })[0];
    expect(terms.compareDocumentPosition(firstSubscribe)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("marks the Subscribe buttons as opening a dialog", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    // The Subscribe button opens the checkout dialog, so it declares that up
    // front for assistive tech.
    const subscribeButtons = await screen.findAllByRole("button", { name: /subscribe to/i });
    subscribeButtons.forEach((button) => expect(button).toHaveAttribute("aria-haspopup", "dialog"));
  });

  it("opens a titled, secure checkout dialog when the owner subscribes", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    const subscribeButton = (await screen.findAllByRole("button", { name: /subscribe to/i }))[0];
    fireEvent.click(subscribeButton);

    // A real titled dialog hosts the checkout, so it announces itself to a
    // screen reader on open (no separate live-region narration needed). The
    // accessible name carries the action, and the secure-payment reassurance is
    // visible to everyone in the body.
    const dialog = await screen.findByRole("dialog", {
      name: /subscribe to team \(70 feeds\)/i,
    });
    expect(within(dialog).getByText(/payment is handled securely by paddle/i)).toBeInTheDocument();
  });

  it("hosts the checkout inline inside the dialog (not Paddle's page-leaking overlay)", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    fireEvent.click((await screen.findAllByRole("button", { name: /subscribe to/i }))[0]);

    // The dialog hosts an app-owned container that Paddle paints into inline, so
    // the frame lives inside the dialog (Chakra inerts the page around it) rather
    // than as a body-sibling overlay the page can tab behind. The dialog is
    // portalled, so query the document, then assert containment in the dialog.
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(h.openCheckout).toHaveBeenCalled());
    const frameTarget = h.openCheckout.mock.calls[0][0].frameTarget as string;
    expect(frameTarget).toBeTruthy();
    const frame = document.querySelector(`.${frameTarget}`);
    expect(frame).not.toBeNull();
    expect(dialog.contains(frame)).toBe(true);
  });

  it("returns focus to the Subscribe button when checkout is cancelled", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    const subscribeButton = (await screen.findAllByRole("button", { name: /subscribe to/i }))[0];
    subscribeButton.focus();
    fireEvent.click(subscribeButton);

    // Cancelling leaves the page unchanged, so focus must go back to the opener
    // rather than being stranded at the top of the document.
    await waitFor(() => expect(h.openCheckout).toHaveBeenCalled());
    const { onClose } = h.openCheckout.mock.calls[0][0] as { onClose: () => void };
    act(() => onClose());

    // Focus is restored after the dialog closes (deferred past its own restore).
    await waitFor(() => expect(subscribeButton).toHaveFocus());
  });

  it("moves focus to the page heading when checkout completes", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    const subscribeButton = (await screen.findAllByRole("button", { name: /subscribe to/i }))[0];
    subscribeButton.focus();
    fireEvent.click(subscribeButton);

    // On success the Subscribe button unmounts as the page flips to the
    // confirming state, so focus must follow the transition. The transient
    // confirming-status region unmounts once the subscription lands, so focus
    // goes to the always-present page heading instead (a button-restore would
    // land on the document body).
    await waitFor(() => expect(h.openCheckout).toHaveBeenCalled());
    const { onCompleted } = h.openCheckout.mock.calls[0][0] as { onCompleted: () => void };
    act(() => onCompleted());

    const heading = await screen.findByRole("heading", { level: 1, name: /billing/i });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("announces payment success, then activation, through a polite status region", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    const { rerender } = renderBilling();

    fireEvent.click((await screen.findAllByRole("button", { name: /subscribe to/i }))[0]);
    await waitFor(() => expect(h.openCheckout).toHaveBeenCalled());
    const { onCompleted } = h.openCheckout.mock.calls[0][0] as { onCompleted: () => void };
    act(() => onCompleted());

    // Stage one: payment captured, dialog closed, activation pending.
    const status = await screen.findByRole("status");
    await waitFor(() =>
      expect(status).toHaveTextContent(/payment successful\. confirming your subscription/i),
    );

    // The activation webhook lands; the workspace read now returns a
    // subscription. Stage two announces provisioning is complete.
    mockWorkspace({ role: "owner", subscription: activeSubscription() });
    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <ChakraProvider value={system}>
            <WorkspaceBilling />
          </ChakraProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(status).toHaveTextContent(/your workspace is now active/i));
  });

  it("seeds the activation slider from the pricing dialog's ?feeds hand-off", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    // The buy-time pricing dialog hands the chosen capacity over as ?feeds=N. The
    // activation slider seats it on the next detent at or above the request (250
    // -> 300), never silently downgrading.
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={["/?feeds=250"]}>
          <ChakraProvider value={system}>
            <WorkspaceBilling />
          </ChakraProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const slider = await screen.findByRole("slider", { name: /how many feeds/i });
    expect(slider).toHaveAttribute("aria-valuetext", "300 feeds");
    expect(
      screen.getByRole("button", { name: /subscribe to team, 300 feeds total/i }),
    ).toBeInTheDocument();
  });

  it("keeps showing the subscription-confirmation state across a remount while the webhook is pending", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    const firstMount = renderBilling();

    fireEvent.click((await screen.findAllByRole("button", { name: /subscribe/i }))[0]);
    await waitFor(() => expect(h.openCheckout).toHaveBeenCalled());
    const { onCompleted } = h.openCheckout.mock.calls[0][0] as { onCompleted: () => void };
    act(() => onCompleted());

    // The visible spinner text and the live-region announcement both mention
    // "confirming", so target the visible paragraph specifically.
    expect(
      await screen.findByText("Confirming your subscription…", { selector: "p" }),
    ).toBeInTheDocument();

    // The owner navigates away and back before the activation webhook lands;
    // payment already succeeded, so the page must not fall back to the
    // "activate this workspace" pitch as if nothing happened.
    firstMount.unmount();
    renderBilling();

    expect(
      await screen.findByText("Confirming your subscription…", { selector: "p" }),
    ).toBeInTheDocument();
  });

  it("shows subscription status to admins with no billing controls", async () => {
    mockPaddle();
    mockWorkspace({ role: "admin", subscription: activeSubscription() });

    renderBilling();

    expect(await screen.findByText(/^Team$/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /subscribe/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel subscription/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /update payment method/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/only the workspace owner can manage billing/i)).toBeInTheDocument();
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

  it("shows the billing email on the current plan when present", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: activeSubscription({ billingEmail: "owner-billing@example.com" }),
    });

    renderBilling();

    expect(await screen.findByText(/billed to/i)).toBeInTheDocument();
    expect(screen.getByText("owner-billing@example.com")).toBeInTheDocument();
  });

  it("omits the billing-to line when no billing email is present", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });

    renderBilling();

    await screen.findByRole("heading", { name: /current plan/i });
    expect(screen.queryByText(/billed to/i)).not.toBeInTheDocument();
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

  it("lets the owner update the payment method, opening an inline checkout with the fetched transaction", async () => {
    h.refetchPaymentMethodTransaction.mockResolvedValue({
      data: { data: { paddleTransactionId: "txn_update_card" } },
    });
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });

    renderBilling();

    fireEvent.click(await screen.findByRole("button", { name: /update payment method/i }));

    // Inline (frameTarget) so the checkout renders inside the dialog, not
    // Paddle's page-leaking overlay; the open is gated on the frame mounting.
    await waitFor(() =>
      expect(h.updatePaymentMethod).toHaveBeenCalledWith(
        "txn_update_card",
        expect.objectContaining({
          onClose: expect.any(Function),
          frameTarget: expect.any(String),
        }),
      ),
    );
  });

  it("tells screen readers the update-payment button opens a dialog before it is activated", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });

    renderBilling();

    // aria-haspopup announces "opens dialog" on focus, so the user knows the
    // checkout dialog is coming before committing to the click.
    const button = await screen.findByRole("button", { name: /update payment method/i });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("opens a titled, secure checkout dialog when the owner updates the payment method", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });

    renderBilling();

    fireEvent.click(await screen.findByRole("button", { name: /update payment method/i }));

    // The update-payment checkout is hosted in a real titled dialog, so it
    // self-announces on open; the secure-payment reassurance is in the body.
    const dialog = await screen.findByRole("dialog", { name: /update payment method/i });
    expect(within(dialog).getByText(/payment is handled securely by paddle/i)).toBeInTheDocument();
  });

  it("returns focus to the update-payment button when its checkout is cancelled", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });

    renderBilling();

    const button = await screen.findByRole("button", { name: /update payment method/i });
    button.focus();
    fireEvent.click(button);

    await waitFor(() => expect(h.updatePaymentMethod).toHaveBeenCalled());
    // Cancelling changes nothing, so focus returns to the opener instead of
    // being stranded on the document body when the dialog closes.
    const { onClose } = h.updatePaymentMethod.mock.calls[0][1] as { onClose: () => void };
    act(() => onClose());

    await waitFor(() => expect(button).toHaveFocus());
  });

  it("surfaces a payment-method-update failure inline while keeping the button retryable", async () => {
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
    // The button must NOT be disabled by a prior error: a transient failure has
    // to be retryable, and refetch() clears the error on a fresh attempt. A
    // hard-disable here would strand the owner until a full page reload.
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute("aria-disabled", "true");

    // Clicking after an error re-mints the transaction (the retry path).
    fireEvent.click(button);
    await waitFor(() => expect(h.refetchPaymentMethodTransaction).toHaveBeenCalled());
  });

  it("does not offer to update the payment method on a dormant workspace with no subscription", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    // The activation pitch renders, but there is no card to update yet.
    await screen.findByRole("button", { name: /subscribe to team, 70 feeds total/i });
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
      await screen.findByRole("button", { name: /move my plan to this workspace/i }),
    ).toBeInTheDocument();
  });

  const personalFeed = (overrides: { id: string; title: string }) => overrides;

  const openConvertDialog = async () => {
    fireEvent.click(await screen.findByRole("button", { name: /move my plan to this workspace/i }));
  };

  // Under the limit, the feed list is tucked behind a disclosure; expand it to
  // reach the per-feed checkboxes.
  const expandFeedList = async () => {
    fireEvent.click(await screen.findByText(/choose which feeds to bring/i));
  };

  it("defaults to bringing every feed with a live capacity counter", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 70 },
    });
    mockConvertibleFeeds([
      personalFeed({ id: "feed-1", title: "Alpha Feed" }),
      personalFeed({ id: "feed-2", title: "Beta Feed" }),
    ]);

    renderBilling();
    await openConvertDialog();

    // Safe default: every feed selected → 2 of 70 feeds.
    expect(await screen.findByText(/2 of 70 feeds selected/)).toBeInTheDocument();

    await expandFeedList();
    expect(await screen.findByText("Alpha Feed")).toBeInTheDocument();
    expect(screen.getByText("Beta Feed")).toBeInTheDocument();
  });

  it("marks a deselected feed as one that stays personal", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 70 },
    });
    mockConvertibleFeeds([personalFeed({ id: "feed-1", title: "Alpha Feed" })]);

    renderBilling();
    await openConvertDialog();
    await expandFeedList();

    const checkbox = await screen.findByRole("checkbox", { name: /alpha feed/i });
    const marker = screen.getByText(/^stays personal$/i);
    // Selected by default: the consequence marker is present but hidden.
    expect(marker).not.toBeVisible();

    await userEvent.click(checkbox);
    expect(marker).toBeVisible();
  });

  it("converts the selected feeds after the owner types the workspace slug to confirm", async () => {
    h.convert.mockResolvedValue(undefined);
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 70 },
    });
    mockConvertibleFeeds([
      personalFeed({ id: "feed-1", title: "Alpha Feed" }),
      personalFeed({ id: "feed-2", title: "Beta Feed" }),
    ]);

    renderBilling();
    await openConvertDialog();
    await expandFeedList();

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
    mockConvertibleFeeds([], {
      status: "error",
      error: { message: "Failed to load feeds" },
      total: 0,
    });

    renderBilling();
    await openConvertDialog();
    await expandFeedList();

    // The fetch failure must be visible, not a silently empty feed list.
    expect(await screen.findByText(/could not load your feeds/i)).toBeInTheDocument();
  });

  it("opens empty with triage framing when over the plan limit, so the owner chooses", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 1 },
    });
    // Two feeds, plan fits one: over the limit. No invisible machine default;
    // the dialog opens with nothing selected and the owner picks.
    mockConvertibleFeeds([
      personalFeed({ id: "feed-1", title: "Alpha Feed" }),
      personalFeed({ id: "feed-2", title: "Beta Feed" }),
    ]);

    renderBilling();
    await openConvertDialog();

    // Nothing selected on open (0 of 1, shown in the list's capacity meter), and
    // the list is shown up front (no disclosure to expand) with the choose-which
    // framing.
    expect(await screen.findByText(/0 of 1 selected/)).toBeInTheDocument();
    expect(screen.getByText(/more feeds than this plan allows/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: /^move plan$/i });
    fireEvent.change(screen.getByLabelText(/type "my-team" to confirm/i), {
      target: { value: "my-team" },
    });
    // Typing the slug is not enough while nothing is selected: there is nothing
    // to move.
    expect(confirmButton).toHaveAttribute("aria-disabled", "true");

    // Choosing a feed unblocks confirm.
    await userEvent.click(await screen.findByRole("checkbox", { name: /alpha feed/i }));
    expect(await screen.findByText(/1 of 1 selected/)).toBeInTheDocument();
    expect(confirmButton).not.toHaveAttribute("aria-disabled", "true");
  });

  it("blocks confirm when the owner selects more feeds than the plan allows", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 1 },
    });
    mockConvertibleFeeds([
      personalFeed({ id: "feed-1", title: "Alpha Feed" }),
      personalFeed({ id: "feed-2", title: "Beta Feed" }),
    ]);

    renderBilling();
    await openConvertDialog();

    // Over-limit opens empty; selecting both feeds exceeds the 1-feed plan. The
    // second check is allowed (never blocked) so the owner can triage — the
    // guard is on confirm, not the checkbox.
    expect(await screen.findByText(/0 of 1 selected/)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("checkbox", { name: /alpha feed/i }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /beta feed/i }));
    expect(await screen.findByText(/2 of 1 selected/)).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: /^move plan$/i });
    fireEvent.change(screen.getByLabelText(/type "my-team" to confirm/i), {
      target: { value: "my-team" },
    });
    expect(confirmButton).toHaveAttribute("aria-disabled", "true");

    // Deselecting back to within capacity unblocks it.
    await userEvent.click(screen.getByRole("checkbox", { name: /beta feed/i }));
    expect(confirmButton).not.toHaveAttribute("aria-disabled", "true");
  });

  it("auto-picks the cap's worth of feeds from the over-limit dialog in one action", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 1 },
    });
    mockConvertibleFeeds([
      personalFeed({ id: "feed-1", title: "Alpha Feed" }),
      personalFeed({ id: "feed-2", title: "Beta Feed" }),
    ]);
    // Auto-pick fetches the cap's worth (1) directly; return the newest one.
    vi.mocked(getUserFeeds).mockResolvedValue({
      results: [{ id: "feed-2", title: "Beta Feed", createdAt: "2020-01-02T00:00:00.000Z" }],
      total: 2,
      feedsWithoutConnections: 0,
    } as never);

    h.convert.mockResolvedValue(undefined);
    renderBilling();
    await openConvertDialog();

    expect(await screen.findByText(/0 of 1 selected/)).toBeInTheDocument();
    // One action fills to the cap, never past it: 1 of 1, not 2.
    await userEvent.click(screen.getByRole("button", { name: /select my newest 1 feeds/i }));
    expect(await screen.findByText(/1 of 1 selected/)).toBeInTheDocument();

    // The conversion moves exactly the auto-picked feed, not both.
    fireEvent.change(screen.getByLabelText(/type "my-team" to confirm/i), {
      target: { value: "my-team" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^move plan$/i }));
    await waitFor(() =>
      expect(h.convert).toHaveBeenCalledWith({ workspaceSlug: "my-team", feedIds: ["feed-2"] }),
    );
  });

  it("moves only the in-capacity feeds after the owner trims an over-cap selection", async () => {
    h.convert.mockResolvedValue(undefined);
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 1 },
    });
    mockConvertibleFeeds([
      personalFeed({ id: "feed-1", title: "Alpha Feed" }),
      personalFeed({ id: "feed-2", title: "Beta Feed" }),
    ]);

    renderBilling();
    await openConvertDialog();

    // Over-select (allowed), then trim back to capacity, then convert: the move
    // carries only what remains selected.
    await userEvent.click(await screen.findByRole("checkbox", { name: /alpha feed/i }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /beta feed/i }));
    expect(await screen.findByText(/2 of 1 selected/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /beta feed/i }));

    fireEvent.change(screen.getByLabelText(/type "my-team" to confirm/i), {
      target: { value: "my-team" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^move plan$/i }));
    await waitFor(() =>
      expect(h.convert).toHaveBeenCalledWith({ workspaceSlug: "my-team", feedIds: ["feed-1"] }),
    );
  });

  it("shows the confirming state after a successful conversion while the webhook lands", async () => {
    h.convert.mockResolvedValue(undefined);
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 70 },
    });
    mockConvertibleFeeds([personalFeed({ id: "feed-1", title: "Alpha Feed" })]);

    renderBilling();
    await openConvertDialog();

    fireEvent.change(await screen.findByLabelText(/type "my-team" to confirm/i), {
      target: { value: "my-team" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^move plan$/i }));

    expect(
      await screen.findByText("Confirming your subscription…", { selector: "p" }),
    ).toBeInTheDocument();
  });

  it("re-selecting a deselected feed restores the count and clears the warning", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: true, feedLimit: 70 },
    });
    mockConvertibleFeeds([
      personalFeed({ id: "feed-1", title: "Alpha Feed" }),
      personalFeed({ id: "feed-2", title: "Beta Feed" }),
    ]);

    renderBilling();
    await openConvertDialog();
    await expandFeedList();

    const alpha = await screen.findByRole("checkbox", { name: /alpha feed/i });
    // The marker is always in the DOM (its space is reserved so toggling never
    // reflows the list); selection toggles its visibility, not its presence.
    const alphaRow = alpha.closest("li") as HTMLElement;
    const alphaMarker = within(alphaRow).getByText(/^stays personal$/i);
    expect(alphaMarker).not.toBeVisible();

    await userEvent.click(alpha);
    expect(await screen.findByText(/1 of 70 feeds selected/)).toBeInTheDocument();
    expect(alphaMarker).toBeVisible();

    await userEvent.click(alpha);
    expect(await screen.findByText(/2 of 70 feeds selected/)).toBeInTheDocument();
    expect(alphaMarker).not.toBeVisible();
  });

  it("tells a Free/Tier 1 owner to buy a workspace plan directly instead of offering conversion", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: null,
      conversion: { eligible: false, ineligibleReason: "PERSONAL_PLAN_INELIGIBLE" },
    });

    renderBilling();

    expect(await screen.findByText(/buy a workspace plan directly/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /move my plan to this workspace/i }),
    ).not.toBeInTheDocument();
  });

  it("shows no conversion entry point when conversion is not on offer", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null, conversion: null });

    renderBilling();

    // The activation pitch still renders, but nothing about conversion.
    await screen.findByRole("button", { name: /subscribe to team, 70 feeds total/i });
    expect(
      screen.queryByRole("button", { name: /move my plan to this workspace/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/buy a workspace plan directly/i)).not.toBeInTheDocument();
  });

  const mockChangePreview = (overrides: Record<string, unknown> = {}) => {
    vi.mocked(useWorkspaceBillingChangePreview).mockReturnValue({
      preview: {
        immediateTransaction: {
          billingPeriod: {
            startsAt: "2027-02-01T00:00:00.000Z",
            endsAt: "2027-02-28T00:00:00.000Z",
          },
          subtotalFormatted: "$0",
          taxFormatted: "-$0.82",
          // A real proration credit (positive minor units). The dialog renders
          // it as a deduction; a "0" credit hides the row entirely.
          credit: "500",
          creditFormatted: "$5.00",
          grandTotalFormatted: "$0",
        },
        feedImpact: {
          newFeedLimit: 140,
          currentFeedCount: 10,
          willBeDisabledCount: 0,
        },
        ...overrides,
      },
      status: "success",
      error: null,
    } as never);
  };

  // Open the change-capacity dialog from the subscribed current-plan view.
  const openChangeDialog = async () => {
    fireEvent.click(await screen.findByRole("button", { name: /change capacity/i }));
    // The dialog hosts the capacity slider.
    await screen.findByRole("slider", { name: /how many feeds/i });
  };

  // Drag the change-dialog slider to a target detent by pressing arrow keys from
  // the current position. The slider is index-driven, so each press is one detent.
  const setSliderToFeeds = async (targetFeeds: number) => {
    const slider = await screen.findByRole("slider", { name: /how many feeds/i });
    const detents = [70, 100, 140, 200, 300, 500];
    const targetIndex = detents.findIndex((d) => d >= targetFeeds);
    const currentText = slider.getAttribute("aria-valuetext") ?? "";
    const currentFeeds = parseInt(currentText, 10);
    const currentIndex = detents.findIndex((d) => d >= currentFeeds);
    const delta = targetIndex - currentIndex;
    slider.focus();

    for (let i = 0; i < Math.abs(delta); i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await userEvent.keyboard(delta > 0 ? "{ArrowRight}" : "{ArrowLeft}");
    }
  };

  it("shows a read-only current plan with a Change capacity button, not tier-switch cards", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });
    mockChangePreview();

    renderBilling();

    // The subscribed owner manages capacity via one deliberate "Change capacity"
    // button, not a grid of "Switch to Tier N" cards.
    expect(await screen.findByRole("button", { name: /change capacity/i })).toHaveAttribute(
      "aria-haspopup",
      "dialog",
    );
    expect(screen.queryByRole("button", { name: /switch to/i })).not.toBeInTheDocument();
  });

  it("seeds the change-capacity slider at the workspace's current capacity", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      // 70-feed base + 30 add-on feeds = 100 feeds of current capacity.
      subscription: activeSubscription({ addons: [{ key: ProductKey.Tier3Feed, quantity: 30 }] }),
    });
    mockChangePreview();

    renderBilling();
    await openChangeDialog();

    // The manage slider opens at the current capacity (100), not at the base (70)
    // the way the buy-time slider does.
    const slider = await screen.findByRole("slider", { name: /how many feeds/i });
    expect(slider).toHaveAttribute("aria-valuetext", "100 feeds");
  });

  it("discloses the recurring charge and renewal date in the change-capacity dialog", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });
    mockChangePreview();

    renderBilling();
    await openChangeDialog();
    // Raise capacity so there is a pending change to preview.
    await setSliderToFeeds(140);

    // The compliance-critical disclosure: not just what's due today, but the
    // recurring amount, cadence, and when it starts. The date is local-time, so
    // assert the stable parts (amount, interval, "starting", year).
    expect(await screen.findByText(/Then/)).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "P" &&
          /\/ month, starting \d{1,2} \w+ 2027\./.test(el?.textContent ?? ""),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Renews automatically\. Cancel anytime\./)).toBeInTheDocument();
  });

  it("itemizes the prorated amount due today in the change-capacity dialog", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });
    mockChangePreview();

    renderBilling();
    await openChangeDialog();
    await setSliderToFeeds(140);

    expect(await screen.findByText(/Total due today/)).toBeInTheDocument();
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("Account credit")).toBeInTheDocument();
    expect(screen.getByText("Tax")).toBeInTheDocument();
    // The negative tax renders with the sign outside the symbol, not "$-.82".
    expect(screen.getByText("-$0.82")).toBeInTheDocument();
    // Credit reduces the bill, so it must read as a deduction, not a charge.
    expect(screen.getByText("-$5.00")).toBeInTheDocument();
  });

  it("hides the account-credit row when there is no credit", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });
    // An upgrade with no proration credit: the row would otherwise read "-$0".
    mockChangePreview({
      immediateTransaction: {
        billingPeriod: {
          startsAt: "2027-02-01T00:00:00.000Z",
          endsAt: "2027-02-28T00:00:00.000Z",
        },
        subtotalFormatted: "$20.00",
        taxFormatted: "$2.00",
        credit: "0",
        creditFormatted: "$0",
        grandTotalFormatted: "$22.00",
      },
    });

    renderBilling();
    await openChangeDialog();
    await setSliderToFeeds(140);

    await screen.findByText(/Total due today/);
    expect(screen.queryByText("Account credit")).not.toBeInTheDocument();
  });

  it("warns when a capacity decrease would disable feeds over the new limit", async () => {
    mockPaddle();
    // Currently at 140 feeds so the slider can move DOWN to 70.
    mockWorkspace({
      role: "owner",
      subscription: activeSubscription({ addons: [{ key: ProductKey.Tier3Feed, quantity: 70 }] }),
    });
    mockChangePreview({
      feedImpact: { newFeedLimit: 70, currentFeedCount: 73, willBeDisabledCount: 3 },
    });

    renderBilling();
    await openChangeDialog();
    await setSliderToFeeds(70);

    expect(
      await screen.findByText(/3 feeds over the new 70-feed limit will be disabled/i),
    ).toBeInTheDocument();
  });

  it("shows no disable warning for a capacity increase", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });
    mockChangePreview();

    renderBilling();
    await openChangeDialog();
    await setSliderToFeeds(140);

    await screen.findByText(/Total due today/);
    expect(screen.queryByText(/will be disabled/i)).not.toBeInTheDocument();
  });

  it("applies a capacity increase as a base-tier-plus-add-on change in one transaction", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });
    mockChangePreview();

    renderBilling();
    await openChangeDialog();
    // 70 -> 200 feeds: base Tier 2 plus 130 add-on feeds.
    await setSliderToFeeds(200);

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /confirm change/i }));

    await waitFor(() =>
      expect(h.update).toHaveBeenCalledWith({
        workspaceSlug: "my-team",
        prices: [
          { priceId: PRICE_IDS[ProductKey.Tier2].month, quantity: 1 },
          { priceId: PRICE_IDS[ProductKey.Tier3Feed].month, quantity: 130 },
        ],
      }),
    );
  });

  it("returns focus to the Change capacity button when the dialog is cancelled", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });
    mockChangePreview();

    renderBilling();
    const trigger = await screen.findByRole("button", { name: /change capacity/i });
    trigger.focus();
    fireEvent.click(trigger);

    await screen.findByRole("slider", { name: /how many feeds/i });
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    // Cancelling changes nothing, so focus returns to the opener rather than
    // being stranded on the document body when the dialog closes.
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  // Guard against client/backend drift: these MUST match the backend's
  // WORKSPACE_TIER_FEED_LIMITS (services/.../shared/utils/billing.ts), which the
  // activation webhook grants and the change-preview projects. The two live in
  // separate bundles and can't share an import, so if this fails because the
  // backend limits changed, update both in lockstep.
  it("keeps the client tier feed limits in step with the backend", () => {
    expect(TIER_FEED_LIMITS[ProductKey.Tier2]).toBe(70);
    expect(TIER_FEED_LIMITS[ProductKey.Tier3]).toBe(140);
  });
});
