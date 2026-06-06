import { test, expect } from "../../fixtures/test-fixtures";

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

    const pricingHeading = page
      .getByRole("dialog")
      .getByRole("heading", { name: "Pricing", level: 1 });
    await expect(pricingHeading).toBeVisible({ timeout: 15000 });

    await page.keyboard.press("Tab");

    await expect(pricingHeading).toBeVisible();
  });
});
