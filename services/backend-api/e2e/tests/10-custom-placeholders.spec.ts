import { test, expect } from "../fixtures/test-fixtures";
import { updateConnection } from "../helpers/api";

function getCustomPlaceholdersUrl(feedId: string, connectionId: string) {
  return `/feeds/${feedId}/discord-channel-connections/${connectionId}?view=custom-placeholders`;
}

async function navigateToCustomPlaceholders(
  page: import("@playwright/test").Page,
  feedId: string,
  connectionId: string,
) {
  await page.goto(getCustomPlaceholdersUrl(feedId, connectionId));
  await expect(
    page.getByRole("heading", { name: "Custom Placeholders" }),
  ).toBeVisible({ timeout: 15000 });
}

async function selectSourcePlaceholder(
  page: import("@playwright/test").Page,
  source: string,
) {
  await page.locator("#source-placeholder-select").first().click();
  await page
    .getByRole("option", { name: source, exact: true })
    .click({ force: true });
}

async function addPlaceholder(
  page: import("@playwright/test").Page,
  options: {
    name: string;
    source?: string;
  },
) {
  await page.getByRole("button", { name: "Add Custom Placeholder" }).click();

  const nameInput = page.getByRole("textbox", { name: /Reference Name/ });
  await nameInput.last().fill(options.name);

  if (options.source) {
    await selectSourcePlaceholder(page, options.source);
  }
}

async function addStepType(
  page: import("@playwright/test").Page,
  stepType: string,
) {
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByRole("menuitem", { name: new RegExp(stepType) }).click();
}

async function deleteDefaultRegexStep(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Delete Step" }).first().click();
}

async function saveChanges(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Save all changes" }).click();
  await expect(
    page.getByText("Successfully updated custom placeholders."),
  ).toBeVisible({ timeout: 15000 });
}

async function expandAccordion(
  page: import("@playwright/test").Page,
  name: string,
) {
  await page
    .getByRole("button", { name: new RegExp(name.replace(/[{}]/g, "\\$&")) })
    .click();
}

test.describe("Custom Placeholders", () => {
  test.describe("Basic CRUD", () => {
    test("can add a custom placeholder with regex step and save", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;
      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      await addPlaceholder(page, { name: "testRegex", source: "title" });

      await page.getByRole("textbox", { name: /Search/ }).fill("test");
      await page.getByRole("textbox", { name: /Replacement/ }).fill("replaced");

      await saveChanges(page);

      await page.reload();
      await expect(page.getByText("{{custom::testRegex}}").first()).toBeVisible(
        { timeout: 10000 },
      );

      await expandAccordion(page, "{{custom::testRegex}}");

      await expect(
        page.getByText("Transformation Step: Regex Replace"),
      ).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("textbox", { name: /Search/ })).toHaveValue(
        "test",
        { timeout: 5000 },
      );
      await expect(
        page.getByRole("textbox", { name: /Replacement/ }),
      ).toHaveValue("replaced", { timeout: 5000 });
    });

    test("can add a custom placeholder with uppercase step", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;
      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      await addPlaceholder(page, { name: "testUpper", source: "title" });

      await addStepType(page, "Uppercase");
      await deleteDefaultRegexStep(page);

      await saveChanges(page);

      await page.reload();
      await expect(page.getByText("{{custom::testUpper}}").first()).toBeVisible(
        { timeout: 10000 },
      );

      await expandAccordion(page, "{{custom::testUpper}}");

      await expect(
        page.getByText("Transformation Step: Uppercase"),
      ).toBeVisible({ timeout: 5000 });
      await expect(
        page.getByText("Transformation Step: Regex Replace"),
      ).not.toBeVisible();
    });

    test("can add a custom placeholder with lowercase step", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;
      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      await addPlaceholder(page, { name: "testLower", source: "title" });

      await addStepType(page, "Lowercase");
      await deleteDefaultRegexStep(page);

      await saveChanges(page);

      await page.reload();
      await expect(page.getByText("{{custom::testLower}}").first()).toBeVisible(
        { timeout: 10000 },
      );

      await expandAccordion(page, "{{custom::testLower}}");

      await expect(
        page.getByText("Transformation Step: Lowercase"),
      ).toBeVisible({ timeout: 5000 });
    });

    test("can add a custom placeholder with URL encode step", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;
      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      await addPlaceholder(page, { name: "testUrl", source: "title" });

      await addStepType(page, "URL Encode");
      await deleteDefaultRegexStep(page);

      await saveChanges(page);

      await page.reload();
      await expect(page.getByText("{{custom::testUrl}}").first()).toBeVisible({
        timeout: 10000,
      });

      await expandAccordion(page, "{{custom::testUrl}}");

      await expect(
        page.getByText("Transformation Step: URL Encode"),
      ).toBeVisible({ timeout: 5000 });
    });

    test("can add a custom placeholder with date format step", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;
      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      await addPlaceholder(page, { name: "testDate", source: "title" });

      await addStepType(page, "Date Format");
      await deleteDefaultRegexStep(page);

      const formatInput = page.getByRole("textbox", { name: "Format" });
      await formatInput.clear();
      await formatInput.fill("YYYY-MM-DD");
      await page
        .getByRole("textbox", { name: "Timezone" })
        .fill("America/New_York");

      await saveChanges(page);

      await page.reload();
      await expect(page.getByText("{{custom::testDate}}").first()).toBeVisible({
        timeout: 10000,
      });

      await expandAccordion(page, "{{custom::testDate}}");

      await expect(
        page.getByText("Transformation Step: Date Format"),
      ).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("textbox", { name: "Format" })).toHaveValue(
        "YYYY-MM-DD",
        { timeout: 5000 },
      );
      await expect(page.getByRole("textbox", { name: "Timezone" })).toHaveValue(
        "America/New_York",
        { timeout: 5000 },
      );
    });

    test("can delete an existing custom placeholder", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;

      await updateConnection(page, feed.id, connection.id, {
        customPlaceholders: [
          {
            id: "cp-del-1",
            referenceName: "toDelete",
            sourcePlaceholder: "title",
            steps: [{ id: "step-1", type: "UPPERCASE" }],
          },
        ],
      });

      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      const accordionButton = page.getByRole("button", {
        name: /custom::toDelete/,
      });
      await expect(accordionButton).toBeVisible({ timeout: 10000 });

      await accordionButton.click();

      const accordionRegion = page.getByRole("region");
      await accordionRegion
        .getByRole("button", { name: "Delete", exact: true })
        .click();

      await expect(page.getByRole("alertdialog")).toBeVisible({
        timeout: 5000,
      });
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Delete" })
        .click();

      await saveChanges(page);

      await expect(accordionButton).not.toBeVisible();

      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Custom Placeholders" }),
      ).toBeVisible({ timeout: 10000 });
      await expect(accordionButton).not.toBeVisible();
    });

    test("can delete a newly added placeholder without confirmation", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;
      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      await page
        .getByRole("button", { name: "Add Custom Placeholder" })
        .click();

      await expect(page.getByText("Unnamed custom placeholder")).toBeVisible({
        timeout: 5000,
      });

      const accordionRegion = page.getByRole("region");
      await accordionRegion.getByRole("button", { name: "Delete" }).click();

      await expect(
        page.getByText("Unnamed custom placeholder"),
      ).not.toBeVisible();
    });
  });

  test.describe("Step Management", () => {
    test("can add multiple steps to a placeholder", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;
      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      await addPlaceholder(page, { name: "multiStep", source: "title" });

      await expect(
        page.getByText("Transformation Step: Regex Replace"),
      ).toBeVisible({ timeout: 5000 });

      await addStepType(page, "Uppercase");

      await expect(
        page.getByText("Transformation Step: Regex Replace"),
      ).toBeVisible();
      await expect(
        page.getByText("Transformation Step: Uppercase"),
      ).toBeVisible();
    });

    test("can delete a step when multiple exist", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;
      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      await addPlaceholder(page, { name: "delStep", source: "title" });

      await addStepType(page, "Uppercase");

      await expect(
        page.getByText("Transformation Step: Regex Replace"),
      ).toBeVisible({ timeout: 5000 });
      await expect(
        page.getByText("Transformation Step: Uppercase"),
      ).toBeVisible();

      await page.getByRole("button", { name: "Delete Step" }).first().click();

      await expect(
        page.getByText("Transformation Step: Uppercase"),
      ).toBeVisible();
      await expect(
        page.getByText("Transformation Step: Regex Replace"),
      ).not.toBeVisible();
    });

    test("cannot delete the last remaining step", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;
      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      await addPlaceholder(page, { name: "lastStep", source: "title" });

      await expect(
        page.getByText("Transformation Step: Regex Replace"),
      ).toBeVisible({ timeout: 5000 });

      await page
        .getByRole("button", { name: "Delete Step" })
        .click({ force: true });

      await expect(
        page.getByText("Transformation Step: Regex Replace"),
      ).toBeVisible();
      await expect(
        page.getByText("At least one transformation step is required"),
      ).toBeVisible({ timeout: 5000 });
    });

    test("can reorder steps with move up/down", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;
      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      await addPlaceholder(page, { name: "reorder", source: "title" });

      await addStepType(page, "Uppercase");

      const stepHeadings = page.locator("text=/Transformation Step:/");
      await expect(stepHeadings).toHaveCount(2, { timeout: 5000 });

      await expect(stepHeadings.nth(0)).toContainText("Regex Replace");
      await expect(stepHeadings.nth(1)).toContainText("Uppercase");

      await page
        .getByRole("button", { name: "Move step down" })
        .first()
        .click();

      await expect(stepHeadings.nth(0)).toContainText("Uppercase");
      await expect(stepHeadings.nth(1)).toContainText("Regex Replace");

      await page.getByRole("textbox", { name: /Search/ }).fill("test");
      await saveChanges(page);

      await page.reload();
      await expect(page.getByText("{{custom::reorder}}").first()).toBeVisible({
        timeout: 10000,
      });

      await expandAccordion(page, "{{custom::reorder}}");

      const reloadedHeadings = page.locator("text=/Transformation Step:/");
      await expect(reloadedHeadings).toHaveCount(2, { timeout: 5000 });
      await expect(reloadedHeadings.nth(0)).toContainText("Uppercase");
      await expect(reloadedHeadings.nth(1)).toContainText("Regex Replace");
    });
  });

  test.describe("Message Builder Integration", () => {
    test("saved custom placeholder appears in message builder insert dialog and resolves in preview", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;

      // Create a custom placeholder with uppercase step via the UI
      await navigateToCustomPlaceholders(page, feed.id, connection.id);
      await addPlaceholder(page, { name: "mytitle", source: "title" });
      await addStepType(page, "Uppercase");
      await deleteDefaultRegexStep(page);
      await saveChanges(page);

      // Navigate to message builder via app navigation
      await page.getByRole("tab", { name: "Message Format" }).click();
      await page
        .getByRole("link", { name: /Check it out|Open Message Builder/i })
        .click();

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

      // Wait for article to load
      await expect(
        page.getByText("Previewing Article", { exact: true }),
      ).toBeVisible({ timeout: 15000 });

      const tree = page.getByRole("tree");

      // Switch to Components V2 format
      await tree.getByRole("treeitem").first().click();
      await page.getByRole("radiogroup").getByText("Components V2").click();

      const switchButton = page.getByRole("button", {
        name: "Switch Format",
      });
      if (await switchButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await switchButton.click();
      }

      await expect(
        tree.getByRole("treeitem").first().getByText("Components V2"),
      ).toBeVisible({ timeout: 10000 });

      // Add Container > Text Display
      await tree.getByText("Components V2", { exact: true }).first().click();
      await page.getByRole("button", { name: /New Component/i }).click();
      await page.getByRole("menuitem", { name: "Add Container" }).click();

      await tree.getByText("Container", { exact: true }).first().click();
      await page.getByRole("button", { name: /New Component/i }).click();
      await page.getByRole("menuitem", { name: "Add Text Display" }).click();

      // Click Text Display to show its properties
      await tree
        .getByRole("treeitem", { name: "Text Display" })
        .first()
        .click();

      // Click "Insert Placeholder" button
      await page.getByRole("button", { name: /Insert Placeholder/i }).click();

      // Search for "custom" in the placeholder dialog
      const placeholderDialog = page.getByRole("dialog");
      await expect(placeholderDialog).toBeVisible({ timeout: 5000 });
      await placeholderDialog
        .getByPlaceholder("Search placeholders...")
        .fill("custom");

      // Verify {{custom::mytitle}} appears
      await expect(placeholderDialog.getByText("custom::mytitle")).toBeVisible({
        timeout: 10000,
      });

      // Click Select on the custom placeholder
      const placeholderItem = placeholderDialog.getByLabel(
        /Insert.*custom::mytitle.*placeholder/i,
      );
      await placeholderItem.getByRole("button", { name: "Select" }).click();

      // Verify the text content field contains the placeholder
      await expect(
        page.getByRole("textbox", { name: "Text Content" }),
      ).toHaveValue("{{custom::mytitle}}", { timeout: 5000 });

      // Wait for preview to load and verify uppercased title in the preview
      const previewLoadingBar = page.getByLabel("Updating message preview");
      await expect(previewLoadingBar).not.toBeVisible({ timeout: 30000 });
      await expect(page.getByText("Failed to load preview.")).not.toBeVisible();

      await expect(
        page.getByRole("paragraph").filter({ hasText: /^TEST ARTICLE 1$/ }),
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("Edge Cases", () => {
    test("unsaved changes bar appears and disappears", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;
      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      await page
        .getByRole("button", { name: "Add Custom Placeholder" })
        .click();

      const nameInput = page.getByRole("textbox", { name: /Reference Name/ });
      await nameInput.fill("testUnsaved");

      await expect(
        page.getByText("You have unsaved changes on this page!"),
      ).toBeVisible({ timeout: 5000 });
      await expect(
        page.getByRole("button", { name: "Save all changes" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Discard all changes" }),
      ).toBeVisible();

      await selectSourcePlaceholder(page, "title");

      await page.getByRole("textbox", { name: /Search/ }).fill("test");

      await saveChanges(page);

      await expect(
        page.getByText("You have unsaved changes on this page!"),
      ).not.toBeVisible({ timeout: 5000 });
      await expect(
        page.getByRole("button", { name: "Save all changes" }),
      ).not.toBeVisible();
    });

    test("can discard changes", async ({ page, testFeedWithConnection }) => {
      const { feed, connection } = testFeedWithConnection;

      await updateConnection(page, feed.id, connection.id, {
        customPlaceholders: [
          {
            id: "cp-discard-1",
            referenceName: "original",
            sourcePlaceholder: "title",
            steps: [{ id: "step-1", type: "UPPERCASE" }],
          },
        ],
      });

      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      const accordionButton = page.getByRole("button", {
        name: /custom::original/,
      });
      await expect(accordionButton).toBeVisible({ timeout: 10000 });

      await accordionButton.click();

      const nameInput = page.getByRole("textbox", { name: /Reference Name/ });
      await nameInput.clear();
      await nameInput.fill("modified");

      await expect(
        page.getByText("You have unsaved changes on this page!"),
      ).toBeVisible({ timeout: 5000 });

      await page.getByRole("button", { name: "Discard all changes" }).click();

      await expect(accordionButton).toBeVisible({ timeout: 5000 });
      await expect(
        page.getByRole("button", { name: /custom::modified/ }),
      ).not.toBeVisible();
      await expect(
        page.getByText("You have unsaved changes on this page!"),
      ).not.toBeVisible();
    });

    test("multiple custom placeholders can be saved", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;
      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      await addPlaceholder(page, { name: "first", source: "title" });
      await page.getByRole("textbox", { name: /Search/ }).fill("a");

      await page
        .getByRole("button", { name: "Add Custom Placeholder" })
        .click();

      const secondRegion = page.getByRole("region", {
        name: /Unnamed custom placeholder/,
      });
      await expect(secondRegion).toBeVisible({ timeout: 5000 });

      await secondRegion
        .getByRole("textbox", { name: /Reference Name/ })
        .fill("second");

      const sourceSelect = secondRegion.locator("#source-placeholder-select");
      await sourceSelect.scrollIntoViewIfNeeded();
      await sourceSelect.fill("title");
      await page
        .getByRole("option", { name: "title", exact: true })
        .click({ force: true });

      await secondRegion.getByRole("textbox", { name: /Search/ }).fill("b");

      await saveChanges(page);

      await page.reload();
      await expect(page.getByText("{{custom::first}}").first()).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("{{custom::second}}").first()).toBeVisible({
        timeout: 10000,
      });
    });

    test("accordion header shows correct display text", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;
      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      await page
        .getByRole("button", { name: "Add Custom Placeholder" })
        .click();

      await expect(
        page.getByText("Unnamed custom placeholder").first(),
      ).toBeVisible({ timeout: 5000 });

      const nameInput = page.getByRole("textbox", { name: /Reference Name/ });
      await nameInput.fill("myName");
      await selectSourcePlaceholder(page, "title");
      await page.getByRole("textbox", { name: /Search/ }).fill("test");

      await saveChanges(page);

      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Custom Placeholders" }),
      ).toBeVisible({ timeout: 10000 });

      await expect(page.getByText("{{custom::myName}}").first()).toBeVisible({
        timeout: 5000,
      });
      await expect(
        page.getByText("Unnamed custom placeholder"),
      ).not.toBeVisible();
    });

    test("can update an existing placeholder reference name", async ({
      page,
      testFeedWithConnection,
    }) => {
      const { feed, connection } = testFeedWithConnection;

      await updateConnection(page, feed.id, connection.id, {
        customPlaceholders: [
          {
            id: "cp-update-1",
            referenceName: "original",
            sourcePlaceholder: "title",
            steps: [{ id: "step-1", type: "UPPERCASE" }],
          },
        ],
      });

      await navigateToCustomPlaceholders(page, feed.id, connection.id);

      const accordionButton = page.getByRole("button", {
        name: /custom::original/,
      });
      await expect(accordionButton).toBeVisible({ timeout: 10000 });

      await accordionButton.click();

      const nameInput = page.getByRole("textbox", { name: /Reference Name/ });
      await nameInput.clear();
      await nameInput.fill("updated");

      await saveChanges(page);

      await page.reload();
      await expect(page.getByText("{{custom::updated}}").first()).toBeVisible({
        timeout: 10000,
      });
      await expect(
        page.getByRole("button", { name: /custom::original/ }),
      ).not.toBeVisible();
    });
  });
});
