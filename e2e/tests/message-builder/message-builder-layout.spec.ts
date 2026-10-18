import { test, expect, type Locator } from "../../fixtures/test-fixtures";

const VIEWPORT = { width: 1440, height: 900 };
const FLUSH_TOLERANCE_PX = 2;

test.describe("Message Builder layout", () => {
  test("panels reach the bottom of the viewport and scroll independently", async ({
    page,
    testFeedWithConnection,
  }) => {
    test.setTimeout(240_000);
    const { feed, connection } = testFeedWithConnection;

    await page.setViewportSize(VIEWPORT);
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

    await expect(page.getByText("Previewing Article", { exact: true })).toBeVisible({
      timeout: 15000,
    });

    const viewportBottom = await page.evaluate(() => document.documentElement.clientHeight);

    const boxOf = async (target: Locator) => {
      const box = await target.boundingBox();
      expect(box, "Expected the locator to have a bounding box").not.toBeNull();
      return box!;
    };
    const bottomOf = async (target: Locator) => {
      const box = await boxOf(target);
      return box.y + box.height;
    };
    const expectFlushWithViewportBottom = async (target: Locator) => {
      const bottom = await bottomOf(target);
      expect(bottom).toBeLessThanOrEqual(viewportBottom + FLUSH_TOLERANCE_PX);
      expect(bottom).toBeGreaterThanOrEqual(viewportBottom - FLUSH_TOLERANCE_PX);
    };
    const expectSameBox = (
      actual: { x: number; y: number; width: number; height: number },
      expected: { x: number; y: number; width: number; height: number },
    ) => {
      expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(FLUSH_TOLERANCE_PX);
      expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(FLUSH_TOLERANCE_PX);
      expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(FLUSH_TOLERANCE_PX);
      expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(FLUSH_TOLERANCE_PX);
    };
    // Scrolls the given panel the way a user would (wheel over it) and proves
    // the panel itself took the scroll.
    const wheelScrollToBottom = async (target: Locator) => {
      const box = await boxOf(target);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, box.height * 2);
      await expect.poll(() => target.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    };

    const componentsPanel = page.locator('[data-tour-target="components-section"]');
    const propertiesPanel = page.locator('[data-tour-target="properties-panel"]');
    const previewPanel = page.locator('[data-tour-target="discord-preview"]');
    const problemsPanel = page.locator('[data-tour-target="problems-section"]');
    const problemsHeader = problemsPanel.getByRole("button", { name: /^Problems/ });

    // With an empty message the columns reach the bottom of the viewport rather
    // than stopping at their content height.
    await expectFlushWithViewportBottom(componentsPanel);
    await expectFlushWithViewportBottom(propertiesPanel);
    await expectFlushWithViewportBottom(problemsPanel);

    // Build a tree taller than the component column so it has to scroll
    const tree = page.getByRole("tree");
    await tree.getByRole("treeitem").first().click();
    await page.getByRole("radiogroup").getByText("Components V2").click();
    const switchFormatButton = page.getByRole("button", { name: "Switch Format" });
    if (await switchFormatButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await switchFormatButton.click();
    }
    await expect(tree.getByRole("treeitem").first().getByText("Components V2")).toBeVisible({
      timeout: 10000,
    });

    async function addComponent(parentLabel: string, menuItemName: string, parentIndex = 0) {
      await tree.getByText(parentLabel, { exact: true }).nth(parentIndex).click();
      await page.getByRole("button", { name: `Add new component under ${parentLabel}` }).click();
      const menuItem = page.getByRole("menuitem", { name: menuItemName });
      await menuItem.click();
      await expect(menuItem).not.toBeVisible();
    }

    // Add components until the tree is taller than its column, so the column has
    // to scroll. Each empty Text Display is also a Problem for the problems
    // checks below.
    const treeColumnOverflows = () =>
      componentsPanel.evaluate((element) => element.scrollHeight > element.clientHeight);

    let containerIndex = 0;
    while (!(await treeColumnOverflows()) && containerIndex < 10) {
      await addComponent("Components V2", "Add Container");
      for (let childIndex = 0; childIndex < 10; childIndex += 1) {
        await addComponent("Container", "Add Text Display", containerIndex);
      }
      containerIndex += 1;
    }

    expect(await treeColumnOverflows()).toBe(true);

    // An overflowing tree stays inside its column: the columns still end at the
    // bottom of the viewport.
    await expectFlushWithViewportBottom(componentsPanel);
    await expectFlushWithViewportBottom(propertiesPanel);
    await expectFlushWithViewportBottom(problemsPanel);

    // Scrolling the component tree leaves the other columns untouched.
    const previewBoxBeforeScroll = await boxOf(previewPanel);
    const propertiesBoxBeforeScroll = await boxOf(propertiesPanel);

    await wheelScrollToBottom(componentsPanel);

    expectSameBox(await boxOf(previewPanel), previewBoxBeforeScroll);
    expectSameBox(await boxOf(propertiesPanel), propertiesBoxBeforeScroll);
    await expectFlushWithViewportBottom(componentsPanel);

    // Collapsed: the accordion header is flush with the bottom of the viewport
    // and the preview fills the space above it.
    await problemsHeader.click();
    await expect(problemsHeader).toHaveAttribute("aria-expanded", "false");
    await expectFlushWithViewportBottom(problemsPanel);
    expect(await bottomOf(previewPanel)).toBeLessThanOrEqual(
      (await boxOf(problemsPanel)).y + FLUSH_TOLERANCE_PX,
    );

    // Expanded: the panel is capped so the preview keeps at least half of the
    // column, and the problem list scrolls inside it.
    await problemsHeader.click();
    await expect(problemsHeader).toHaveAttribute("aria-expanded", "true");

    const expandedProblemsBox = await boxOf(problemsPanel);
    const rightColumnTop = (await boxOf(previewPanel)).y;
    expect(expandedProblemsBox.height).toBeLessThanOrEqual(400 + FLUSH_TOLERANCE_PX);
    expect(expandedProblemsBox.height).toBeLessThanOrEqual(
      (viewportBottom - rightColumnTop) / 2 + FLUSH_TOLERANCE_PX,
    );
    expect((await boxOf(previewPanel)).height).toBeGreaterThanOrEqual(250);

    const previewBoxBeforeProblemsScroll = await boxOf(previewPanel);
    await wheelScrollToBottom(page.locator("#problems-content"));
    expectSameBox(await boxOf(previewPanel), previewBoxBeforeProblemsScroll);
  });
});
