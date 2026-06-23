import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { system } from "@/utils/theme";
import { WorkspacePanel } from "./WorkspacePanel";

// Real per-unit figures (in minor units): base $10.00 + $0.50/feed, so the
// slider's detent totals are derived deterministically by useWorkspaceSliderPrice
// without any Paddle mock.
const PRICING = { baseUnitAmount: 1000, perFeedUnitAmount: 50, currencyCode: "USD" };

const renderPanel = (props: Partial<React.ComponentProps<typeof WorkspacePanel>> = {}) =>
  render(
    <ChakraProvider value={system}>
      <WorkspacePanel
        interval="month"
        pricing={PRICING}
        ownsWorkspaceNeedingBilling={false}
        defaultSizerOpen
        onCreateWorkspace={vi.fn()}
        onGoToWorkspace={vi.fn()}
        {...props}
      />
    </ChakraProvider>,
  );

// The hidden price announcer is the only polite live region in the panel (the
// visible hero price is deliberately not live). Reading it tells us exactly what
// a screen reader would speak.
const getAnnouncer = (container: HTMLElement) => {
  const node = container.querySelector('[aria-live="polite"]');
  if (!node) throw new Error("expected a polite live region for the price announcer");

  return node;
};

describe("WorkspacePanel price announcer", () => {
  it("does not announce on initial render (opening the panel)", () => {
    const { container } = renderPanel();

    // Mounting the panel must not queue an announcement; only an actual capacity
    // change should speak.
    expect(getAnnouncer(container)).toHaveTextContent("");
  });

  it("announces the new price when the capacity slider moves", async () => {
    const { container } = renderPanel();

    const slider = screen.getByRole("slider", { name: /how many feeds/i });
    slider.focus();
    fireEvent.keyDown(slider, { key: "ArrowRight" });

    // 70 -> 100 feeds = $10.00 + 30 * $0.50 = $25.00 ("$25"). The feed count is
    // carried by the thumb's aria-valuetext, so the announcer speaks only the
    // price + interval.
    await waitFor(() => expect(getAnnouncer(container)).toHaveTextContent("$25 per month."));
  });

  it("does NOT announce the price when only the billing interval changes", async () => {
    // Reproduces the reported screen-reader bug: flipping Monthly/Yearly (a
    // control in a different region of the dialog) must not make this panel speak
    // its price, since the user never navigated here.
    const { container, rerender } = renderPanel();

    // Move the slider first so the announcer holds a real value, proving the next
    // assertion is about the interval change and not just an empty initial state.
    const slider = screen.getByRole("slider", { name: /how many feeds/i });
    slider.focus();
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    await waitFor(() => expect(getAnnouncer(container)).toHaveTextContent("$25 per month."));

    // The parent toggles the interval prop. The visible price updates, but the
    // announcer must stay unchanged so nothing is spoken from this panel.
    rerender(
      <ChakraProvider value={system}>
        <WorkspacePanel
          interval="year"
          pricing={PRICING}
          ownsWorkspaceNeedingBilling={false}
          defaultSizerOpen
          onCreateWorkspace={vi.fn()}
          onGoToWorkspace={vi.fn()}
        />
      </ChakraProvider>,
    );

    // Visible hero price reflects the yearly interval...
    await screen.findByText(/per year\.$/);
    // ...but the announcer was not rewritten by the interval change.
    expect(getAnnouncer(container)).toHaveTextContent("$25 per month.");
  });

  it("the visible hero price is not itself a live region", () => {
    // Guards against a regression to the old design where the visible price was
    // aria-live and so re-announced on interval toggles.
    renderPanel();

    const heroPrice = screen.getByText("$10");
    // Walk up from the visible price; no ancestor up to the card should be a live
    // region. (The only live region in the panel is the hidden announcer.)
    let node: HTMLElement | null = heroPrice;

    while (node && node.getAttribute("role") !== "region") {
      expect(node.getAttribute("aria-live")).not.toBe("polite");
      node = node.parentElement;
    }
  });

  it("keeps using aria-valuetext for the feed count so it is not duplicated in the announcer", async () => {
    const { container } = renderPanel();

    const slider = screen.getByRole("slider", { name: /how many feeds/i });
    slider.focus();
    fireEvent.keyDown(slider, { key: "ArrowRight" });

    await waitFor(() => expect(slider).toHaveAttribute("aria-valuetext", "100 feeds"));
    // The announcer speaks the price only, leaving the feed count to the thumb so
    // a screen reader does not hear "100 feeds" twice.
    expect(getAnnouncer(container)).not.toHaveTextContent(/feeds/);
  });
});
