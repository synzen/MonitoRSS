import "@testing-library/jest-dom";
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { PRICE_IDS, ProductKey } from "@/constants";
import { PricingDialog } from "./index";
import { usePricingData } from "../../hooks";
import { usePaddleContext } from "../../contexts/PaddleContext";
import { useUserMe } from "../../../discordUser";
import { useIsWorkspacesEnabled } from "../../../workspaces";

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
  useIsWorkspacesEnabled: vi.fn(),
  useWorkspaces: vi.fn(() => ({ workspaces: [] })),
  CreateWorkspaceDialog: () => null,
}));

const price = (id: string, interval: "month" | "year", formattedPrice: string) => ({
  id,
  interval,
  formattedPrice,
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
    ...overrides,
  } as never);
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
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("PricingDialog two-region layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPricingData();
    vi.mocked(usePaddleContext).mockReturnValue({
      resetCheckoutData: vi.fn(),
      initCancellationFlow: vi.fn(),
      getChargePreview: vi.fn().mockResolvedValue({ totalFormatted: "$13.00" }),
    } as never);
    vi.mocked(useUserMe).mockReturnValue({
      data: {
        result: { subscription: { subscriptionId: undefined, product: { key: ProductKey.Free } } },
      },
    } as never);
    vi.mocked(useIsWorkspacesEnabled).mockReturnValue({ enabled: true } as never);
  });

  it("renders a 'For you' region with a Free card and a Personal card", async () => {
    renderDialog();

    const forYou = await screen.findByRole("region", { name: /^for you$/i });
    expect(within(forYou).getByRole("heading", { name: /^Free$/ })).toBeInTheDocument();
    expect(within(forYou).getByRole("heading", { name: /^Personal$/ })).toBeInTheDocument();
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

  it("shows external properties as not-included on the Personal card, conveyed to assistive tech", async () => {
    renderDialog();

    const forYou = await screen.findByRole("region", { name: /^for you$/i });
    // The crossed-out feature must be conveyed to AT, not by color alone: the
    // list item is marked as not included via accessible text.
    const externalProps = within(forYou).getByText(/external properties/i);
    const listItem = externalProps.closest("li") as HTMLElement;
    expect(within(listItem).getByText(/not included/i)).toBeInTheDocument();
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
      getChargePreview: vi.fn().mockResolvedValue({ totalFormatted: "$13.00" }),
    } as never);
    vi.mocked(useUserMe).mockReturnValue({
      data: {
        result: { subscription: { subscriptionId: undefined, product: { key: ProductKey.Free } } },
      },
    } as never);
    vi.mocked(useIsWorkspacesEnabled).mockReturnValue({ enabled: true } as never);
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
      getChargePreview: vi.fn().mockResolvedValue({ totalFormatted: "$13.00" }),
    } as never);
    vi.mocked(useUserMe).mockReturnValue({
      data: {
        result: { subscription: { subscriptionId: undefined, product: { key: ProductKey.Free } } },
      },
    } as never);
    vi.mocked(useIsWorkspacesEnabled).mockReturnValue({ enabled: true } as never);
  });

  it("renders an accessible, keyboard-operable capacity slider in the workspace panel", async () => {
    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    const slider = within(forTeam).getByRole("slider", { name: /how many feeds/i });
    expect(slider).toBeInTheDocument();
    // The thumb announces the feed count it represents (not the raw detent index)
    // so a screen-reader user hears "70 feeds" at the base anchor.
    expect(slider).toHaveAttribute("aria-valuetext", "70 feeds");
  });

  it("names the chosen feed count in the CTA and updates it as the slider moves up", async () => {
    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    expect(
      within(forTeam).getByRole("button", { name: /create workspace for 70 feeds/i }),
    ).toBeInTheDocument();

    const slider = within(forTeam).getByRole("slider", { name: /how many feeds/i });
    slider.focus();
    // Each step is one detent, so ArrowRight from the 70 base lands on 100.
    fireEvent.keyDown(slider, { key: "ArrowRight" });

    await waitFor(() =>
      expect(
        within(forTeam).getByRole("button", { name: /create workspace for 100 feeds/i }),
      ).toBeInTheDocument(),
    );
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuetext", "100 feeds"));
  });

  it("decreases via the keyboard: ArrowLeft moves down to the previous detent", async () => {
    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    const slider = within(forTeam).getByRole("slider", { name: /how many feeds/i });

    // Climb one detent: index 0 (70) -> index 1 (100).
    slider.focus();
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    await waitFor(() =>
      expect(
        within(forTeam).getByRole("button", { name: /create workspace for 100 feeds/i }),
      ).toBeInTheDocument(),
    );

    // ArrowLeft must move DOWN a detent, not stay put (the keyboard-trap
    // regression where round-up snapping made the slider one-way). 100 -> 70.
    // Re-focus first: in JSDOM the dialog's focus management can pull focus off
    // the thumb between key presses; real keyboard operability is covered by the
    // pricing-dialog E2E. The point under test here is the detent direction.
    slider.focus();
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    await waitFor(() =>
      expect(
        within(forTeam).getByRole("button", { name: /create workspace for 70 feeds/i }),
      ).toBeInTheDocument(),
    );
    expect(slider).toHaveAttribute("aria-valuetext", "70 feeds");
  });

  it("updates the hero price from a Paddle preview when feeds are added above the base", async () => {
    const getChargePreview = vi.fn().mockResolvedValue({ totalFormatted: "$13.00" });
    vi.mocked(usePaddleContext).mockReturnValue({
      resetCheckoutData: vi.fn(),
      initCancellationFlow: vi.fn(),
      getChargePreview,
    } as never);

    renderDialog();

    const forTeam = await screen.findByRole("region", { name: /for your team/i });
    // At the base count the hero shows the base workspace price, no preview call.
    expect(within(forTeam).getByText("$10.00")).toBeInTheDocument();

    const slider = within(forTeam).getByRole("slider", { name: /how many feeds/i });
    slider.focus();
    fireEvent.keyDown(slider, { key: "ArrowRight" });

    // The live hero price comes from Paddle's authoritative preview of the
    // base tier + add-on feeds, not hardcoded math.
    await waitFor(() => expect(getChargePreview).toHaveBeenCalled());
    expect(await within(forTeam).findByText("$13.00")).toBeInTheDocument();
  });
});
