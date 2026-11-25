import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { system } from "@/utils/theme";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { ApiErrorCode } from "@/utils/getStandardErrorCodeMessage";
import { PricingDialogContext } from "@/features/subscriptionProducts";
import { UserFeed } from "../../types";
import { EditDeliveryScheduleDialog, FormSchema } from "./index";

// The refresh-rate error must explain the limit the backend enforces for THIS
// feed (plan floor or platform-provider floor) and only offer the upgrade CTA
// when an upgrade can actually lower it.

const baseFeed = {
  id: "feed-1",
  title: "My feed",
  url: "https://example.com/rss",
  refreshRateSeconds: 600,
  connections: [],
  healthStatus: "healthy",
  createdAt: "2026-01-01T00:00:00Z",
};

const planLimitedFeed = {
  ...baseFeed,
  refreshRateLimits: {
    minimumSeconds: 600,
    maximumSeconds: 86400,
    canUpgrade: true,
    limitedBy: "plan",
  },
} as unknown as UserFeed;

const platformLimitedFeed = {
  ...baseFeed,
  refreshRateLimits: {
    minimumSeconds: 7200,
    maximumSeconds: 86400,
    canUpgrade: false,
    limitedBy: "platform",
  },
} as unknown as UserFeed;

const rateNotAllowedError = new ApiAdapterError("Refresh rate is not allowed.", {
  errorCode: ApiErrorCode.USER_REFRESH_RATE_NOT_ALLOWED,
  statusCode: 400,
});

const renderDialog = ({
  feed = planLimitedFeed,
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
        <EditDeliveryScheduleDialog isOpen onClose={vi.fn()} feed={feed} onUpdate={onUpdate} />
      </PricingDialogContext.Provider>
    </ChakraProvider>,
  );

  return { user, ...result };
};

const typeRefreshRate = async (user: ReturnType<typeof userEvent.setup>, minutes: string) => {
  const refreshRateInput = screen.getByRole("spinbutton");
  await user.clear(refreshRateInput);
  await user.type(refreshRateInput, minutes);
};

describe("EditDeliveryScheduleDialog - refresh rate limits", () => {
  it("explains the resolved plan minimum and shows the upgrade CTA when an upgrade helps", async () => {
    const onUpdate = vi.fn().mockRejectedValueOnce(rateNotAllowedError);
    const onOpenPricingDialog = vi.fn();
    const { user } = renderDialog({ onUpdate, onOpenPricingDialog });

    await typeRefreshRate(user, "5");
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

  it("explains a platform-provider minimum without offering an upgrade", async () => {
    const onUpdate = vi.fn().mockRejectedValueOnce(rateNotAllowedError);
    const onOpenPricingDialog = vi.fn();
    const { user } = renderDialog({
      feed: platformLimitedFeed,
      onUpdate,
      onOpenPricingDialog,
    });

    await typeRefreshRate(user, "20");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(
        "This platform feed can only be checked once every 120.0 minutes or more.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Upgrade for faster refresh rates" }),
    ).not.toBeInTheDocument();
    expect(onOpenPricingDialog).not.toHaveBeenCalled();
  });

  it("reports the fastest available rate when no plan upgrade can lower the minimum", async () => {
    const noUpgradeFeed = {
      ...baseFeed,
      refreshRateLimits: {
        minimumSeconds: 300,
        maximumSeconds: 86400,
        canUpgrade: false,
        limitedBy: "plan",
      },
    } as unknown as UserFeed;
    const onUpdate = vi.fn().mockRejectedValueOnce(rateNotAllowedError);
    const { user } = renderDialog({ feed: noUpgradeFeed, onUpdate });

    await typeRefreshRate(user, "1");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("The fastest refresh rate available is every 5.0 minutes."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Upgrade for faster refresh rates" }),
    ).not.toBeInTheDocument();
  });

  it("explains the backend maximum for an over-long rate", async () => {
    const onUpdate = vi.fn().mockRejectedValueOnce(rateNotAllowedError);
    const { user } = renderDialog({ onUpdate });

    await typeRefreshRate(user, "2000");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Refresh rates cannot be slower than every 24.0 hours."),
    ).toBeInTheDocument();
  });

  it("falls back to the server message when the rate is inside the limits", async () => {
    const onUpdate = vi.fn().mockRejectedValueOnce(rateNotAllowedError);
    const { user } = renderDialog({ onUpdate });

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Refresh rate is not allowed.")).toBeInTheDocument();
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

  it("hints at the plan minimum before submitting", () => {
    renderDialog({ onUpdate: vi.fn() });

    expect(
      screen.getByText(
        "Your plan allows checking as often as every 10.0 minutes. Lower rates are available on paid plans.",
      ),
    ).toBeInTheDocument();
  });

  it("hints at the platform minimum before submitting", () => {
    renderDialog({ feed: platformLimitedFeed, onUpdate: vi.fn() });

    expect(
      screen.getByText("This platform feed can be checked as often as every 120.0 minutes."),
    ).toBeInTheDocument();
  });

  it("blocks saving a negative refresh rate with a field error", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const { user } = renderDialog({ onUpdate });

    await typeRefreshRate(user, "-5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a refresh rate greater than 0")).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("blocks saving an empty refresh rate with a field error", async () => {
    // user.clear() cannot empty the controlled number input under happy-dom
    // (the input reverts to the previous value; verified clearing holds "" in Chromium).
    // Pin the validation contract directly: empty must fail with the required
    // message so a save can never go through with no rate.
    await expect(
      FormSchema.validateAt("userRefreshRateMinutes", {
        scheduleMode: "interval",
        userRefreshRateMinutes: "",
      }),
    ).rejects.toThrow("Enter a refresh rate");
  });

  it("clears the error when the dialog is reopened", async () => {
    const onUpdate = vi.fn().mockRejectedValue(rateNotAllowedError);
    const { user, rerender } = renderDialog({ onUpdate });

    await typeRefreshRate(user, "5");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Your current plan only allows checking/)).toBeInTheDocument();

    rerender(
      <ChakraProvider value={system}>
        <PricingDialogContext.Provider value={{ onOpen: vi.fn() }}>
          <EditDeliveryScheduleDialog
            isOpen={false}
            onClose={vi.fn()}
            feed={planLimitedFeed}
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
