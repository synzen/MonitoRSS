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

    // A1: the two labelled regions render, the personal region shows external
    // properties as not-included, and the workspace region carries the capacity
    // slider, the dynamic CTA, and the "workspace of one" reassurance.
    const forYou = dialog.getByRole("region", { name: /^for you$/i });
    await expect(forYou.getByRole("heading", { name: /^Free$/ })).toBeVisible();
    await expect(forYou.getByRole("heading", { name: /^Personal$/ })).toBeVisible();
    // The Personal card lists external properties as not-included, conveyed to
    // assistive tech (not by color alone). The same row carries both the feature
    // name and the visually-hidden status, so assert both are present.
    await expect(forYou.getByText(/external properties/i)).toBeVisible();
    await expect(forYou.getByText(/not included/i).first()).toBeAttached();

    const forTeam = dialog.getByRole("region", { name: /for your team/i });
    await expect(forTeam.getByRole("heading", { name: /^Team$/ })).toBeVisible();
    await expect(
      forTeam.getByRole("slider", { name: /how many feeds/i }),
    ).toBeVisible();
    await expect(
      forTeam.getByRole("button", { name: /create workspace for \d+ feeds/i }),
    ).toBeVisible();
    await expect(
      forTeam.getByText(/a workspace of one gives you all of this/i),
    ).toBeVisible();

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
