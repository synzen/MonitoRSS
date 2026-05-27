import { test, expect, type Page } from "../fixtures/test-fixtures";
import { createFeed, deleteFeed } from "../helpers/api";
import { MOCK_RSS_FEED_URL } from "../helpers/constants";

const COLUMNS = [
  { id: "computedStatus", label: "Status", defaultVisible: true },
  { id: "url", label: "URL", defaultVisible: true },
  { id: "createdAt", label: "Added On", defaultVisible: true },
  { id: "refreshRateSeconds", label: "Refresh Rate", defaultVisible: false },
  { id: "ownedByUser", label: "Shared with Me", defaultVisible: true },
] as const;

test.describe("Column Visibility", () => {
  async function setupColumnTest(page: Page) {
    const feed = await createFeed(page, {
      title: "Column Visibility Test Feed",
      url: `${MOCK_RSS_FEED_URL}?colvis=test&t=${Date.now()}`,
    });
    return feed;
  }

  async function navigateToFeedsPage(page: Page): Promise<void> {
    const timestamp = Date.now();
    await page.goto(`/feeds?_t=${timestamp}`, { waitUntil: "networkidle" });
    await page.waitForSelector("table tbody tr", { timeout: 15000 });
    await ensureAllColumnsVisibleViaMenu(page);
  }

  async function ensureAllColumnsVisibleViaMenu(page: Page): Promise<void> {
    await openColumnsMenu(page);
    for (const column of COLUMNS) {
      if (!(await isColumnCheckedInMenu(page, column.label))) {
        const checkbox = page
          .locator(
            `[role="menuitemcheckbox"]:has-text("${column.label}")`,
          )
          .first();
        await checkbox.click();
        await page.waitForTimeout(300);
      }
    }
    await closeColumnsMenu(page);
  }

  async function openColumnsMenu(page: Page): Promise<void> {
    const columnsButton = page
      .locator('button[aria-label^="Display table columns"]')
      .first();
    await columnsButton.click();
    const statusMenuItem = page.locator(
      '[role="menuitemcheckbox"]:has-text("Status")',
    );
    await statusMenuItem.waitFor({ state: "visible", timeout: 10000 });
  }

  async function closeColumnsMenu(page: Page): Promise<void> {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }

  async function toggleColumn(page: Page, columnLabel: string): Promise<void> {
    const checkbox = page
      .locator(`[role="menuitemcheckbox"]:has-text("${columnLabel}")`)
      .first();
    await checkbox.waitFor({ state: "visible", timeout: 10000 });
    await checkbox.click({ force: true });
    await page.waitForTimeout(500);
  }

  function columnHeader(page: Page, columnLabel: string) {
    return page.locator("table th").filter({ hasText: columnLabel }).first();
  }

  async function expectColumnVisible(page: Page, columnLabel: string) {
    await expect(columnHeader(page, columnLabel)).toBeVisible({
      timeout: 15000,
    });
  }

  async function expectColumnHidden(page: Page, columnLabel: string) {
    await expect(columnHeader(page, columnLabel)).not.toBeVisible();
  }

  async function isColumnCheckedInMenu(
    page: Page,
    columnLabel: string,
  ): Promise<boolean> {
    const checkbox = page
      .locator(`[role="menuitemcheckbox"]:has-text("${columnLabel}")`)
      .first();
    const ariaChecked = await checkbox.getAttribute("aria-checked");
    return ariaChecked === "true";
  }

  test("Status column can be hidden and shown", async ({ page }) => {
    const feed = await setupColumnTest(page);
    try {
      await navigateToFeedsPage(page);

      await expectColumnVisible(page, "Status");

      await openColumnsMenu(page);
      await toggleColumn(page, "Status");

      await expectColumnHidden(page, "Status");

      await openColumnsMenu(page);
      await toggleColumn(page, "Status");

      await expectColumnVisible(page, "Status");
    } finally {
      await deleteFeed(page, feed.id).catch(() => {});
    }
  });

  test("URL column can be hidden and shown", async ({ page }) => {
    const feed = await setupColumnTest(page);
    try {
      await navigateToFeedsPage(page);

      await expectColumnVisible(page, "URL");

      await openColumnsMenu(page);
      await toggleColumn(page, "URL");

      await expectColumnHidden(page, "URL");

      await openColumnsMenu(page);
      await toggleColumn(page, "URL");

      await expectColumnVisible(page, "URL");
    } finally {
      await deleteFeed(page, feed.id).catch(() => {});
    }
  });

  test("Added On column can be hidden and shown", async ({ page }) => {
    const feed = await setupColumnTest(page);
    try {
      await navigateToFeedsPage(page);

      await expectColumnVisible(page, "Added on");

      await openColumnsMenu(page);
      await toggleColumn(page, "Added On");

      await expectColumnHidden(page, "Added on");

      await openColumnsMenu(page);
      await toggleColumn(page, "Added On");

      await expectColumnVisible(page, "Added on");
    } finally {
      await deleteFeed(page, feed.id).catch(() => {});
    }
  });

  test("Refresh Rate column can be hidden and shown", async ({ page }) => {
    const feed = await setupColumnTest(page);
    try {
      await navigateToFeedsPage(page);

      await expectColumnVisible(page, "Refresh Rate");

      await openColumnsMenu(page);
      await toggleColumn(page, "Refresh Rate");

      await expectColumnHidden(page, "Refresh Rate");

      await openColumnsMenu(page);
      await toggleColumn(page, "Refresh Rate");

      await expectColumnVisible(page, "Refresh Rate");
    } finally {
      await deleteFeed(page, feed.id).catch(() => {});
    }
  });

  test("Shared with Me column can be hidden and shown", async ({ page }) => {
    const feed = await setupColumnTest(page);
    try {
      await navigateToFeedsPage(page);

      await expectColumnVisible(page, "Shared with Me");

      await openColumnsMenu(page);
      await toggleColumn(page, "Shared with Me");

      await expectColumnHidden(page, "Shared with Me");

      await openColumnsMenu(page);
      await toggleColumn(page, "Shared with Me");

      await expectColumnVisible(page, "Shared with Me");
    } finally {
      await deleteFeed(page, feed.id).catch(() => {});
    }
  });

  test("column visibility persists after page refresh", async ({ page }) => {
    const feed = await setupColumnTest(page);
    try {
      await navigateToFeedsPage(page);

      await openColumnsMenu(page);
      await toggleColumn(page, "URL");
      await closeColumnsMenu(page);

      await expectColumnHidden(page, "URL");

      await openColumnsMenu(page);
      await toggleColumn(page, "Refresh Rate");
      await closeColumnsMenu(page);

      await expectColumnHidden(page, "URL");
      await expectColumnHidden(page, "Refresh Rate");
      await expectColumnVisible(page, "Status");

      await page.reload();
      await page.waitForSelector("table tbody tr", { timeout: 15000 });

      await expectColumnHidden(page, "URL");
      await expectColumnHidden(page, "Refresh Rate");
      await expectColumnVisible(page, "Status");

      await openColumnsMenu(page);
      expect(await isColumnCheckedInMenu(page, "URL")).toBe(false);
      expect(await isColumnCheckedInMenu(page, "Refresh Rate")).toBe(false);
      expect(await isColumnCheckedInMenu(page, "Status")).toBe(true);
      await closeColumnsMenu(page);
    } finally {
      await deleteFeed(page, feed.id).catch(() => {});
    }
  });

  test("cannot hide the last visible column", async ({ page }) => {
    const feed = await setupColumnTest(page);
    try {
      await navigateToFeedsPage(page);

      await openColumnsMenu(page);

      const columnsToHide = COLUMNS.slice(0, -1);
      for (const column of columnsToHide) {
        if (await isColumnCheckedInMenu(page, column.label)) {
          const checkbox = page
            .locator(
              `[role="menuitemcheckbox"]:has-text("${column.label}")`,
            )
            .first();
          await checkbox.click();
          await page.waitForTimeout(300);
        }
      }

      const lastColumn = COLUMNS[COLUMNS.length - 1];
      const lastCheckbox = page
        .locator(`[role="menuitemcheckbox"]:has-text("${lastColumn.label}")`)
        .first();
      await expect(lastCheckbox).toBeDisabled({ timeout: 10000 });
      await closeColumnsMenu(page);

      await expectColumnVisible(page, lastColumn.label);
    } finally {
      await deleteFeed(page, feed.id).catch(() => {});
    }
  });
});
