import { test, expect, type Page } from "../../fixtures/test-fixtures";
import type { FrameLocator } from "@playwright/test";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { ensureFreeSubscriptionState } from "../../helpers/paddle-cleanup";
import {
  enableWorkspacesFeatureInDb,
  setVerifiedEmailInDb,
  getUserMongoIdFromDiscordId,
  seedPersonalFeedsInDb,
} from "../../helpers/workspaces-db";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";

// Personal→workspace conversion against the REAL Paddle sandbox (e2e-paddle
// project): the owner buys a personal Tier 2 plan, holds a couple of personal
// feeds, creates a team, then converts the personal plan into the team. The
// selected feed lands active in the team; the feed left behind drops to the
// free limit on the personal side and is disabled. Asserted entirely through
// the rendered UI (per the project E2E rules). The feeds are seeded with
// distinct titles only because the add-flow names every feed after the source
// RSS title; the conversion itself runs for real (re-parent + Paddle patch +
// webhook) and the outcome is read off the UI.

const TIER_2_MONTHLY_PRICE_ID = "pri_01hb3g41n1caxys9kpzsfy98e9";

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

// Drives the Paddle sandbox card form to completion (shared shape with
// paddle-checkout.spec.ts / paddle-workspace-roundtrip.spec.ts).
async function completeSandboxCheckout(page: Page, paddleFrame: FrameLocator): Promise<void> {
  const cardInput = paddleFrame.getByRole("textbox", { name: "Card number" });
  await expect(cardInput).toBeVisible({ timeout: 30000 });

  await paddleFrame.getByRole("combobox", { name: "Country" }).selectOption("United States");
  await paddleFrame.getByRole("textbox", { name: "ZIP/Postcode" }).fill("12345");
  await page.waitForTimeout(3000);

  await cardInput.fill("4242424242424242");
  await paddleFrame.getByRole("textbox", { name: "Expiry" }).fill("1230");
  await paddleFrame.getByRole("textbox", { name: "CVV" }).fill("123");
  await paddleFrame.getByRole("textbox", { name: "Card holder" }).fill("Test User");

  const subscribeButton = paddleFrame.getByRole("button", { name: /subscribe now/i });
  await expect(subscribeButton).toBeVisible({ timeout: 5000 });
  await subscribeButton.click();

  await page.waitForTimeout(5000);
  const taxMessage = paddleFrame.getByText("Click 'Subscribe now' to try again");
  if (await taxMessage.isVisible().catch(() => false)) {
    await subscribeButton.click();
  }
}

test.describe("Paddle workspace conversion", () => {
  test("converts a personal plan into a team, moving the selected feed and disabling the one left behind", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    await ensureFreeSubscriptionState(page);

    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, `verified-${discordUserId}@example.com`);

    // 1. Buy a personal Tier 2 subscription through sandbox checkout.
    await page.goto(`/paddle-checkout/${TIER_2_MONTHLY_PRICE_ID}`);
    await expect(page.getByRole("heading", { name: "Checkout Summary" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/(Monthly|Annual)/)).toBeVisible({ timeout: 30000 });
    await completeSandboxCheckout(page, page.frameLocator("iframe").first());
    await expect(
      page.getByRole("heading", { name: "Your benefits have been provisioned." }),
    ).toBeVisible({ timeout: 60000 });

    // 2. Personal feeds with distinct titles. The personal free limit is 5, so
    //    to observe a left-behind feed get disabled, more than 5 must stay
    //    personal: keep one ("Keep Feed") and leave six behind. "Leave Feed" is
    //    seeded first (oldest), so it is the one enforcement disables.
    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);
    const leftBehindTitles = [
      "Leave Feed",
      ...Array.from({ length: 5 }, (_, i) => `Filler Feed ${i + 1}`),
    ];
    await seedPersonalFeedsInDb({
      userId: selfUserId,
      discordUserId,
      feeds: [
        ...leftBehindTitles.map((title) => ({ title, url: MOCK_RSS_FEED_URL })),
        { title: "Keep Feed", url: MOCK_RSS_FEED_URL },
      ],
    });

    // 3. Create a team (never-activated; allowed while nothing else is funded).
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await page.getByRole("button", { name: "Account settings" }).click();
    await page.getByRole("menuitem", { name: /create a team/i }).click();
    const createDialog = page.getByRole("dialog");
    const workspaceName = `E2E Convert Team ${Date.now()}`;
    await createDialog.getByLabel("Team name").fill(workspaceName);
    await createDialog.getByRole("button", { name: "Create team" }).click();
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, { timeout: 15000 });
    const workspaceSlug = page.url().match(/\/workspaces\/([^/]+)\/feeds/)?.[1] as string;
    expect(workspaceSlug).toBeTruthy();

    // 4. Convert from the team's Billing page.
    await page.goto(`/workspaces/${workspaceSlug}/settings/billing`);
    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: /move my plan to this team/i }).click();

    const convertDialog = page.getByRole("alertdialog");
    await expect(convertDialog).toBeVisible({ timeout: 15000 });
    // All 7 feeds selected by default (the safe move).
    await expect(convertDialog.getByText(/Selected 7 \/ 70 team slots/)).toBeVisible({
      timeout: 15000,
    });

    // Move only "Keep Feed": deselect every feed that should stay personal.
    // The Chakra v3 checkbox INPUT is visually hidden (offscreen), so clicking
    // it directly fails the viewport check; click the visible label (the feed
    // title) instead, which toggles the associated input. Verify each toggle
    // registered before moving on.
    for (const title of leftBehindTitles) {
      const checkbox = convertDialog.getByRole("checkbox", {
        name: new RegExp(`^${title}$`, "i"),
      });
      const label = convertDialog.getByText(title, { exact: true });
      await expect(checkbox).toBeChecked();
      await label.scrollIntoViewIfNeeded();
      await label.click();
      await expect(checkbox).not.toBeChecked();
    }
    await expect(convertDialog.getByText(/Selected 1 \/ 70 team slots/)).toBeVisible();

    await convertDialog
      .getByLabel(new RegExp(`type "${workspaceSlug}" to confirm`, "i"))
      .fill(workspaceSlug);
    await convertDialog.getByRole("button", { name: /^move plan$/i }).click();

    // 5. The webhook re-homes the subscription onto the team; the Billing page
    //    flips to the current-plan view without further action.
    await expect(page.getByRole("heading", { name: "Current plan" })).toBeVisible({
      timeout: 120_000,
    });
    // The current-plan view renders the tier name both as a card heading and in
    // the "Current plan" badge region, so scope to the heading to stay unique.
    await expect(page.getByRole("heading", { name: "Tier 2" })).toBeVisible();

    // 6a. The moved feed is active in the team scope.
    await page.goto(`/workspaces/${workspaceSlug}/feeds`);
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
    const keptRow = page.getByRole("row").filter({
      has: page.getByRole("link", { name: "Keep Feed", exact: true }),
    });
    await expect(keptRow.getByLabel("Ok")).toBeVisible({ timeout: 15000 });

    // 6b. The left-behind feed is disabled on the personal side (the personal
    //     plan is gone, so it is over the free limit).
    await page.goto("/feeds");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
    const leftRow = page.getByRole("row").filter({
      has: page.getByRole("link", { name: "Leave Feed", exact: true }),
    });
    await expect(leftRow.getByLabel("Disabled (feed limit exceeded)")).toBeVisible({
      timeout: 15000,
    });

    // Teardown: deleting the team cancels the sandbox subscription so the
    // sandbox does not accumulate live subscriptions across runs.
    const deleteRes = await page.request.delete(`/api/v1/workspaces/${workspaceSlug}`);
    expect(deleteRes.status()).toBe(204);
  });
});
