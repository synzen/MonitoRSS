import { test, expect } from "../fixtures/test-fixtures";

test.describe("Feed Settings", () => {
  test("can view feed settings page", async ({ page, testFeed }) => {
    await page.goto(`/feeds/${testFeed.id}`);
    await expect(
      page.getByRole("heading", { name: testFeed.title }),
    ).toBeVisible({ timeout: 10000 });
  });
});
