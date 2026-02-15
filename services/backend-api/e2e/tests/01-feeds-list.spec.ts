import { test, expect } from "../fixtures/test-fixtures";

test.describe("Feeds List", () => {
  test("Add Feed button is visible", async ({ page }) => {
    await page.goto("/feeds");
    const addFeedButton = page.getByRole("button", {
      name: "Add Feed",
      exact: true,
    });
    await expect(addFeedButton).toBeVisible({ timeout: 10000 });
  });
});
