import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
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
  {
    id: ProductKey.Tier3Feed,
    name: "Tier 3 Feed",
    prices: [
      {
        id: PRICE_IDS[ProductKey.Tier3Feed].month,
        interval: "month",
        formattedPrice: "$0.50",
        currencyCode: "USD",
        quantity: 1,
      },
      {
        id: PRICE_IDS[ProductKey.Tier3Feed].year,
        interval: "year",
        formattedPrice: "$5.00",
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

  it("offers Tier 2/Tier 3 checkout to the owner of an unsubscribed workspace, carrying the workspace id", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    expect(await screen.findByText("$10.00", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("$20.00", { exact: false })).toBeInTheDocument();

    const subscribeButtons = screen.getAllByRole("button", { name: /subscribe/i });
    expect(subscribeButtons).toHaveLength(2);

    fireEvent.click(subscribeButtons[0]);

    // Checkout renders inline inside a dialog (frameTarget), never as Paddle's
    // own page-leaking overlay. The open is gated on the frame container
    // mounting, so wait for the call.
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

  it("keeps the tier price regions silent at rest so closing the checkout dialog does not re-read every card", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    // At rest (no add-ons configured) the price regions must not be live: when
    // the checkout dialog closes, its inert lifts off the page and a live region
    // inside a freshly revealed subtree gets re-announced by screen readers.
    const tier2Price = (await screen.findByText("$10.00", { exact: false })).closest(
      "[aria-live]",
    ) as HTMLElement;
    const tier3Price = (await screen.findByText("$20.00", { exact: false })).closest(
      "[aria-live]",
    ) as HTMLElement;
    expect(tier2Price).toHaveAttribute("aria-live", "off");
    expect(tier3Price).toHaveAttribute("aria-live", "off");

    // Once the owner is actively configuring add-ons, the price summary becomes
    // live so the settled figure is announced as it changes.
    const stepper = await screen.findByRole("spinbutton", { name: /additional feeds/i });
    await userEvent.clear(stepper);
    await userEvent.type(stepper, "5");

    const tier3PriceAfter = (await screen.findByText("145 feeds (140 + 5)")).closest(
      "[aria-live]",
    ) as HTMLElement;
    await waitFor(() => expect(tier3PriceAfter).toHaveAttribute("aria-live", "polite"));
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
    const dialog = await screen.findByRole("dialog", { name: /subscribe to tier 2/i });
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
      <MemoryRouter>
        <ChakraProvider value={system}>
          <WorkspaceBilling />
        </ChakraProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(status).toHaveTextContent(/your tier 2 is now active/i));
  });

  it("lets the owner add extra feeds to Tier 3 at activation and folds them into one checkout", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    // The add-on control is Tier 3 only: one spinbutton on the whole grid.
    const stepper = await screen.findByRole("spinbutton", { name: /additional feeds/i });
    // The per-feed price comes from the async price preview, so wait for it.
    expect(await screen.findByText(/\$0\.50 per feed \/ month/)).toBeInTheDocument();

    await userEvent.clear(stepper);
    await userEvent.type(stepper, "30");

    // The Tier 3 card reflects what is actually being bought: 140 base + 30.
    expect(await screen.findByText("170 feeds (140 + 30)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /subscribe to tier 3, 170 feeds total/i }));

    await waitFor(() =>
      expect(h.openCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          prices: [
            { priceId: PRICE_IDS[ProductKey.Tier3].month, quantity: 1 },
            { priceId: PRICE_IDS[ProductKey.Tier3Feed].month, quantity: 30 },
          ],
          customData: { workspaceId: "workspace-1" },
        }),
      ),
    );
  });

  it("updates the Tier 3 headline price from Paddle as extra feeds are chosen", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    const stepper = await screen.findByRole("spinbutton", { name: /additional feeds/i });
    // Base price before any add-ons.
    expect(await screen.findByText("$20.00", { exact: false })).toBeInTheDocument();

    await userEvent.clear(stepper);
    await userEvent.type(stepper, "30");

    // The headline reflects the authoritative combined recurring total, and the
    // preview was asked for the real basket (base tier + 30 add-on feeds).
    const total = await screen.findByText("$35.00", { exact: false });
    await waitFor(() =>
      expect(h.getChargePreview).toHaveBeenCalledWith([
        { priceId: PRICE_IDS[ProductKey.Tier3].month, quantity: 1 },
        { priceId: PRICE_IDS[ProductKey.Tier3Feed].month, quantity: 30 },
      ]),
    );

    // The updating price is silent to screen readers unless announced: it must
    // live in a polite live region that settles (aria-busy false) once resolved.
    const liveRegion = total.closest('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    await waitFor(() => expect(liveRegion).toHaveAttribute("aria-busy", "false"));
    // The feed count is announced together with the price (same live region).
    expect(within(liveRegion as HTMLElement).getByText("170 feeds (140 + 30)")).toBeInTheDocument();
  });

  it("offers no additional-feeds control on the non-expandable Tier 2 card", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: null });

    renderBilling();

    await screen.findByText("Track 70 news feeds");
    // Tier 2 is not expandable, so there is exactly one stepper (Tier 3's).
    expect(screen.getAllByRole("spinbutton", { name: /additional feeds/i })).toHaveLength(1);
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

    expect(await screen.findByText(/tier 2/i)).toBeInTheDocument();
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
    await screen.findByRole("button", { name: /subscribe to tier 2/i });
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

  const openChangeDialog = async () => {
    // Wait for tier prices to load so the switch carries the recurring amount
    // (the card shows a spinner until then, as it does in the app).
    await screen.findByRole("button", { name: /switch to tier 3/i });
    await waitFor(() =>
      expect(screen.getAllByText("$20.00", { exact: false }).length).toBeGreaterThan(0),
    );
    // Current plan is Tier 2, so the Tier 3 card carries the switch action.
    fireEvent.click(screen.getByRole("button", { name: /switch to tier 3/i }));
  };

  it("discloses the recurring charge and renewal date in the change-plan dialog", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });
    mockChangePreview();

    renderBilling();
    await openChangeDialog();

    // The compliance-critical disclosure: not just what's due today, but the
    // recurring amount, cadence, and when it starts. The amount/interval/date
    // are separate JSX expressions, so match on the collapsed line text. The
    // date is formatted in local time, so assert the stable parts (amount,
    // interval, "starting", year) rather than a timezone-dependent day.
    expect(await screen.findByText(/Then/)).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "P" &&
          /\$20\.00 \/ month, starting \d{1,2} \w+ 2027\./.test(el?.textContent ?? ""),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Renews automatically\. Cancel anytime\./)).toBeInTheDocument();
  });

  it("anchors the change-plan dialog with the target tier's recurring price", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });
    mockChangePreview();

    renderBilling();
    await openChangeDialog();

    // On a downgrade the "Due today" rows are all credits/zero, so the plan
    // price must headline the dialog or the user sees only negative numbers.
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        (_, el) => el?.tagName === "P" && /^\$20\.00\s*\/ month$/.test(el?.textContent ?? ""),
      ),
    ).toBeInTheDocument();
  });

  it("itemizes the prorated amount due today in the change-plan dialog", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });
    mockChangePreview();

    renderBilling();
    await openChangeDialog();

    expect(await screen.findByText(/Total due today/)).toBeInTheDocument();
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("Account credit")).toBeInTheDocument();
    expect(screen.getByText("Tax")).toBeInTheDocument();
    // The negative tax renders with the sign outside the symbol, not "$-.82".
    expect(screen.getByText("-$0.82")).toBeInTheDocument();
    // Credit reduces the bill, so it must read as a deduction, not a charge:
    // the value carries a leading minus even though Paddle sends it positive.
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

    await screen.findByText(/Total due today/);
    expect(screen.queryByText("Account credit")).not.toBeInTheDocument();
  });

  it("warns when a downgrade would disable feeds over the new limit", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });
    mockChangePreview({
      feedImpact: { newFeedLimit: 70, currentFeedCount: 73, willBeDisabledCount: 3 },
    });

    renderBilling();
    await openChangeDialog();

    expect(
      await screen.findByText(/3 feeds over the new 70-feed limit will be disabled/i),
    ).toBeInTheDocument();
  });

  it("shows no disable warning for a within-limit change", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });
    mockChangePreview();

    renderBilling();
    await openChangeDialog();

    await screen.findByText(/Total due today/);
    expect(screen.queryByText(/will be disabled/i)).not.toBeInTheDocument();
  });

  it("folds chosen extra feeds into a Tier 2 to Tier 3 switch as one change", async () => {
    mockPaddle();
    mockWorkspace({ role: "owner", subscription: activeSubscription() });
    mockChangePreview();

    renderBilling();

    // The switch target (Tier 3) carries the add-on stepper, defaulting to 0.
    const stepper = await screen.findByRole("spinbutton", { name: /additional feeds/i });
    await userEvent.clear(stepper);
    await userEvent.type(stepper, "10");

    fireEvent.click(
      await screen.findByRole("button", { name: /switch to tier 3, 150 feeds total/i }),
    );

    const dialog = await screen.findByRole("dialog");
    // The before -> after framing reflects the extra feeds, not the bare tier.
    expect(within(dialog).getByText(/Tier 2 \(70 feeds\)/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Tier 3 \(150 feeds\)/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /confirm change/i }));

    await waitFor(() =>
      expect(h.update).toHaveBeenCalledWith({
        workspaceSlug: "my-team",
        prices: [
          { priceId: PRICE_IDS[ProductKey.Tier3].month, quantity: 1 },
          { priceId: PRICE_IDS[ProductKey.Tier3Feed].month, quantity: 10 },
        ],
      }),
    );
  });

  it("lets a Tier 3 owner edit additional feeds from the current-plan card", async () => {
    mockPaddle();
    mockWorkspace({
      role: "owner",
      subscription: activeSubscription({
        productKey: "tier3",
        addons: [{ key: ProductKey.Tier3Feed, quantity: 5 }],
      }),
    });
    mockChangePreview();

    renderBilling();

    // The current Tier 3 card seeds the stepper with the live add-on count.
    const stepper = await screen.findByRole("spinbutton", { name: /additional feeds/i });
    expect(stepper).toHaveValue("5");

    // No change yet: the update action stays disabled until the count differs.
    const updateButton = screen.getByRole("button", { name: /update additional feeds/i });
    expect(updateButton).toBeDisabled();

    await userEvent.clear(stepper);
    await userEvent.type(stepper, "12");
    expect(updateButton).toBeEnabled();
    fireEvent.click(updateButton);

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /confirm change/i }));

    await waitFor(() =>
      expect(h.update).toHaveBeenCalledWith({
        workspaceSlug: "my-team",
        prices: [
          { priceId: PRICE_IDS[ProductKey.Tier3].month, quantity: 1 },
          { priceId: PRICE_IDS[ProductKey.Tier3Feed].month, quantity: 12 },
        ],
      }),
    );
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
