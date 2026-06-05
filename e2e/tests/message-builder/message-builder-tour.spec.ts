import { test, expect } from "../../fixtures/test-fixtures";

test.describe("Message Builder Tour", () => {
  test("advances past the add-component step when a nested component is selected", async ({
    page,
    testFeedWithConnection,
  }) => {
    test.setTimeout(120_000);
    const { feed, connection } = testFeedWithConnection;

    await page.goto(
      `/feeds/${feed.id}/discord-channel-connections/${connection.id}/message-builder`,
    );

    // Skip the auto welcome dialog so we can set up the tree first.
    const welcomeDialog = page.getByRole("dialog", {
      name: "Welcome to your Message Builder!",
    });
    await expect(welcomeDialog).toBeVisible({ timeout: 15000 });
    await welcomeDialog
      .getByRole("button", {
        name: "Skip the message builder tour and start using the feature",
      })
      .click();
    await expect(welcomeDialog).not.toBeVisible({ timeout: 5000 });

    const tree = page.getByRole("tree");

    async function addComponent(parentText: string, menuItemName: string) {
      await tree.getByText(parentText, { exact: true }).first().click();
      await page
        .getByRole("button", { name: `Add new component under ${parentText}` })
        .click();
      const menuItem = page.getByRole("menuitem", { name: menuItemName });
      await menuItem.click();
      await expect(menuItem).not.toBeVisible();
    }

    // Build a nested tree and select a component that is NOT the first row.
    // The add-component button is rendered (hidden) on every tree row, so a
    // selector that resolves the first match lands on a hidden duplicate when
    // a deeper component is selected.
    await addComponent("Components V1", "Add Embeds List");
    await addComponent("Embeds List", "Add Embed");
    await tree.getByRole("treeitem", { name: "Embed" }).first().click();

    // Re-launch the tour with that nested component selected.
    await page.getByRole("button", { name: "Take Tour" }).click();
    const welcome = page.getByRole("dialog", {
      name: "Welcome to your Message Builder!",
    });
    await expect(welcome).toBeVisible({ timeout: 10000 });
    await welcome
      .getByRole("button", {
        name: "Start the interactive tour to learn message builder features",
      })
      .click();

    const next = page.getByRole("button", { name: /Continue to next step/ });

    // Step 1: Message Components
    await expect(
      page.getByRole("heading", { name: "Message Components" }),
    ).toBeVisible({ timeout: 10000 });

    // Step 1 -> Step 2: Selected Component
    await next.click();
    await expect(
      page.getByRole("heading", { name: "Selected Component" }),
    ).toBeVisible({ timeout: 10000 });

    // Step 2 -> Step 3: Add New Components. Previously the tour stalled here on
    // the dark overlay because it positioned itself against a hidden duplicate
    // of the add-component button (a 0x0 rect), so this tooltip never appeared.
    await next.click();
    await expect(
      page.getByRole("heading", { name: "Add New Components" }),
    ).toBeVisible({ timeout: 10000 });

    // The highlight frame is only drawn once the tour finds a real, visible
    // target (non-zero rect); confirm it landed on the visible add button.
    const overlayTop = page.locator('[data-overlay-pos="top"]');
    await expect(overlayTop).toBeAttached();
    const overlayHeight = await overlayTop.evaluate(
      (el) => parseFloat(getComputedStyle(el).height) || 0,
    );
    expect(overlayHeight).toBeGreaterThan(0);
  });
});
