import { test, expect } from "../fixtures/test-fixtures";
import {
  createFeed,
  createConnectionWithOptions,
  deleteFeed,
  getTestChannelId,
} from "../helpers/api";

test.describe("Message Builder V1", () => {
  test("can build v1 message with all components, preview, and send test article before and after saving", async ({
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

    // Helper to add a component from the selected tree item
    async function addComponent(parentText: string, menuItemName: string) {
      await tree.getByText(parentText, { exact: true }).first().click();
      await page.getByRole("button", { name: /New Component/i }).click();
      await page.getByRole("menuitem", { name: menuItemName }).click();
    }

    // Add all V1 component types
    await addComponent("Components V1", "Add Custom Text");
    await addComponent("Components V1", "Add Embeds List");
    await addComponent("Embeds List", "Add Embed");
    // 1st Embed children
    await addComponent("Embed", "Add Author");
    await addComponent("Embed", "Add Title");
    await addComponent("Embed", "Add Description");
    await addComponent("Embed", "Add Image");
    await addComponent("Embed", "Add Thumbnail");
    await addComponent("Embed", "Add Footer");
    await addComponent("Embed", "Add Timestamp");
    await addComponent("Embed", "Add Field");
    // 2nd Embed
    await addComponent("Embeds List", "Add Embed");
    // Use nth(1) for 2nd Embed children
    await tree.getByText("Embed", { exact: true }).nth(1).click();
    await page.getByRole("button", { name: /New Component/i }).click();
    await page.getByRole("menuitem", { name: "Add Title" }).click();
    await tree.getByText("Embed", { exact: true }).nth(1).click();
    await page.getByRole("button", { name: /New Component/i }).click();
    await page.getByRole("menuitem", { name: "Add Description" }).click();
    // Action Row + Button
    await addComponent("Components V1", "Add Action Row");
    await addComponent("Action Row", "Add Button");

    // Configure component properties

    // Custom Text
    await tree.getByRole("treeitem", { name: "Custom Text" }).click();
    await page.getByRole("textbox", { name: "Text Content" }).fill("{{title}}");

    // 1st Embed > Author
    await tree.getByRole("treeitem", { name: "Author" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("Author Name");
    await page
      .getByRole("textbox", { name: "URL", exact: true })
      .fill("{{link}}");

    // 1st Embed > Title
    await tree.getByRole("treeitem", { name: "Title" }).first().click();
    await page.getByRole("textbox", { name: "Text" }).fill("{{title}}");
    await page
      .getByRole("textbox", { name: "URL", exact: true })
      .fill("{{link}}");

    // 1st Embed > Description
    await tree.getByRole("treeitem", { name: "Description" }).first().click();
    await page
      .getByRole("textbox", { name: "Description" })
      .fill("{{description}}");

    // 1st Embed > Image
    await tree.getByRole("treeitem", { name: "Image" }).click();
    await page
      .getByRole("textbox", { name: "Image URL" })
      .fill("{{extracted::description::image1}}");

    // 1st Embed > Thumbnail
    await tree.getByRole("treeitem", { name: "Thumbnail" }).click();
    await page
      .getByRole("textbox", { name: "Image URL" })
      .fill("{{extracted::description::image1}}");

    // 1st Embed > Footer
    await tree.getByRole("treeitem", { name: "Footer" }).click();
    await page.getByRole("textbox", { name: "Text" }).fill("Footer text");

    // 1st Embed > Timestamp
    await tree.getByRole("treeitem", { name: "Timestamp" }).click();
    await page.locator('input[type="radio"][value="article"]').click({
      force: true,
    });

    // 1st Embed > Field
    await tree.getByRole("treeitem", { name: "Field" }).click();
    await page.getByRole("textbox", { name: "Field Name" }).fill("Field 1");
    await page.getByRole("textbox", { name: "Field Value" }).fill("{{title}}");
    await page.getByRole("checkbox", { name: "Inline Field" }).click({
      force: true,
    });

    // 2nd Embed > Title
    await tree.getByRole("treeitem", { name: "Title" }).nth(1).click();
    await page
      .getByRole("textbox", { name: "Text" })
      .fill("Second embed title");

    // 2nd Embed > Description
    await tree.getByRole("treeitem", { name: "Description" }).nth(1).click();
    await page
      .getByRole("textbox", { name: "Description" })
      .fill("Second embed description");

    // Action Row > Button
    await tree.getByRole("treeitem", { name: "Button" }).click();
    await page.getByRole("textbox", { name: "Button Label" }).fill("Read More");
    await page.getByRole("textbox", { name: "Link URL" }).fill("{{link}}");

    // Wait for changes to be detected and Save Changes to be enabled
    await expect(
      page.getByRole("button", { name: "Save Changes" }),
    ).toBeEnabled({ timeout: 10000 });

    const previewLoadingBar = page.getByLabel("Updating message preview");

    async function verifyPreviewComponents() {
      await expect(previewLoadingBar).not.toBeVisible({ timeout: 30000 });

      await expect(page.getByText("Failed to load preview.")).not.toBeVisible();

      await expect(
        page.getByText("This is test article", { exact: false }),
      ).toBeVisible();

      await expect(
        page.getByRole("button", { name: "Read More" }),
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

    // Helper to add a component from the selected tree item
    async function addComponent(parentText: string, menuItemName: string) {
      await tree.getByText(parentText, { exact: true }).first().click();
      await page.getByRole("button", { name: /New Component/i }).click();
      await page.getByRole("menuitem", { name: menuItemName }).click();
    }

    // Add a Custom Text component with {{description}} to test root settings
    await addComponent("Components V1", "Add Custom Text");
    await tree.getByRole("treeitem", { name: "Custom Text" }).click();
    await page
      .getByRole("textbox", { name: "Text Content" })
      .fill("{{description}}");

    await waitForPreview();

    // --- Test Format Tables ---
    // Change article to Article 3 which has a table in its description
    await page.getByRole("button", { name: "Change Article" }).click();

    const articleDialog = page.getByRole("dialog", {
      name: "Select Article",
    });
    await expect(articleDialog).toBeVisible({ timeout: 10000 });

    // Click on Article 3 in the list
    await articleDialog.getByText("Test Article 3", { exact: false }).click();

    // Wait for dialog to close
    await expect(articleDialog).not.toBeVisible({ timeout: 5000 });

    await waitForPreview();

    // Click root tree item to access root settings
    await tree.getByText("Components V1", { exact: true }).click();

    // Wait for any toast notifications to disappear
    await page.waitForTimeout(2000);

    // Toggle Format Tables ON
    await page.getByLabel("Format Tables").click({ force: true });

    await waitForPreview();

    // When Format Tables is ON, tables are wrapped in triple backticks
    await expect(page.getByText("```", { exact: false })).toBeVisible({
      timeout: 15000,
    });

    // --- Test Ignore New Lines ---
    // Change article to Article 4 which has excessive newlines
    await page.getByRole("button", { name: "Change Article" }).click();

    const articleDialog2 = page.getByRole("dialog", {
      name: "Select Article",
    });
    await expect(articleDialog2).toBeVisible({ timeout: 10000 });

    await articleDialog2.getByText("Test Article 4", { exact: false }).click();

    await expect(articleDialog2).not.toBeVisible({ timeout: 5000 });

    await waitForPreview();

    // Click root tree item to access root settings
    await tree.getByText("Components V1", { exact: true }).click();

    // Toggle Ignore New Lines ON
    await page.getByLabel("Ignore New Lines").click({ force: true });

    await waitForPreview();

    // With Ignore New Lines ON, "Line one" and "Line two" should appear closer together
    // The preview should still contain the text but without excessive spacing
    await expect(page.getByText("Line one", { exact: false })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Line two", { exact: false })).toBeVisible();

    // --- Test Mentions ---
    // Click root tree item to access root settings
    await tree.getByText("Components V1", { exact: true }).click();

    // Click "Add Mention" button
    await page.getByRole("button", { name: "Add Mention" }).click();

    const mentionDialog = page.getByRole("dialog");
    await expect(mentionDialog).toBeVisible({ timeout: 5000 });

    // Click "Role" type
    await mentionDialog.getByRole("button", { name: "Role" }).click();

    // Wait for roles to load, then click "Insert" on the first role (@everyone)
    await expect(
      mentionDialog.getByRole("button", { name: "Insert" }).first(),
    ).toBeVisible({ timeout: 15000 });
    await mentionDialog.getByRole("button", { name: "Insert" }).first().click();

    // Verify the mention dialog closed
    await expect(mentionDialog).not.toBeVisible({ timeout: 5000 });

    // Verify mention tag appears (it shows the role name in a Tag component)
    await expect(page.getByText("@everyone", { exact: false })).toBeVisible({
      timeout: 10000,
    });

    // --- Save and verify persistence ---
    await expect(
      page.getByRole("button", { name: "Save Changes" }),
    ).toBeEnabled({ timeout: 10000 });

    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(
      page.getByText("You are previewing unsaved changes"),
    ).not.toBeVisible({ timeout: 30000 });

    // Reload page to verify persistence
    await page.reload();

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
    await tree.getByText("Components V1", { exact: true }).click();

    // Verify Format Tables toggle is ON
    await expect(page.getByLabel("Format Tables")).toBeChecked({
      timeout: 10000,
    });

    // Verify Ignore New Lines toggle is ON
    await expect(page.getByLabel("Ignore New Lines")).toBeChecked({
      timeout: 10000,
    });

    // Verify mention tag still appears
    await expect(page.getByText("@everyone", { exact: false })).toBeVisible({
      timeout: 10000,
    });
  });

  test("can configure channel thread settings and verify persistence", async ({
    page,
  }, testInfo) => {
    const channelId = getTestChannelId();

    if (!channelId) {
      testInfo.skip(true, "channelId must be configured for this test");
      return;
    }

    // Create feed + connection with threadCreationMethod
    const feed = await createFeed(page);

    try {
      const connection = await createConnectionWithOptions(
        page,
        feed.id,
        channelId,
        { threadCreationMethod: "new-thread" },
      );

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

      // Verify Channel Thread Title input is visible
      const channelThreadTitleInput = page.getByPlaceholder(
        "Channel thread title",
      );
      await expect(channelThreadTitleInput).toBeVisible({ timeout: 10000 });

      // Fill Channel Thread Title
      await channelThreadTitleInput.fill("{{title}} - Thread");

      // Verify Hide Message in Channel switch is visible
      // Verify Hide Message in Channel switch is visible and toggle ON
      const hideMessageSwitch = page.getByLabel("Hide Message in Channel");
      await expect(hideMessageSwitch).toBeVisible({ timeout: 10000 });
      await hideMessageSwitch.click({ force: true });

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

      // Verify channel thread title persisted
      await expect(channelThreadTitleInput).toHaveValue("{{title}} - Thread");

      // Verify Hide Message in Channel toggle is ON
      await expect(page.getByLabel("Hide Message in Channel")).toBeChecked({
        timeout: 10000,
      });
    } finally {
      await deleteFeed(page, feed.id).catch(() => {});
    }
  });
});
