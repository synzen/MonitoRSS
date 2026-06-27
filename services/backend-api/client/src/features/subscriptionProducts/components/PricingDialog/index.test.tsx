import "@testing-library/jest-dom";
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { PRICE_IDS, pages, ProductKey } from "@/constants";
import { PricingDialog } from "./index";
import { usePricingData } from "../../hooks";
import { usePaddleContext } from "../../contexts/PaddleContext";
import { useUserMe } from "../../../discordUser";
import { useWorkspaces } from "../../../workspaces";

vi.mock("../../hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks")>()),
  usePricingData: vi.fn(),
}));

vi.mock("../../contexts/PaddleContext", () => ({
  usePaddleContext: vi.fn(),
}));

vi.mock("../../../discordUser", () => ({
  useUserMe: vi.fn(),
}));

vi.mock("../../../workspaces", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../workspaces")>()),
  useWorkspaces: vi.fn(() => ({ workspaces: [] })),
  CreateWorkspaceDialog: () => null,
}));

const price = (id: string, interval: "month" | "year", formattedPrice: string) => ({
  id,
  interval,
  formattedPrice,
  // Minor-unit integer matching the formatted string (e.g. "$10.00" -> 1000),
  // the figure the capacity slider derives detent totals from.
  unitAmount: Math.round(Number(formattedPrice.replace(/[^0-9.]/g, "")) * 100),
  currencyCode: "USD",
  quantity: 1,
});

// Product names mirror what the real API returns (the raw Paddle "Tier N"), so
// any "no Tier N" assertion exercises the display-name mapping rather than
// passing spuriously on a pre-mapped fixture.
const PRODUCTS = [
  {
    id: ProductKey.Tier1,
    name: "Tier 1",
    prices: [
      price(PRICE_IDS[ProductKey.Tier1].month, "month", "$5.00"),
      price(PRICE_IDS[ProductKey.Tier1].year, "year", "$50.00"),
    ],
  },
  {
    id: ProductKey.Tier2,
    name: "Tier 2",
    prices: [
      price(PRICE_IDS[ProductKey.Tier2].month, "month", "$10.00"),
      price(PRICE_IDS[ProductKey.Tier2].year, "year", "$100.00"),
    ],
  },
  {
    id: ProductKey.Tier3,
    name: "Tier 3",
    prices: [
      price(PRICE_IDS[ProductKey.Tier3].month, "month", "$20.00"),
      price(PRICE_IDS[ProductKey.Tier3].year, "year", "$200.00"),
    ],
  },
  {
    id: ProductKey.Tier3Feed,
    name: "Tier 3 Feed",
    prices: [
      price(PRICE_IDS[ProductKey.Tier3Feed].month, "month", "$0.50"),
      price(PRICE_IDS[ProductKey.Tier3Feed].year, "year", "$5.00"),
    ],
  },
];

const mockPricingData = (overrides: Record<string, unknown> = {}) => {
  vi.mocked(usePricingData).mockReturnValue({
    products: PRODUCTS,
    interval: "month",
    changeInterval: vi.fn(),
    isLoading: false,
    isLoadingAdditionalFeedsChange: false,
    hasError: false,
    userSubscription: { product: { key: ProductKey.Free }, billingInterval: "month" },
    billingPeriodEndsAt: undefined,
    additionalFeedsInput: 0,
    changeAdditionalFeedsInput: vi.fn(),
    additionalFeedPricePreview: null,
    userSubscriptionAdditionalFeeds: undefined,
    chargePreview: null,
    baseAdditionalFeedsPrice: "$0.50",
    priceIdOfAdditionalFeeds: PRICE_IDS[ProductKey.Tier3Feed].month,
    getProductPrice: (productId: ProductKey) =>
      PRODUCTS.find((p) => p.id === productId)?.prices.find((p) => p.interval === "month"),
    getProduct: (productId: ProductKey) => PRODUCTS.find((p) => p.id === productId),
    getWorkspaceFeedPricing: (forInterval: "month" | "year") => {
      const base = PRODUCTS.find((p) => p.id === ProductKey.Tier2)?.prices.find(
        (p) => p.interval === forInterval,
      );
      const feed = PRODUCTS.find((p) => p.id === ProductKey.Tier3Feed)?.prices.find(
        (p) => p.interval === forInterval,
      );

      return base && feed
        ? {
            baseUnitAmount: base.unitAmount,
            perFeedUnitAmount: feed.unitAmount,
            currencyCode: base.currencyCode,
          }
        : undefined;
    },
    ...overrides,
  } as never);
};

// Surfaces the router's current path so navigation can be asserted as observable
// behavior (where the user lands), not by mocking useNavigate.
const LocationDisplay = () => {
  const location = useLocation();

  return <div data-testid="location-display">{`${location.pathname}${location.search}`}</div>;
};

const renderDialog = (props: { target?: "workspace" } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ChakraProvider value={system}>
          <PricingDialog isOpen onClose={vi.fn()} onOpen={vi.fn()} target={props.target} />
        </ChakraProvider>
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

// The capacity slider sits inside the collapsed "Add more feeds" sizer, demoted
// under the collaboration pitch. Open it so the slider is mounted before the
// keyboard/CTA assertions run.
const openSizer = async (forTeam: HTMLElement) => {
  // Ark's accordion toggles on a full pointer sequence, not a bare click event,
  // so drive it with userEvent.
  await userEvent.click(within(forTeam).getByRole("button", { name: /add more feeds/i }));

  return within(forTeam).findByRole("slider", { name: /how many feeds/i });
};

describe("PricingDialog two-region layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPricingData();
    vi.mocked(usePaddleContext).mockReturnValue({
      resetCheckoutData: vi.fn(),
      initCancellationFlow: vi.fn(),
    } as never);
    vi.mocked(useUserMe).mockReturnValue({
      data: {
        result: { subscription: { subscriptionId: undefined, product: { key: ProductKey.Free } } },
      },
    } as never);
  });

  it("renders a 'For you' region with a Free card and a Personal card", async () => {
    renderDialog();

    const forYou = await screen.findByRole("region", { name: /^for you$/i });
    expect(within(forYou).getByRole("heading", { name: /^Free$/ })).toBeInTheDocument();
    expect(within(forYou).getByRole("heading", { name: /^Personal$/ })).toBeInTheDocument();
  });

  it("renders the Free card's zero price in the viewer's currency, not a hard-coded $", async () => {
    const eurProducts = PRODUCTS.map((p) => ({
      ...p,
      prices: p.prices.map((pr) => ({ ...pr, currencyCode: "EUR" })),
    }));
    mockPricingData({
      products: eurProducts,
      getProductPrice: (productId: ProductKey) =>
        eurProducts.find((p) => p.id === productId)?.prices.find((p) => p.interval === "month"),
    });

    renderDialog();

    const forYou = await screen.findByRole("region", { name: /^for you$/i });
    expect(within(forYou).getByText("€0")).toBeInTheDocument();
    expect(within(forYou).queryByText("$0")).not.toBeInTheDocument();
  });

  it("falls back to $0 on the Free card when the viewer's currency has no formatter", async () => {
    // INR has no entry in formatCurrency's map, so formatCurrency("0", "INR")
    // returns a bare "0" (no symbol). The Free card must show "$0", not "0".
    const inrProducts = PRODUCTS.map((p) => ({
      ...p,
      prices: p.prices.map((pr) => ({ ...pr, currencyCode: "INR" })),
    }));
    mockPricingData({
      products: inrProducts,
      getProductPrice: (productId: ProductKey) =>
        inrProducts.find((p) => p.id === productId)?.prices.find((p) => p.interval === "month"),
    });

    renderDialog();

    const forYou = await screen.findByRole("region", { name: /^for you$/i });
    expect(within(forYou).getByText("$0")).toBeInTheDocument();
    expect(within(forYou).queryByText(/^0$/)).not.toBeInTheDocument();
  });

  it("renders a 'For your team' region with the Team plan card", async () => {
    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    expect(within(forTeam).getByRole("heading", { name: /^Team$/ })).toBeInTheDocument();
  });

  it("never names 'Workspace' as a feature checkmark bullet on the Team card", async () => {
    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    // "Workspace" may appear in the descriptive subhead (the what-you-get noun)
    // and reassurance line, but never as a feature list item.
    const bullets = within(forTeam).getAllByRole("listitem");
    bullets.forEach((bullet) => {
      expect(bullet.textContent ?? "").not.toMatch(/workspace/i);
    });
  });

  it("does not list external properties on the Personal card (Workspace-only capability)", async () => {
    renderDialog();

    const forYou = await screen.findByRole("region", { name: /^for you$/i });
    // External properties only applies at delivery on the Workspace tier, so it
    // is no longer surfaced as a crossed-out line on the Personal card where it
    // would read as something a Personal buyer is missing out on.
    expect(within(forYou).queryByText(/external properties/i)).not.toBeInTheDocument();
    expect(within(forYou).queryByText(/rich content from article pages/i)).not.toBeInTheDocument();
  });

  it("lists external properties last on the Team card, benefit-led, not as jargon", async () => {
    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    // The buy screen leads with the benefit, never the in-product jargon name.
    expect(within(forTeam).getByText(/rich content from article pages/i)).toBeInTheDocument();
    expect(within(forTeam).queryByText(/external properties/i)).not.toBeInTheDocument();

    // It sits last, below the collaboration bullet, per usage data.
    const bullets = within(forTeam).getAllByRole("listitem");
    const last = bullets[bullets.length - 1];
    expect(last.textContent ?? "").toMatch(/rich content from article pages/i);
  });

  it("explains external properties via a keyboard-accessible info popover with the article caveat", async () => {
    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    // The info affordance is a real button with an accessible name, not a bare
    // icon, so screen-reader and keyboard users can reach and identify it.
    const infoButton = within(forTeam).getByRole("button", {
      name: /about rich content from article pages/i,
    });

    fireEvent.click(infoButton);

    // The explanation (and the <51 articles caveat that used to be an orphaned
    // footnote) is revealed on activation.
    expect(await screen.findByText(/pull extra images, links, or thumbnails/i)).toBeInTheDocument();
    expect(screen.getByText(/fewer than 51 articles/i)).toBeInTheDocument();
  });

  it("surfaces the per-feed daily article limit on the Free and Personal cards", async () => {
    renderDialog();

    const forYou = await screen.findByRole("region", { name: /^for you$/i });
    // The 20x uplift is the selling point, so both the low free allowance and
    // the high paid allowance are visible for the contrast to land.
    expect(within(forYou).getByText(/50 articles per day, per feed/i)).toBeInTheDocument();
    expect(within(forYou).getByText(/1,000 articles per day, per feed/i)).toBeInTheDocument();
  });

  it("shows the workspace reassurance line under the CTA", async () => {
    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    expect(
      within(forTeam).getByText(/a workspace of one gives you all of this/i),
    ).toBeInTheDocument();
  });

  it("does not render Tier 2 or Tier 3 as separate buyable personal cards", async () => {
    renderDialog();

    await screen.findByRole("region", { name: /^for you$/i });
    expect(screen.queryByText(/tier 2/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tier 3/i)).not.toBeInTheDocument();
  });

  it("focuses the workspace region when opened with the workspace target", async () => {
    renderDialog({ target: "workspace" });

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    await waitFor(() => expect(forTeam).toHaveFocus());
  });

  it("does not focus the workspace region on a default open", async () => {
    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    expect(forTeam).not.toHaveFocus();
  });
});

describe("PricingDialog FAQ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPricingData();
    vi.mocked(usePaddleContext).mockReturnValue({
      resetCheckoutData: vi.fn(),
      initCancellationFlow: vi.fn(),
    } as never);
    vi.mocked(useUserMe).mockReturnValue({
      data: {
        result: { subscription: { subscriptionId: undefined, product: { key: ProductKey.Free } } },
      },
    } as never);
  });

  it("drops the obsolete sharing/benefits FAQ entries the layout now answers", async () => {
    renderDialog();

    await screen.findByRole("region", { name: /^for you$/i });
    expect(screen.queryByText(/can my team share one subscription/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/can i apply my benefits to someone else/i)).not.toBeInTheDocument();
  });

  it("adds the 'is a workspace overkill if it's just me' FAQ entry", async () => {
    renderDialog();

    expect(await screen.findByText(/is a workspace overkill if it's just me/i)).toBeInTheDocument();
  });
});

describe("PricingDialog workspace slider + live price + dynamic CTA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPricingData();
    vi.mocked(usePaddleContext).mockReturnValue({
      resetCheckoutData: vi.fn(),
      initCancellationFlow: vi.fn(),
    } as never);
    vi.mocked(useUserMe).mockReturnValue({
      data: {
        result: { subscription: { subscriptionId: undefined, product: { key: ProductKey.Free } } },
      },
    } as never);
  });

  it("renders an accessible, keyboard-operable capacity slider in the workspace panel", async () => {
    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    const slider = await openSizer(forTeam);
    expect(slider).toBeInTheDocument();
    // The thumb announces the feed count it represents (not the raw detent index)
    // so a screen-reader user hears "70 feeds" at the base anchor.
    expect(slider).toHaveAttribute("aria-valuetext", "70 feeds");
  });

  it("keeps the CTA number-free while the slider moves up", async () => {
    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    // The CTA names the action, not a count: the number must not appear on the
    // most decisive control (it re-anchors the purchase on capacity).
    const cta = within(forTeam).getByRole("button", { name: /^create your workspace$/i });
    expect(cta).toBeInTheDocument();
    expect(cta).not.toHaveTextContent(/\d+\s*feeds/i);

    const slider = await openSizer(forTeam);
    slider.focus();
    // Each step is one detent, so ArrowRight from the 70 base lands on 100. The
    // slider's announced value is the signal the capacity changed (the CTA stays
    // the same).
    fireEvent.keyDown(slider, { key: "ArrowRight" });

    await waitFor(() => expect(slider).toHaveAttribute("aria-valuetext", "100 feeds"));
    expect(
      within(forTeam).getByRole("button", { name: /^create your workspace$/i }),
    ).not.toHaveTextContent(/\d+\s*feeds/i);
  });

  it("decreases via the keyboard: ArrowLeft moves down to the previous detent", async () => {
    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    const slider = await openSizer(forTeam);

    // Climb one detent: index 0 (70) -> index 1 (100).
    slider.focus();
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuetext", "100 feeds"));

    // ArrowLeft must move DOWN a detent, not stay put (the keyboard-trap
    // regression where round-up snapping made the slider one-way). 100 -> 70.
    // Re-focus first: in JSDOM the dialog's focus management can pull focus off
    // the thumb between key presses; real keyboard operability is covered by the
    // pricing-dialog E2E. The point under test here is the detent direction.
    slider.focus();
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuetext", "70 feeds"));
  });

  it("derives the hero price from the page preview when feeds are added above the base", async () => {
    // The Team hero is priced entirely from the page-level price preview (Tier2
    // base + Tier3Feed per-feed unit), not a Paddle call of its own: moving the
    // slider just re-derives the total locally.
    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    // At the base count the hero shows the base workspace price ($10.00, rendered
    // "$10" as formatCurrency drops the ".00").
    expect(await within(forTeam).findByText("$10")).toBeInTheDocument();

    const slider = await openSizer(forTeam);
    slider.focus();
    fireEvent.keyDown(slider, { key: "ArrowRight" });

    // 70 -> 100 feeds = base $10.00 + 30 * $0.50 = $25.00 ("$25"), derived from
    // the preview's authoritative per-feed unit price.
    expect(await within(forTeam).findByText("$25")).toBeInTheDocument();
  });
});

describe("PricingDialog workspace CTA when the user already owns a workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPricingData();
    vi.mocked(usePaddleContext).mockReturnValue({
      resetCheckoutData: vi.fn(),
      initCancellationFlow: vi.fn(),
    } as never);
    vi.mocked(useUserMe).mockReturnValue({
      data: {
        result: { subscription: { subscriptionId: undefined, product: { key: ProductKey.Free } } },
      },
    } as never);
  });

  it("reroutes to an owned workspace that NEEDS BILLING, carrying the chosen feed count", async () => {
    vi.mocked(useWorkspaces).mockReturnValue({
      workspaces: [{ id: "w1", name: "Acme", slug: "acme", role: "owner", needsBilling: true }],
    } as never);

    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    // An owner of a workspace needing billing sees a reroute CTA, never the
    // create-a-second-workspace CTA.
    const cta = within(forTeam).getByRole("button", { name: /go to your workspace/i });
    expect(
      within(forTeam).queryByRole("button", { name: /create workspace/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(cta);

    // The chosen capacity (base detent 70) is carried into the workspace's
    // billing page so the plan selection starts where the user left the slider.
    await waitFor(() =>
      expect(screen.getByTestId("location-display")).toHaveTextContent(
        `${pages.workspaceBilling("acme")}?feeds=70`,
      ),
    );
  });

  it("reroutes a LAPSED (cancelled) owned workspace to billing, not the create CTA", async () => {
    // A cancelled workspace has its subscription nullified, so it surfaces as
    // needsBilling exactly like a never-activated one: the returning owner wants
    // to re-bill the workspace they have, not create a second one.
    vi.mocked(useWorkspaces).mockReturnValue({
      workspaces: [{ id: "w1", name: "Acme", slug: "acme", role: "owner", needsBilling: true }],
    } as never);

    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    expect(
      within(forTeam).queryByRole("button", { name: /create workspace/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(forTeam).getByRole("button", { name: /go to your workspace/i }));

    await waitFor(() =>
      expect(screen.getByTestId("location-display")).toHaveTextContent(
        `${pages.workspaceBilling("acme")}?feeds=70`,
      ),
    );
  });

  it("still offers the create CTA to an owner of only already-paid workspaces", async () => {
    // A paid (active) workspace does not need billing, so its owner is allowed
    // to create another; the reroute must not fire and suppress it.
    vi.mocked(useWorkspaces).mockReturnValue({
      workspaces: [{ id: "w1", name: "Acme", slug: "acme", role: "owner", needsBilling: false }],
    } as never);

    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    expect(
      within(forTeam).getByRole("button", { name: /^create your workspace$/i }),
    ).toBeInTheDocument();
    expect(
      within(forTeam).queryByRole("button", { name: /go to your workspace/i }),
    ).not.toBeInTheDocument();
  });

  it("still offers the create CTA to an admin who only belongs to someone else's workspace", async () => {
    // Being a member (admin) of a workspace is not owning one: the user can
    // still create their own, so the reroute must not fire on a non-owner role.
    vi.mocked(useWorkspaces).mockReturnValue({
      workspaces: [{ id: "w1", name: "Acme", slug: "acme", role: "admin", needsBilling: false }],
    } as never);

    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    expect(
      within(forTeam).getByRole("button", { name: /^create your workspace$/i }),
    ).toBeInTheDocument();
    expect(
      within(forTeam).queryByRole("button", { name: /go to your workspace/i }),
    ).not.toBeInTheDocument();
  });

  it("reroutes to the owned workspace that needs billing, not a paid one the user also owns", async () => {
    // Mixed ownership: the reroute targets the workspace that needs billing, not
    // an already-paid one.
    vi.mocked(useWorkspaces).mockReturnValue({
      workspaces: [
        { id: "w1", name: "Paid", slug: "paid", role: "owner", needsBilling: false },
        { id: "w2", name: "Mine", slug: "mine", role: "owner", needsBilling: true },
      ],
    } as never);

    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    fireEvent.click(within(forTeam).getByRole("button", { name: /go to your workspace/i }));

    await waitFor(() =>
      expect(screen.getByTestId("location-display")).toHaveTextContent(
        `${pages.workspaceBilling("mine")}?feeds=70`,
      ),
    );
  });
});
