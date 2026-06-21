import { test, expect } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb } from "../../helpers/workspaces-db";

test.describe("Pricing dialog focus management", () => {
  test("stays open when tabbing after being opened via the keyboard", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await page.getByRole("button", { name: /account settings/i }).click();
    await page.getByRole("menuitem", { name: "Account Settings" }).click();
    await expect(
      page.getByRole("heading", { name: "Account Settings" }),
    ).toBeVisible({ timeout: 10000 });

    await page
      .getByRole("button", { name: "Manage Subscription" })
      .press("Enter");

    const dialog = page.getByRole("dialog");
    const pricingHeading = dialog.getByRole("heading", { name: "Pricing", level: 1 });
    await expect(pricingHeading).toBeVisible({ timeout: 15000 });

    await page.keyboard.press("Tab");

    await expect(pricingHeading).toBeVisible();
  });

  test("shows the two-region layout with a workspace capacity slider", async ({ page }) => {
    // The workspace CTA + reassurance render only when workspaces are enabled
    // for the user; enable the feature so the full region is asserted.
    await page.goto("/feeds");
    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await page.reload();

    await page.getByRole("button", { name: /account settings/i }).click();
    await page.getByRole("menuitem", { name: "Account Settings" }).click();
    await expect(
      page.getByRole("heading", { name: "Account Settings" }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Manage Subscription" }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Pricing", level: 1 }),
    ).toBeVisible({ timeout: 15000 });

    // A1: the two labelled regions render. External properties only applies at
    // delivery on the workspace tier, so it is a workspace benefit (named by its
    // benefit, not the jargon) and is no longer a crossed-out line on Personal.
    const forYou = dialog.getByRole("region", { name: /^for you$/i });
    await expect(forYou.getByRole("heading", { name: /^Free$/ })).toBeVisible();
    await expect(forYou.getByRole("heading", { name: /^Personal$/ })).toBeVisible();
    await expect(forYou.getByText(/external properties/i)).toHaveCount(0);
    await expect(forYou.getByText(/rich content from article pages/i)).toHaveCount(0);

    const forTeam = dialog.getByRole("region", { name: /for your team/i });
    await expect(forTeam.getByRole("heading", { name: /^Team$/ })).toBeVisible();
    // Benefit-led wording, never the in-product "external properties" jargon.
    await expect(forTeam.getByText(/rich content from article pages/i)).toBeVisible();
    await expect(forTeam.getByText(/external properties/i)).toHaveCount(0);
    await expect(
      forTeam.getByRole("slider", { name: /how many feeds/i }),
    ).toBeVisible();
    await expect(
      forTeam.getByRole("button", { name: /create workspace for \d+ feeds/i }),
    ).toBeVisible();
    await expect(
      forTeam.getByText(/a workspace of one gives you all of this/i),
    ).toBeVisible();

    // The external-properties explainer is a keyboard-accessible disclosure: the
    // info button is reachable and named, Enter opens the popover (revealing the
    // <51 articles caveat that used to be an orphaned footnote), and Escape
    // closes it and returns focus to the trigger.
    const infoButton = forTeam.getByRole("button", {
      name: /about rich content from article pages/i,
    });
    await expect(infoButton).toBeVisible();
    await infoButton.focus();
    await expect(infoButton).toBeFocused();
    await infoButton.press("Enter");
    await expect(page.getByText(/fewer than 51 articles/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/fewer than 51 articles/i)).toBeHidden();
    await expect(infoButton).toBeFocused();

    // The slider must be operable in BOTH directions with the keyboard (a
    // round-up-only snap would trap it at the 70-feed base). Climb a detent, then
    // step back down, asserting the CTA's feed count moves each way.
    const slider = forTeam.getByRole("slider", { name: /how many feeds/i });
    await slider.focus();
    await slider.press("ArrowRight");
    await expect(
      forTeam.getByRole("button", { name: /create workspace for 100 feeds/i }),
    ).toBeVisible();
    await slider.press("ArrowLeft");
    await expect(
      forTeam.getByRole("button", { name: /create workspace for 70 feeds/i }),
    ).toBeVisible();
  });

  test("is mobile responsive: regions stack and content fits the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/feeds");
    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    await page.reload();

    await page.getByRole("button", { name: /account settings/i }).click();
    await page.getByRole("menuitem", { name: "Account Settings" }).click();
    await expect(
      page.getByRole("heading", { name: "Account Settings" }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Manage Subscription" }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Pricing", level: 1 }),
    ).toBeVisible({ timeout: 15000 });

    // Both regions and the workspace slider/CTA still render at a phone width.
    const forYou = dialog.getByRole("region", { name: /^for you$/i });
    const forTeam = dialog.getByRole("region", { name: /for your team/i });
    await expect(forYou.getByRole("heading", { name: /^Personal$/ })).toBeVisible();
    await expect(forTeam.getByRole("slider", { name: /how many feeds/i })).toBeVisible();
    await expect(
      forTeam.getByRole("button", { name: /create workspace for \d+ feeds/i }),
    ).toBeVisible();

    // The narrow-left region stacks ABOVE the dominant-right region (column
    // layout) rather than sitting beside it, and neither overflows the viewport.
    const forYouBox = await forYou.boundingBox();
    const forTeamBox = await forTeam.boundingBox();
    expect(forYouBox).not.toBeNull();
    expect(forTeamBox).not.toBeNull();
    // Stacked: the team region starts below the bottom of the personal region.
    expect(forTeamBox!.y).toBeGreaterThanOrEqual(forYouBox!.y + forYouBox!.height - 1);
    // No horizontal overflow past the 390px viewport.
    expect(forYouBox!.x + forYouBox!.width).toBeLessThanOrEqual(391);
    expect(forTeamBox!.x + forTeamBox!.width).toBeLessThanOrEqual(391);
  });
});
