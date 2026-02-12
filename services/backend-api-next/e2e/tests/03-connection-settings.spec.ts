import { test, expect } from "../fixtures/test-fixtures";
import { getTestChannelName, getTestServerName } from "../helpers/api";

test.describe("Connection Settings", () => {
  test("can view connection page", async ({ page, testFeedWithConnection }) => {
    const { feed, connection } = testFeedWithConnection;
    await page.goto(
      `/feeds/${feed.id}/discord-channel-connections/${connection.id}`,
    );
    await expect(
      page.getByRole("heading", { name: connection.name }),
    ).toBeVisible({
      timeout: 10000,
    });
    await page.screenshot({ path: "e2e/test-results/connection-page.png" });
  });

  test("can update connection channel via configure dialog", async ({
    page,
    testFeedWithConnection,
  }) => {
    const { feed, connection } = testFeedWithConnection;
    const serverName = getTestServerName();
    const channelName = getTestChannelName();

    await page.goto(
      `/feeds/${feed.id}/discord-channel-connections/${connection.id}`,
    );

    const actionsButton = page.getByRole("button", {
      name: "Connection Actions",
    });
    await actionsButton.waitFor({ timeout: 10000 });
    await actionsButton.click();

    await page.getByRole("menuitem").filter({ hasText: "Configure" }).click();

    await expect(
      page.getByRole("dialog").getByText("Edit Discord Channel Connection"),
    ).toBeVisible({ timeout: 10000 });

    await page.locator("#server-select").click();
    await page
      .locator('[role="option"]')
      .filter({ hasText: serverName! })
      .click();

    await page.locator("#channel-select").click();
    await page
      .getByRole("option", { name: channelName!, exact: true })
      .first()
      .click();

    await page.getByRole("button", { name: /Save/i }).click();

    // Wait for dialog to close (indicates success) - may take time for API call
    await expect(
      page.getByRole("dialog").getByText("Edit Discord Channel Connection"),
    ).not.toBeVisible({ timeout: 30000 });

    await expect(
      page.getByText("Successfully updated connection."),
    ).toBeVisible({
      timeout: 10000,
    });
  });
});
