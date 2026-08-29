import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const getAnnouncer = (container: HTMLElement) => {
  const node = container.querySelector('[aria-live="polite"]');
  if (!node) throw new Error("expected a polite live region for the price announcer");

  return node;
};

describe("WorkspacePanel price announcer", () => {
  it("does not announce on initial render", () => {
    const { container } = renderPanel();

    expect(getAnnouncer(container)).toHaveTextContent("");
  });

  it("announces the new price when capacity changes", async () => {
    const { container } = renderPanel();

    const input = screen.getByRole("spinbutton", { name: /feed capacity/i });
    fireEvent.change(input, { target: { value: "1100" } });
    fireEvent.blur(input);

    await waitFor(() => expect(getAnnouncer(container)).toHaveTextContent("$525 per month."));
  });

  it("does not announce the price when only the billing interval changes", async () => {
    const { container, rerender } = renderPanel();
    const input = screen.getByRole("spinbutton", { name: /feed capacity/i });
    fireEvent.change(input, { target: { value: "1100" } });
    fireEvent.blur(input);
    await waitFor(() => expect(getAnnouncer(container)).toHaveTextContent("$525 per month."));

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

    await screen.findByText(/^per year$/);
    expect(getAnnouncer(container)).toHaveTextContent("$525 per month.");
  });

  it("the visible hero price is not itself a live region", () => {
    renderPanel();

    const heroPrice = screen.getByText("$10");
    let node: HTMLElement | null = heroPrice;

    while (node && node.getAttribute("role") !== "region") {
      expect(node.getAttribute("aria-live")).not.toBe("polite");
      node = node.parentElement;
    }
  });

  it("states the capacity range on the card without presenting quick picks as plans", () => {
    // The card must say Team starts at 70 and scales to 2,000 so a large-capacity
    // buyer knows the picker reaches their range; the quick picks stay inside the
    // picker (buttons, not plan cards).
    renderPanel();

    expect(
      screen.getByText(/starts at 70 feeds and scales to 2,000\. add more anytime\./i),
    ).toBeInTheDocument();
    // The old "{n} feeds per month." hero line must be gone.
    expect(screen.queryByText(/70 feeds per month/i)).not.toBeInTheDocument();
    // Capacity choices form a radio group, rather than reading as additional
    // purchasable plans or competing primary actions.
    expect(screen.getAllByRole("radio", { name: /^\d[\d,]* feeds$/ })).toHaveLength(6);
    expect(screen.queryByRole("button", { name: /subscribe/i })).not.toBeInTheDocument();
  });

  it("applies a quick pick directly, updating the selected capacity and visible price", async () => {
    const { container } = renderPanel();

    // Choosing the 300-feed pick commits instantly (no blur needed) and the
    // derived recurring price follows: 1000 + 230 * 50 = 12,500 minor units.
    await userEvent.click(screen.getByRole("radio", { name: "300 feeds" }));

    const input = screen.getByRole("spinbutton", { name: /feed capacity/i });
    await waitFor(() => expect(input).toHaveAttribute("aria-valuetext", "300 feeds"));
    await waitFor(() => expect(getAnnouncer(container)).toHaveTextContent("$125 per month."));
  });

  it("the create CTA names the action, not a feed count", () => {
    renderPanel();

    const cta = screen.getByRole("button", { name: /create your workspace/i });
    expect(cta).toBeInTheDocument();
    // The decisive control must not re-anchor on a number.
    expect(cta).not.toHaveTextContent(/\d+\s*feeds/i);
  });

  it("labels the sizer as an invitation to add capacity, not a gate", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: /add more feeds/i })).toBeInTheDocument();
    expect(screen.queryByText(/size your plan/i)).not.toBeInTheDocument();
  });

  it("reports a localized selected capacity", async () => {
    const { container } = renderPanel();

    const input = screen.getByRole("spinbutton", { name: /feed capacity/i });
    fireEvent.change(input, { target: { value: "1100" } });
    fireEvent.blur(input);

    await waitFor(() => expect(input).toHaveAttribute("aria-valuetext", "1,100 feeds"));
    expect(getAnnouncer(container)).not.toHaveTextContent(/feeds/);
  });

  it("offers the prescribed quick picks and clamps an out-of-range direct entry", async () => {
    renderPanel();

    expect(screen.getByRole("radio", { name: "1,000 feeds" })).toBeInTheDocument();
    const input = screen.getByRole("spinbutton", { name: /or enter an exact feed capacity/i });
    fireEvent.change(input, { target: { value: "2100" } });
    fireEvent.blur(input);

    await waitFor(() => expect(input).toHaveValue(2000));
    expect(screen.getByText(/choose a whole number from 70 to 2,000 feeds/i)).toBeInTheDocument();
  });
});
