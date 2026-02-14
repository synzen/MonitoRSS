import { test, expect } from "../fixtures/test-fixtures";
import {
  getTestChannelId,
  getTestChannelName,
  getTestServerName,
  createWebhookConnection,
  createConnection,
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

  test("can delete a connection", async ({ page, testFeedWithConnection }) => {
    const { feed, connection } = testFeedWithConnection;

    await page.goto(
      `/feeds/${feed.id}/discord-channel-connections/${connection.id}`,
    );

    await expect(
      page.getByRole("heading", { name: connection.name }),
    ).toBeVisible({
      timeout: 10000,
    });

    const actionsButton = page.getByRole("button", {
      name: "Connection Actions",
    });
    await actionsButton.waitFor({ timeout: 10000 });
    await actionsButton.click();

    await page.getByRole("menuitem").filter({ hasText: "Delete" }).click();

    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 10000 });

    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete" })
      .click();

    await expect(page).toHaveURL(new RegExp(`/feeds/${feed.id}(\\?.*)?$`), {
      timeout: 30000,
    });

    await expect(page.getByRole("heading", { name: feed.title })).toBeVisible({
      timeout: 10000,
    });

    await page.goto(`/feeds/${feed.id}?view=connections`);
    await page.waitForTimeout(1000);

    await expect(
      page.getByRole("link", { name: connection.name }),
    ).not.toBeVisible({ timeout: 10000 });
  });
});

test.describe("Copy Connection Settings", () => {
  const testFilters = {
    expression: {
      type: "LOGICAL",
      op: "AND",
      children: [
        {
          type: "RELATIONAL",
          op: "CONTAINS",
          left: { type: "ARTICLE", value: "title" },
          right: { type: "STRING", value: "copy-test" },
        },
      ],
    },
  };

  const testRateLimits = [{ timeWindowSeconds: 120, limit: 5 }];

  const testCustomPlaceholders = [
    {
      id: "cp-copy-1",
      referenceName: "copiedPlaceholder",
      sourcePlaceholder: "{{title}}",
      steps: [{ id: "step-1", type: "UPPERCASE" }],
    },
  ];

  async function checkSettingsCheckbox(
    page: import("@playwright/test").Page,
    labelText: string,
  ) {
    const dialog = page.getByRole("dialog");
    const checkbox = dialog.getByLabel(labelText, { exact: true });
    await checkbox.scrollIntoViewIfNeeded();
    await checkbox.check({ force: true });
  }

  async function checkConnectionCheckbox(
    page: import("@playwright/test").Page,
    connectionName: string,
  ) {
    const dialog = page.getByRole("dialog");
    const checkboxLabel = dialog
      .locator("label")
      .filter({ hasText: connectionName });
    await checkboxLabel.scrollIntoViewIfNeeded();
    const checkbox = checkboxLabel.locator("input[type='checkbox']");
    await checkbox.check({ force: true });
  }

  test("can copy some settings to some connections", async ({
    page,
    testFeed,
  }) => {
    const channelId = getTestChannelId();
    test.skip(!channelId, "channelId must be configured in e2econfig.json");

    const sourceConnection = await createConnection(
      page,
      testFeed.id,
      channelId!,
      { name: `Source Connection ${Date.now()}` },
    );
    const target1 = await createConnection(page, testFeed.id, channelId!, {
      name: `Target 1 ${Date.now()}`,
    });
    const target2 = await createConnection(page, testFeed.id, channelId!, {
      name: `Target 2 ${Date.now()}`,
    });
    const target3 = await createConnection(page, testFeed.id, channelId!, {
      name: `Target 3 ${Date.now()}`,
    });

    await updateConnection(page, testFeed.id, sourceConnection.id, {
      filters: testFilters,
      customPlaceholders: testCustomPlaceholders,
      rateLimits: testRateLimits,
    });

    await page.goto(
      `/feeds/${testFeed.id}/discord-channel-connections/${sourceConnection.id}`,
    );

    await expect(
      page.getByRole("heading", { name: sourceConnection.name }),
    ).toBeVisible({ timeout: 10000 });

    const actionsButton = page.getByRole("button", {
      name: "Connection Actions",
    });
    await actionsButton.waitFor({ timeout: 10000 });
    await actionsButton.click();

    await page
      .getByRole("menuitem")
      .filter({ hasText: "Copy settings to" })
      .click();

    await expect(
      page.getByRole("dialog").getByText("Copy connection settings"),
    ).toBeVisible({ timeout: 10000 });

    await checkSettingsCheckbox(page, "Filters");
    await checkSettingsCheckbox(page, "Custom placeholders");

    await checkConnectionCheckbox(page, target1.name);
    await checkConnectionCheckbox(page, target2.name);

    await page.getByRole("button", { name: /Copy to 2 connections/i }).click();

    await expect(
      page.getByText(/Successfully copied connection settings/),
    ).toBeVisible({ timeout: 30000 });

    // Navigate to feed via breadcrumb, then to connections view
    await page.getByRole("link", { name: testFeed.title }).click();
    await page.getByRole("tab", { name: "Connections" }).click();

    // Navigate to target1 to verify settings were copied
    await page.getByRole("link", { name: target1.name }).click();
    await expect(page.getByRole("heading", { name: target1.name })).toBeVisible(
      { timeout: 10000 },
    );

    // Verify filters were copied
    await page.getByRole("tab", { name: "Article Filters" }).click();
    await expect(page.locator('input[value="copy-test"]')).toBeVisible({
      timeout: 10000,
    });

    // Verify custom placeholders were copied
    await page.getByRole("tab", { name: "Custom Placeholders" }).click();
    await expect(page.getByText("copiedPlaceholder").first()).toBeVisible({
      timeout: 10000,
    });

    // Navigate back to connections list and check target3 (was not selected)
    await page.getByRole("link", { name: testFeed.title }).click();
    await page.getByRole("tab", { name: "Connections" }).click();
    await page.getByRole("link", { name: target3.name }).click();
    await expect(page.getByRole("heading", { name: target3.name })).toBeVisible(
      { timeout: 10000 },
    );

    await page.getByRole("tab", { name: "Article Filters" }).click();
    await expect(page.locator('input[value="copy-test"]')).not.toBeVisible({
      timeout: 5000,
    });
  });

  test("can copy some settings to all connections using Select All", async ({
    page,
    testFeed,
  }) => {
    const channelId = getTestChannelId();
    test.skip(!channelId, "channelId must be configured in e2econfig.json");

    const sourceConnection = await createConnection(
      page,
      testFeed.id,
      channelId!,
      { name: `Source All ${Date.now()}` },
    );
    const target1 = await createConnection(page, testFeed.id, channelId!, {
      name: `Target All 1 ${Date.now()}`,
    });
    const target2 = await createConnection(page, testFeed.id, channelId!, {
      name: `Target All 2 ${Date.now()}`,
    });
    const target3 = await createConnection(page, testFeed.id, channelId!, {
      name: `Target All 3 ${Date.now()}`,
    });

    await updateConnection(page, testFeed.id, sourceConnection.id, {
      filters: testFilters,
      rateLimits: testRateLimits,
      customPlaceholders: testCustomPlaceholders,
    });

    await page.goto(
      `/feeds/${testFeed.id}/discord-channel-connections/${sourceConnection.id}`,
    );

    await expect(
      page.getByRole("heading", { name: sourceConnection.name }),
    ).toBeVisible({ timeout: 10000 });

    const actionsButton = page.getByRole("button", {
      name: "Connection Actions",
    });
    await actionsButton.waitFor({ timeout: 10000 });
    await actionsButton.click();

    await page
      .getByRole("menuitem")
      .filter({ hasText: "Copy settings to" })
      .click();

    await expect(
      page.getByRole("dialog").getByText("Copy connection settings"),
    ).toBeVisible({ timeout: 10000 });

    await checkSettingsCheckbox(page, "Filters");
    await checkSettingsCheckbox(page, "Delivery rate limits");

    await page
      .getByRole("button", { name: "Select all connections as targets" })
      .click();

    await page
      .getByRole("button", { name: /Copy to \d+ connections/i })
      .click();

    await expect(
      page.getByText(/Successfully copied connection settings/),
    ).toBeVisible({ timeout: 30000 });

    // Navigate to connections list and verify all targets have the settings
    await page.getByRole("link", { name: testFeed.title }).click();
    await page.getByRole("tab", { name: "Connections" }).click();

    // Check target1 has filters and rate limits
    await page.getByRole("link", { name: target1.name }).click();
    await expect(page.getByRole("heading", { name: target1.name })).toBeVisible(
      { timeout: 10000 },
    );

    await page.getByRole("tab", { name: "Article Filters" }).click();
    await expect(page.locator('input[value="copy-test"]')).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("tab", { name: "Delivery Rate Limits" }).click();
    await expect(page.locator('input[value="5"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("can copy settings to single connection", async ({ page, testFeed }) => {
    const channelId = getTestChannelId();
    test.skip(!channelId, "channelId must be configured in e2econfig.json");

    const sourceConnection = await createConnection(
      page,
      testFeed.id,
      channelId!,
      { name: `Source Single ${Date.now()}` },
    );
    const target = await createConnection(page, testFeed.id, channelId!, {
      name: `Target Single ${Date.now()}`,
    });

    await updateConnection(page, testFeed.id, sourceConnection.id, {
      filters: testFilters,
    });

    await page.goto(
      `/feeds/${testFeed.id}/discord-channel-connections/${sourceConnection.id}`,
    );

    await expect(
      page.getByRole("heading", { name: sourceConnection.name }),
    ).toBeVisible({ timeout: 10000 });

    const actionsButton = page.getByRole("button", {
      name: "Connection Actions",
    });
    await actionsButton.waitFor({ timeout: 10000 });
    await actionsButton.click();

    await page
      .getByRole("menuitem")
      .filter({ hasText: "Copy settings to" })
      .click();

    await expect(
      page.getByRole("dialog").getByText("Copy connection settings"),
    ).toBeVisible({ timeout: 10000 });

    await checkSettingsCheckbox(page, "Filters");
    await checkConnectionCheckbox(page, target.name);

    await page.getByRole("button", { name: /Copy to 1 connection/i }).click();

    await expect(
      page.getByText(/Successfully copied connection settings/),
    ).toBeVisible({ timeout: 30000 });

    // Navigate to target connection and verify filters were copied
    await page.getByRole("link", { name: testFeed.title }).click();
    await page.getByRole("tab", { name: "Connections" }).click();
    await page.getByRole("link", { name: target.name }).click();

    await expect(page.getByRole("heading", { name: target.name })).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("tab", { name: "Article Filters" }).click();
    await expect(page.locator('input[value="copy-test"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("webhook settings only copy to webhook connections", async ({
    page,
    testFeed,
  }) => {
    const channelId = getTestChannelId();
    test.skip(!channelId, "channelId must be configured in e2econfig.json");

    const webhookSource = await createWebhookConnection(
      page,
      testFeed.id,
      channelId!,
      {
        name: `Webhook Source ${Date.now()}`,
        webhookName: "Source Webhook Name",
        webhookIconUrl: "https://example.com/source-icon.png",
      },
    );

    const webhookTarget = await createWebhookConnection(
      page,
      testFeed.id,
      channelId!,
      {
        name: `Webhook Target ${Date.now()}`,
        webhookName: "Target Webhook Name",
      },
    );

    const channelTarget = await createConnection(
      page,
      testFeed.id,
      channelId!,
      { name: `Channel Target ${Date.now()}` },
    );

    await page.goto(
      `/feeds/${testFeed.id}/discord-channel-connections/${webhookSource.id}`,
    );

    await expect(
      page.getByRole("heading", { name: webhookSource.name }),
    ).toBeVisible({ timeout: 10000 });

    const actionsButton = page.getByRole("button", {
      name: "Connection Actions",
    });
    await actionsButton.waitFor({ timeout: 10000 });
    await actionsButton.click();

    await page
      .getByRole("menuitem")
      .filter({ hasText: "Copy settings to" })
      .click();

    await expect(
      page.getByRole("dialog").getByText("Copy connection settings"),
    ).toBeVisible({ timeout: 10000 });

    const dialog = page.getByRole("dialog");
    const webhookCategoryCheckbox = dialog
      .locator("label")
      .filter({ hasText: /^Webhook/ })
      .first()
      .locator("input[type='checkbox']");
    await webhookCategoryCheckbox.scrollIntoViewIfNeeded();
    await webhookCategoryCheckbox.check({ force: true });

    await checkConnectionCheckbox(page, webhookTarget.name);
    await checkConnectionCheckbox(page, channelTarget.name);

    await page.getByRole("button", { name: /Copy to 2 connections/i }).click();

    await expect(
      page.getByText(/Successfully copied connection settings/),
    ).toBeVisible({ timeout: 30000 });

    // Navigate to webhook target and verify webhook settings were copied
    await page.getByRole("link", { name: testFeed.title }).click();
    await page.getByRole("tab", { name: "Connections" }).click();
    await page.getByRole("link", { name: webhookTarget.name }).click();

    await expect(
      page.getByRole("heading", { name: webhookTarget.name }),
    ).toBeVisible({ timeout: 10000 });

    // Verify webhook name was copied
    await expect(page.getByText("Source Webhook Name")).toBeVisible({
      timeout: 10000,
    });
  });

  test("can copy content and embeds settings", async ({ page, testFeed }) => {
    const channelId = getTestChannelId();
    test.skip(!channelId, "channelId must be configured in e2econfig.json");

    const sourceConnection = await createConnection(
      page,
      testFeed.id,
      channelId!,
      { name: `Source Content ${Date.now()}` },
    );
    const target = await createConnection(page, testFeed.id, channelId!, {
      name: `Target Content ${Date.now()}`,
    });

    const testContent = "Test content {{title}}";
    const testEmbeds = [
      {
        title: "Test Embed",
        description: "Test description {{description}}",
      },
    ];

    await updateConnection(page, testFeed.id, sourceConnection.id, {
      content: testContent,
      embeds: testEmbeds,
    });

    await page.goto(
      `/feeds/${testFeed.id}/discord-channel-connections/${sourceConnection.id}`,
    );

    await expect(
      page.getByRole("heading", { name: sourceConnection.name }),
    ).toBeVisible({ timeout: 10000 });

    const actionsButton = page.getByRole("button", {
      name: "Connection Actions",
    });
    await actionsButton.waitFor({ timeout: 10000 });
    await actionsButton.click();

    await page
      .getByRole("menuitem")
      .filter({ hasText: "Copy settings to" })
      .click();

    await expect(
      page.getByRole("dialog").getByText("Copy connection settings"),
    ).toBeVisible({ timeout: 10000 });

    await checkSettingsCheckbox(page, "Text content");
    await checkSettingsCheckbox(page, "Embeds");

    await checkConnectionCheckbox(page, target.name);

    await page.getByRole("button", { name: /Copy to 1 connection/i }).click();

    await expect(
      page.getByText(/Successfully copied connection settings/),
    ).toBeVisible({ timeout: 30000 });

    // Navigate to target and verify content/embeds were copied
    await page.getByRole("link", { name: testFeed.title }).click();
    await page.getByRole("tab", { name: "Connections" }).click();
    await page.getByRole("link", { name: target.name }).click();

    await expect(page.getByRole("heading", { name: target.name })).toBeVisible({
      timeout: 10000,
    });

    // Verify text content was copied - check the Message tab
    await page.getByRole("tab", { name: "Message" }).click();
    const contentTextarea = page.getByLabel("Text content");
    await expect(contentTextarea).toHaveValue(testContent, {
      timeout: 10000,
    });
  });
});
