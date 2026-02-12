import { test, expect } from "../fixtures/test-fixtures";
import {
  getTestChannelId,
  getTestChannelName,
  getTestServerName,
  createWebhookConnection,
  updateConnection,
} from "../helpers/api";

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

  test("can clone a webhook connection with custom properties", async ({
    page,
    testFeed,
  }) => {
    const channelId = getTestChannelId();

    test.skip(!channelId, "channelId must be configured in e2econfig.json");

    const webhookName = "Clone Test Webhook";
    const webhookIconUrl = "https://example.com/icon.png";
    const connectionName = `Clone Test Connection ${Date.now()}`;

    const connection = await createWebhookConnection(
      page,
      testFeed.id,
      channelId!,
      {
        name: connectionName,
        webhookName,
        webhookIconUrl,
      },
    );

    const testFilters = {
      expression: {
        type: "LOGICAL",
        op: "AND",
        children: [
          {
            type: "RELATIONAL",
            op: "CONTAINS",
            left: { type: "ARTICLE", value: "title" },
            right: { type: "STRING", value: "clone-filter-test" },
          },
        ],
      },
    };
    const testRateLimits = [{ timeWindowSeconds: 120, limit: 5 }];
    const testCustomPlaceholders = [
      {
        id: "cp-clone-1",
        referenceName: "clonedPlaceholder",
        sourcePlaceholder: "{{title}}",
        steps: [{ id: "step-1", type: "UPPERCASE" }],
      },
    ];

    await updateConnection(page, testFeed.id, connection.id, {
      filters: testFilters,
      rateLimits: testRateLimits,
      customPlaceholders: testCustomPlaceholders,
    });

    await page.goto(
      `/feeds/${testFeed.id}/discord-channel-connections/${connection.id}`,
    );

    await expect(
      page.getByRole("heading", { name: connectionName }),
    ).toBeVisible({
      timeout: 10000,
    });

    const actionsButton = page.getByRole("button", {
      name: "Connection Actions",
    });
    await actionsButton.waitFor({ timeout: 10000 });
    await actionsButton.click();

    await page.getByRole("menuitem").filter({ hasText: "Clone" }).click();

    await expect(
      page.getByRole("dialog").getByText("Clone connection"),
    ).toBeVisible({
      timeout: 10000,
    });

    const clonedName = `Cloned ${connectionName}`;
    const nameInput = page.getByRole("dialog").locator("input").first();
    await nameInput.clear();
    await nameInput.fill(clonedName);

    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Clone" })
      .click();

    await expect(
      page.getByText(`Successfully created cloned connection: ${clonedName}`),
    ).toBeVisible({ timeout: 30000 });

    await page.goto(`/feeds/${testFeed.id}?view=connections`);
    await page.waitForTimeout(1000);

    const clonedConnectionLink = page.getByRole("link", { name: clonedName });
    await expect(clonedConnectionLink).toBeVisible({ timeout: 10000 });
    await clonedConnectionLink.click();

    await expect(page.getByRole("heading", { name: clonedName })).toBeVisible({
      timeout: 10000,
    });

    await expect(page.getByText(webhookName)).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("tab", { name: "Article Filters" }).click();
    await expect(page.locator('input[value="clone-filter-test"]')).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("tab", { name: "Delivery Rate Limits" }).click();
    await expect(page.locator('input[value="5"]')).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("tab", { name: "Custom Placeholders" }).click();
    await expect(page.getByText("clonedPlaceholder").first()).toBeVisible({
      timeout: 10000,
    });
  });
});
