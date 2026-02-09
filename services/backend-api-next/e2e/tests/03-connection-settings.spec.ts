import { test, expect } from "../fixtures/test-fixtures";

test.describe("Connection Settings", () => {
  test("can view connection page", async ({ page, testFeedWithConnection }) => {
    const { feed, connection } = testFeedWithConnection;
    await page.goto(
      `/feeds/${feed.id}/discord-channel-connections/${connection.id}`,
    );
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "e2e/test-results/connection-page.png" });
    await expect(
      page.getByRole("heading", { name: connection.name }),
    ).toBeVisible({
      timeout: 10000,
    });
  });
});
