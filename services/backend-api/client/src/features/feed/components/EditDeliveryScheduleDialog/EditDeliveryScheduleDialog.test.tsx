import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { system } from "@/utils/theme";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { ApiErrorCode } from "@/utils/getStandardErrorCodeMessage";
import { PricingDialogContext } from "@/features/subscriptionProducts";
import { UserFeed } from "../../types";
import { EditDeliveryScheduleDialog } from "./index";

// The refresh-rate error must tell the user WHY the rate was rejected (their
// plan's fastest allowed rate) and offer an upgrade CTA when lower rates exist
// on paid plans, instead of the generic "Refresh rate is not allowed."

const feed = {
  id: "feed-1",
  title: "My feed",
  url: "https://example.com/rss",
  refreshRateSeconds: 600,
  refreshRateOptions: [
    { rateSeconds: 600 },
    { rateSeconds: 300, disabledCode: "INSUFFICIENT_SUPPORTER_TIER" },
  ],
  connections: [],
  healthStatus: "healthy",
  createdAt: "2026-01-01T00:00:00Z",
} as unknown as UserFeed;

const rateNotAllowedError = new ApiAdapterError("Refresh rate is not allowed.", {
  errorCode: ApiErrorCode.USER_REFRESH_RATE_NOT_ALLOWED,
  statusCode: 400,
});

const renderDialog = ({
  feed: feedProp = feed,
  onUpdate,
  onOpenPricingDialog,
}: {
  feed?: UserFeed;
  onUpdate: (data: unknown) => Promise<void>;
  onOpenPricingDialog?: () => void;
}) => {
  const user = userEvent.setup();
  const result = render(
    <ChakraProvider value={system}>
      <PricingDialogContext.Provider value={{ onOpen: onOpenPricingDialog ?? vi.fn() }}>
        <EditDeliveryScheduleDialog isOpen onClose={vi.fn()} feed={feedProp} onUpdate={onUpdate} />
      </PricingDialogContext.Provider>
    </ChakraProvider>,
  );

  return { user, ...result };
};

describe("EditDeliveryScheduleDialog - refresh rate rejection", () => {
  it("explains the fastest allowed rate and shows the upgrade CTA when lower rates are locked", async () => {
    const onUpdate = vi.fn().mockRejectedValueOnce(rateNotAllowedError);
    const onOpenPricingDialog = vi.fn();
    const { user } = renderDialog({ onUpdate, onOpenPricingDialog });

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(
        "Your current plan only allows checking this feed once every 10.0 minutes or more.",
      ),
    ).toBeInTheDocument();

    const upgradeButton = screen.getByRole("button", { name: "Upgrade for faster refresh rates" });
    await user.click(upgradeButton);
    expect(onOpenPricingDialog).toHaveBeenCalledTimes(1);
  });

  it("does not show the upgrade CTA for unrelated errors", async () => {
    const onUpdate = vi
      .fn()
      .mockRejectedValueOnce(new ApiAdapterError("Something went wrong", { statusCode: 500 }));
    const { user } = renderDialog({ onUpdate });

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Upgrade for faster refresh rates" }),
    ).not.toBeInTheDocument();
  });

  it("hints at the plan's fastest allowed rate before submitting", () => {
    renderDialog({ onUpdate: vi.fn() });

    expect(
      screen.getByText(
        "Your plan allows checking as often as every 10.0 minutes. Lower rates are available on paid plans.",
      ),
    ).toBeInTheDocument();
  });

  it("blocks saving a negative refresh rate with a field error", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const { user } = renderDialog({ onUpdate });

    const refreshRateInput = screen.getByRole("spinbutton");
    await user.clear(refreshRateInput);
    await user.type(refreshRateInput, "-5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a refresh rate greater than 0")).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("blocks saving an empty refresh rate with a field error", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const { user } = renderDialog({ onUpdate });

    const refreshRateInput = screen.getByRole("spinbutton");
    await user.clear(refreshRateInput);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a refresh rate")).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("clears the error when the dialog is reopened", async () => {
    const onUpdate = vi.fn().mockRejectedValue(rateNotAllowedError);
    const { user, rerender } = renderDialog({ onUpdate });

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Your current plan only allows checking/)).toBeInTheDocument();

    rerender(
      <ChakraProvider value={system}>
        <PricingDialogContext.Provider value={{ onOpen: vi.fn() }}>
          <EditDeliveryScheduleDialog
            isOpen={false}
            onClose={vi.fn()}
            feed={feed}
            onUpdate={onUpdate}
          />
        </PricingDialogContext.Provider>
      </ChakraProvider>,
    );
    await waitFor(() =>
      expect(screen.queryByText(/Your current plan only allows checking/)).not.toBeInTheDocument(),
    );
  });
});
