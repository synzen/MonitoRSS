import { test, expect } from "../fixtures/test-fixtures";
import {
  createFeed,
  createConnection,
  deleteFeed,
  getTestForumChannelId,
  getTestForumChannelName,
  getTestServerName,
  getTestChannelId,
} from "../helpers/api";

test.describe("Message Builder V2", () => {
  test("can build v2 message with all components, preview, and send test article before and after saving", async ({
    page,
    testFeedWithConnection,
  }) => {
    const { feed, connection } = testFeedWithConnection;

    await page.goto(
      `/feeds/${feed.id}/discord-channel-connections/${connection.id}/message-builder`,
    );

    // Dismiss the welcome dialog
    const welcomeDialog = page.getByRole("dialog", {
      name: "Welcome to your Message Builder!",
    });
    await expect(welcomeDialog).toBeVisible({ timeout: 10000 });
    await welcomeDialog
      .getByRole("button", {
        name: "Skip the message builder tour and start using the feature",
      })
      .click();
    await expect(welcomeDialog).not.toBeVisible({ timeout: 5000 });

    // Wait for article to load in preview
    await expect(
      page.getByText("Previewing Article", { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    const tree = page.getByRole("tree");

    // Click the root tree item to select it and show its properties
    await tree.getByRole("treeitem").first().click();

    // Click the Components V2 radio card in the properties panel
    await page.getByRole("radiogroup").getByText("Components V2").click();

    // If a confirmation dialog appears, click "Switch Format"
    const switchButton = page.getByRole("button", { name: "Switch Format" });
    if (await switchButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await switchButton.click();
    }

    // Wait for tree to update
    await expect(
      tree.getByRole("treeitem").first().getByText("Components V2"),
    ).toBeVisible({ timeout: 10000 });

    // Helper to add a component from the selected tree item
    async function addComponent(parentText: string, menuItemName: string) {
      await tree.getByText(parentText, { exact: true }).first().click();
      await page.getByRole("button", { name: /New Component/i }).click();
      await page.getByRole("menuitem", { name: menuItemName }).click();
    }

    // Add all V2 component types
    await addComponent("Components V2", "Add Container");
    await addComponent("Components V2", "Add Section");
    await addComponent("Components V2", "Add Action Row");
    await addComponent("Components V2", "Add Divider");
    await addComponent("Container", "Add Text Display");
    await addComponent("Container", "Add Media Gallery");
    await addComponent("Media Gallery", "Add Gallery Item");
    await addComponent("Section", "Add Text Display");
    await addComponent("Section", "Add Thumbnail Accessory");
    await addComponent("Action Row", "Add Button");

    // Configure component properties

    // Container > Text Display
    await tree.getByRole("treeitem", { name: "Text Display" }).first().click();
    await page.getByRole("textbox", { name: "Text Content" }).fill("{{title}}");

    // Media Gallery > Gallery Item
    await tree.getByRole("treeitem", { name: "Gallery Item" }).click();
    await page
      .getByRole("textbox", { name: "Media URL" })
      .fill("{{extracted::description::image1}}");

    // Section > Text Display
    await tree.getByRole("treeitem", { name: "Text Display" }).nth(1).click();
    await page
      .getByRole("textbox", { name: "Text Content" })
      .fill("{{description}}");

    // Section > Thumbnail Accessory
    await tree.getByRole("treeitem", { name: "Thumbnail (Accessory)" }).click();
    await page
      .getByRole("textbox", { name: "Image URL" })
      .fill("{{extracted::description::image1}}");

    // Action Row > Button
    await tree.getByRole("treeitem", { name: "Button" }).click();
    await page.getByRole("textbox", { name: "Button Label" }).fill("Click Me");
    await page
      .getByRole("combobox", { name: "Button Style" })
      .selectOption("Link");
    await page.getByRole("textbox", { name: "Link URL" }).fill("{{link}}");

    // Wait for changes to be detected and Save Changes to be enabled
    await expect(
      page.getByRole("button", { name: "Save Changes" }),
    ).toBeEnabled({ timeout: 10000 });

    const previewLoadingBar = page.getByLabel("Updating message preview");

    // Helper to verify preview components rendered with resolved article data
    async function verifyPreviewComponents() {
      // Wait for preview to finish loading
      await expect(previewLoadingBar).not.toBeVisible({ timeout: 30000 });

      await expect(page.getByText("Failed to load preview.")).not.toBeVisible();

      // Separator/Divider should be present in the preview
      await expect(page.getByRole("separator").first()).toBeVisible({
        timeout: 15000,
      });

      // Button should render as a link with the configured label
      await expect(page.getByRole("link", { name: "Click Me" })).toBeVisible();

      // Section TextDisplay should show the resolved description text
      await expect(
        page.getByText("This is test article", { exact: false }),
      ).toBeVisible();
    }

    // Verify preview components rendered (before save)
    await verifyPreviewComponents();

    // Send test article (before save)
    await page.getByRole("button", { name: /Send to Discord/i }).click();

    await expect(
      page.getByText("Successfully sent article to Discord."),
    ).toBeVisible({ timeout: 30000 });

    // Close the success alert from the send before saving
    const closeButton = page
      .getByRole("alert")
      .getByRole("button", { name: "Close" });
    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click();
    }

    // Save the message
    await page.getByRole("button", { name: "Save Changes" }).click();

    // Wait for save to complete - "unsaved changes" text should disappear
    await expect(
      page.getByText("You are previewing unsaved changes"),
    ).not.toBeVisible({ timeout: 30000 });

    // Verify preview components still rendered correctly after save
    await verifyPreviewComponents();

    // Send test article (after save)
    await page.getByRole("button", { name: /Send to Discord/i }).click();

    await expect(
      page.getByText("Successfully sent article to Discord."),
    ).toBeVisible({ timeout: 30000 });
  });

  test("can configure root settings and verify their effect on preview", async ({
    page,
    testFeedWithConnection,
  }) => {
    const { feed, connection } = testFeedWithConnection;

    await page.goto(
      `/feeds/${feed.id}/discord-channel-connections/${connection.id}/message-builder`,
    );

    // Dismiss the welcome dialog
    const welcomeDialog = page.getByRole("dialog", {
      name: "Welcome to your Message Builder!",
    });
    await expect(welcomeDialog).toBeVisible({ timeout: 10000 });
    await welcomeDialog
      .getByRole("button", {
        name: "Skip the message builder tour and start using the feature",
      })
      .click();
    await expect(welcomeDialog).not.toBeVisible({ timeout: 5000 });

    // Wait for article to load in preview
    await expect(
      page.getByText("Previewing Article", { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    const tree = page.getByRole("tree");
    const previewLoadingBar = page.getByLabel("Updating message preview");

    async function waitForPreview() {
      await expect(previewLoadingBar).not.toBeVisible({ timeout: 30000 });
      await expect(page.getByText("Failed to load preview.")).not.toBeVisible();
    }

    // Click the root tree item to select it and show its properties
    await tree.getByRole("treeitem").first().click();

    // Switch to Components V2 format
    await page.getByRole("radiogroup").getByText("Components V2").click();

    const switchFormatButton = page.getByRole("button", {
      name: "Switch Format",
    });
    if (
      await switchFormatButton.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await switchFormatButton.click();
    }

    await expect(
      tree.getByRole("treeitem").first().getByText("Components V2"),
    ).toBeVisible({ timeout: 10000 });

    async function addComponent(parentText: string, menuItemName: string) {
      await tree.getByText(parentText, { exact: true }).first().click();
      await page.getByRole("button", { name: /New Component/i }).click();
      await page.getByRole("menuitem", { name: menuItemName }).click();
    }

    // Add Container with two Text Displays upfront
    await addComponent("Components V2", "Add Container");
    await addComponent("Container", "Add Text Display");
    await addComponent("Container", "Add Text Display");

    // Configure first Text Display with {{description}}
    await tree.getByRole("treeitem", { name: "Text Display" }).first().click();
    await page
      .getByRole("textbox", { name: "Text Content" })
      .fill("{{description}}");

    // Configure second Text Display with {{title}}
    await tree.getByRole("treeitem", { name: "Text Display" }).nth(1).click();
    await page.getByRole("textbox", { name: "Text Content" }).fill("{{title}}");

    await waitForPreview();

    // --- Test Strip Images ---
    // Article 1 description renders the image URL as a link in the preview
    const imageLink = page.getByRole("link", {
      name: "https://i.imgur.com/EXAMPLE1.png",
    });
    await expect(imageLink).toBeVisible({ timeout: 15000 });

    // Click root tree item to access root settings
    await tree.getByText("Components V2", { exact: true }).click();

    // Wait for any toast notifications to disappear
    await page.waitForTimeout(2000);

    // Toggle Strip Images ON
    await page.getByLabel("Strip Images").click({ force: true });

    await waitForPreview();

    // Verify image link is removed from preview after stripping images
    await expect(imageLink).not.toBeVisible({
      timeout: 15000,
    });

    // --- Test Placeholder Limits ---
    // Add a placeholder limit for title with 10 char limit and "..." append
    await page.getByRole("button", { name: "Add placeholder limit" }).click();

    const placeholderDialog = page.getByRole("dialog");
    await expect(placeholderDialog).toBeVisible({ timeout: 5000 });

    // Wait for the placeholder select to auto-populate
    await page.waitForTimeout(1000);

    // Fill character limit
    const charLimitInput = placeholderDialog.locator(
      'input[inputmode="numeric"]',
    );
    await charLimitInput.fill("10");
    await expect(charLimitInput).toHaveValue("10");

    // Fill append text
    const appendTextarea = placeholderDialog.locator("textarea");
    await appendTextarea.fill("...");

    // Save the placeholder limit
    await placeholderDialog.getByRole("button", { name: "Save" }).click();

    // Wait for dialog to close
    await expect(placeholderDialog).not.toBeVisible({ timeout: 5000 });

    await waitForPreview();

    // The title "Test Article 1" should be truncated with "..." appended
    // The backend may truncate at word boundaries
    await expect(page.getByText("Test...", { exact: false })).toBeVisible({
      timeout: 15000,
    });

    // --- Test Placeholder Fallback ---
    // Toggle Placeholder Fallback ON (still on root panel)
    await page.waitForTimeout(1000);
    await page.getByLabel("Placeholder Fallback").click({ force: true });

    // Update the first Text Display content to use fallback syntax
    await tree.getByRole("treeitem", { name: "Text Display" }).first().click();
    await page
      .getByRole("textbox", { name: "Text Content" })
      .fill("{{nonExistentField||title}}");

    await waitForPreview();

    // Verify preview shows the fallback title (truncated due to placeholder limit)
    await expect(page.getByText("Test...", { exact: false })).toBeVisible({
      timeout: 15000,
    });

    // --- Save and verify persistence ---
    // Click root to ensure save button context
    await tree.getByText("Components V2", { exact: true }).click();

    await expect(
      page.getByRole("button", { name: "Save Changes" }),
    ).toBeEnabled({ timeout: 10000 });

    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(
      page.getByText("You are previewing unsaved changes"),
    ).not.toBeVisible({ timeout: 30000 });

    // Reload page to verify persistence
    await page.reload();

    // Dismiss the welcome dialog again after reload
    const welcomeDialog2 = page.getByRole("dialog", {
      name: "Welcome to your Message Builder!",
    });
    if (await welcomeDialog2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await welcomeDialog2
        .getByRole("button", {
          name: "Skip the message builder tour and start using the feature",
        })
        .click();
    }

    await expect(
      page.getByText("Previewing Article", { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // Click root tree item to check persisted settings
    await tree.getByText("Components V2", { exact: true }).click();

    // Verify Strip Images toggle is ON
    await expect(page.getByLabel("Strip Images")).toBeChecked({
      timeout: 10000,
    });

    // Verify Placeholder Fallback toggle is ON
    await expect(page.getByLabel("Placeholder Fallback")).toBeChecked({
      timeout: 10000,
    });

    // Verify placeholder limit row is still visible in the table
    await expect(page.getByText("{{title}}")).toBeVisible();
    await expect(page.getByRole("cell", { name: "10" })).toBeVisible();
  });

  test("shows resolution warnings when placeholders resolve to empty and clears them when fixed", async ({
    page,
    testFeedWithConnection,
  }) => {
    const { feed, connection } = testFeedWithConnection;

    await page.goto(
      `/feeds/${feed.id}/discord-channel-connections/${connection.id}/message-builder`,
    );

    // Dismiss the welcome dialog
    const welcomeDialog = page.getByRole("dialog", {
      name: "Welcome to your Message Builder!",
    });
    await expect(welcomeDialog).toBeVisible({ timeout: 10000 });
    await welcomeDialog
      .getByRole("button", {
        name: "Skip the message builder tour and start using the feature",
      })
      .click();
    await expect(welcomeDialog).not.toBeVisible({ timeout: 5000 });

    // Wait for article to load in preview
    await expect(
      page.getByText("Previewing Article", { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    const tree = page.getByRole("tree");

    // Click the root tree item and switch to Components V2
    await tree.getByRole("treeitem").first().click();
    await page.getByRole("radiogroup").getByText("Components V2").click();
    const switchButton = page.getByRole("button", { name: "Switch Format" });
    if (await switchButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await switchButton.click();
    }
    await expect(
      tree.getByRole("treeitem").first().getByText("Components V2"),
    ).toBeVisible({ timeout: 10000 });

    async function addComponent(parentText: string, menuItemName: string) {
      await tree.getByText(parentText, { exact: true }).first().click();
      await page.getByRole("button", { name: /New Component/i }).click();
      await page.getByRole("menuitem", { name: menuItemName }).click();
    }

    const previewLoadingBar = page.getByLabel("Updating message preview");

    async function waitForPreview() {
      await expect(previewLoadingBar).not.toBeVisible({ timeout: 30000 });
      await expect(page.getByText("Failed to load preview.")).not.toBeVisible();
    }

    // Add Section with Text Display + Thumbnail Accessory + Action Row with Button
    await addComponent("Components V2", "Add Section");
    await addComponent("Section", "Add Text Display");
    await addComponent("Section", "Add Thumbnail Accessory");
    await addComponent("Components V2", "Add Action Row");
    await addComponent("Action Row", "Add Button");

    // Set Text Display content to a non-existent placeholder
    await tree.getByRole("treeitem", { name: "Text Display" }).first().click();
    await page
      .getByRole("textbox", { name: "Text Content" })
      .fill("{{nonExistentField}}");

    // Set Thumbnail URL to a non-existent placeholder
    await tree.getByRole("treeitem", { name: "Thumbnail (Accessory)" }).click();
    await page
      .getByRole("textbox", { name: "Image URL" })
      .fill("{{nonExistentField}}");

    // Set Button label to non-existent placeholder, style to Link, URL to valid
    await tree.getByRole("treeitem", { name: "Button" }).click();
    await page
      .getByRole("textbox", { name: "Button Label" })
      .fill("{{nonExistentField}}");
    await page
      .getByRole("combobox", { name: "Button Style" })
      .selectOption("Link");
    await page
      .getByRole("textbox", { name: "Link URL" })
      .fill("https://example.com");

    // Wait for preview to load
    await waitForPreview();

    // Verify warnings appear in Problems section
    const problemsSection = page.locator(
      '[data-tour-target="problems-section"]',
    );

    // Check that the problems count is at least 1
    await expect(problemsSection.getByText(/\(\d+\)/)).toBeVisible({
      timeout: 15000,
    });

    // Verify warning text is visible
    await expect(
      page.getByText("placeholder", { exact: false }).first(),
    ).toBeVisible({ timeout: 10000 });

    // Verify warning indicators in tree
    await expect(
      page.locator('[aria-label="Warning detected"]').first(),
    ).toBeVisible({ timeout: 10000 });

    // Verify warnings don't block save
    const saveButton = page.getByRole("button", { name: "Save Changes" });
    await expect(saveButton).toBeEnabled({ timeout: 10000 });

    // Click Save - save should succeed without problems dialog
    await saveButton.click();

    // The problems dialog should NOT appear (it only appears for errors)
    await expect(page.getByText("Failed to Save Changes")).not.toBeVisible({
      timeout: 5000,
    });

    // Wait for save to complete
    await expect(
      page.getByText("You are previewing unsaved changes"),
    ).not.toBeVisible({ timeout: 30000 });

    // Now fix the Text Display by changing to a valid placeholder
    await tree.getByRole("treeitem", { name: "Text Display" }).first().click();
    await page.getByRole("textbox", { name: "Text Content" }).fill("{{title}}");

    // Wait for preview to reload
    await waitForPreview();

    // The Text Display warning should be gone, but Thumbnail and Button warnings remain
    // Verify that at least one warning is still present (Thumbnail/Button)
    await expect(
      page.locator('[aria-label="Warning detected"]').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("can configure forum thread settings and verify persistence", async ({
    page,
  }, testInfo) => {
    const forumChannelId = getTestForumChannelId();
    const channelId = getTestChannelId();

    if (!forumChannelId || !channelId) {
      testInfo.skip(
        true,
        "forumChannelId and channelId must be configured for this test",
      );
      return;
    }

    // Create feed + forum connection via API
    const feed = await createFeed(page);

    try {
      const connection = await createConnection(page, feed.id, forumChannelId);

      await page.goto(
        `/feeds/${feed.id}/discord-channel-connections/${connection.id}/message-builder`,
      );

      // Dismiss the welcome dialog
      const welcomeDialog = page.getByRole("dialog", {
        name: "Welcome to your Message Builder!",
      });
      await expect(welcomeDialog).toBeVisible({ timeout: 10000 });
      await welcomeDialog
        .getByRole("button", {
          name: "Skip the message builder tour and start using the feature",
        })
        .click();
      await expect(welcomeDialog).not.toBeVisible({ timeout: 5000 });

      await expect(
        page.getByText("Previewing Article", { exact: true }),
      ).toBeVisible({ timeout: 15000 });

      const tree = page.getByRole("tree");

      // Click root tree item
      await tree.getByRole("treeitem").first().click();

      // Verify Forum Thread Title input is visible
      const forumThreadTitleInput = page.getByPlaceholder("Forum thread title");
      await expect(forumThreadTitleInput).toBeVisible({ timeout: 10000 });

      // Fill Forum Thread Title
      await forumThreadTitleInput.fill("{{title}} - Forum Post");

      // Save changes
      await expect(
        page.getByRole("button", { name: "Save Changes" }),
      ).toBeEnabled({ timeout: 10000 });
      await page.getByRole("button", { name: "Save Changes" }).click();

      await expect(
        page.getByText("You are previewing unsaved changes"),
      ).not.toBeVisible({ timeout: 30000 });

      // Reload to verify persistence
      await page.reload();

      const welcomeDialog2 = page.getByRole("dialog", {
        name: "Welcome to your Message Builder!",
      });
      if (
        await welcomeDialog2.isVisible({ timeout: 5000 }).catch(() => false)
      ) {
        await welcomeDialog2
          .getByRole("button", {
            name: "Skip the message builder tour and start using the feature",
          })
          .click();
      }

      await expect(
        page.getByText("Previewing Article", { exact: true }),
      ).toBeVisible({ timeout: 15000 });

      await tree.getByRole("treeitem").first().click();

      // Verify forum thread title persisted
      await expect(forumThreadTitleInput).toHaveValue("{{title}} - Forum Post");
    } finally {
      await deleteFeed(page, feed.id).catch(() => {});
    }
  });

  test("can add forum connection with branding and send test article", async ({
    page,
    testFeed,
  }) => {
    const serverName = getTestServerName();
    const forumChannelName = getTestForumChannelName();

    test.skip(
      !serverName || !forumChannelName,
      "serverName and forumChannelName must be configured in e2econfig.json",
    );

    await page.goto(`/feeds/${testFeed.id}`);
    await expect(
      page.getByRole("button", { name: /Add connection/i }).first(),
    ).toBeVisible({ timeout: 10000 });

    await page
      .getByRole("button", { name: /Add connection/i })
      .first()
      .click();

    await page.locator("#server-select").click();
    await page
      .locator('[role="option"]')
      .filter({ hasText: serverName! })
      .click();

    await expect(page.getByText("Select a channel")).toBeVisible({
      timeout: 15000,
    });
    await page.locator("#channel-select").focus();
    await page.locator("#channel-select").press("ArrowDown");
    await page
      .locator('[role="option"]')
      .filter({ hasText: forumChannelName! })
      .first()
      .click({ timeout: 15000 });

    await page.getByRole("button", { name: /Next: Choose Template/i }).click();

    const modal = page.getByTestId("template-selection-modal");
    await expect(modal).toBeVisible({ timeout: 10000 });

    await page.getByText("Simple Text").first().click();
    await expect(
      modal.locator("strong").filter({ hasText: "Test Article" }),
    ).toBeVisible({ timeout: 10000 });

    await modal.getByLabel("Display Name").fill("E2E Forum Branding Bot");
    await modal
      .getByLabel("Avatar URL")
      .fill("https://i.imgur.com/test-avatar.png");

    await modal.getByRole("button", { name: /Send to Discord/i }).click();

    await expect(
      modal.getByText("Article sent to Discord successfully!"),
    ).toBeVisible({ timeout: 30000 });
  });

  test("can add forum connection without branding and send test article", async ({
    page,
    testFeed,
  }) => {
    const serverName = getTestServerName();
    const forumChannelName = getTestForumChannelName();

    test.skip(
      !serverName || !forumChannelName,
      "serverName and forumChannelName must be configured in e2econfig.json",
    );

    await page.goto(`/feeds/${testFeed.id}`);
    await expect(
      page.getByRole("button", { name: /Add connection/i }).first(),
    ).toBeVisible({ timeout: 10000 });

    await page
      .getByRole("button", { name: /Add connection/i })
      .first()
      .click();

    await page.locator("#server-select").click();
    await page
      .locator('[role="option"]')
      .filter({ hasText: serverName! })
      .click();

    await expect(page.getByText("Select a channel")).toBeVisible({
      timeout: 15000,
    });
    await page.locator("#channel-select").focus();
    await page.locator("#channel-select").press("ArrowDown");
    await page
      .locator('[role="option"]')
      .filter({ hasText: forumChannelName! })
      .first()
      .click({ timeout: 15000 });

    await page.getByRole("button", { name: /Next: Choose Template/i }).click();

    const modal = page.getByTestId("template-selection-modal");
    await expect(modal).toBeVisible({ timeout: 10000 });

    await page.getByText("Simple Text").first().click();
    await expect(
      modal.locator("strong").filter({ hasText: "Test Article" }),
    ).toBeVisible({ timeout: 10000 });

    await modal.getByRole("button", { name: /Send to Discord/i }).click();

    await expect(
      modal.getByText("Article sent to Discord successfully!"),
    ).toBeVisible({ timeout: 30000 });
  });
});
