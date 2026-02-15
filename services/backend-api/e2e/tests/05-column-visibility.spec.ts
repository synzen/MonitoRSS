import {
  test,
  expect,
  type Page,
  createAuthenticatedContext,
} from "../fixtures/test-fixtures";
import { createFeed, deleteFeed, enableAllTableColumns } from "../helpers/api";
import { MOCK_RSS_FEED_URL } from "../helpers/constants";
import type { Feed } from "../helpers/types";

const COLUMNS = [
  { id: "computedStatus", label: "Status", defaultVisible: true },
  { id: "url", label: "URL", defaultVisible: true },
  { id: "createdAt", label: "Added On", defaultVisible: true },
  { id: "refreshRateSeconds", label: "Refresh Rate", defaultVisible: false },
  { id: "ownedByUser", label: "Shared with Me", defaultVisible: true },
] as const;

test.describe("Column Visibility", () => {
  let testFeed: Feed;

  test.beforeAll(async ({ browser }) => {
    const context = await createAuthenticatedContext(browser);
    const page = await context.newPage();

    await enableAllTableColumns(page);

    testFeed = await createFeed(page, {
      title: "Column Visibility Test Feed",
      url: `${MOCK_RSS_FEED_URL}?colvis=test`,
    });

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await enableAllTableColumns(page);
  });

  test.afterAll(async ({ browser }) => {
    const context = await createAuthenticatedContext(browser);
    const page = await context.newPage();

    await deleteFeed(page, testFeed?.id).catch(() => {});
    await enableAllTableColumns(page);

    await context.close();
  });

  async function navigateToFeedsPage(page: Page): Promise<void> {
    const timestamp = Date.now();
    await page.goto(`/feeds?_t=${timestamp}`, { waitUntil: "networkidle" });
    await page.waitForSelector("table tbody tr", { timeout: 15000 });
  }

  async function openColumnsMenu(page: Page): Promise<void> {
    const columnsButton = page
      .locator('button[aria-label^="Display table columns"]')
      .first();
    await columnsButton.click();
    const urlMenuItem = page.locator(
      '[role="menuitemcheckbox"]:has-text("URL")',
    );
    await urlMenuItem.waitFor({ state: "visible", timeout: 5000 });
  }

  async function closeColumnsMenu(page: Page): Promise<void> {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }

  async function toggleColumn(page: Page, columnLabel: string): Promise<void> {
    const checkbox = page
      .locator(`[role="menuitemcheckbox"]:has-text("${columnLabel}")`)
      .first();
    await checkbox.waitFor({ state: "visible", timeout: 5000 });
    await checkbox.click({ force: true });
    await page.waitForTimeout(500);
  }

  async function isColumnVisible(
    page: Page,
    columnLabel: string,
  ): Promise<boolean> {
    const header = page
      .locator("table th")
      .filter({ hasText: columnLabel })
      .first();
    return header.isVisible();
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
    await navigateToFeedsPage(page);

    expect(await isColumnVisible(page, "Status")).toBe(true);

    await openColumnsMenu(page);
    await toggleColumn(page, "Status");

    expect(await isColumnVisible(page, "Status")).toBe(false);

    await openColumnsMenu(page);
    await toggleColumn(page, "Status");

    expect(await isColumnVisible(page, "Status")).toBe(true);
  });

  test("URL column can be hidden and shown", async ({ page }) => {
    await navigateToFeedsPage(page);

    expect(await isColumnVisible(page, "URL")).toBe(true);

    await openColumnsMenu(page);
    await toggleColumn(page, "URL");

    expect(await isColumnVisible(page, "URL")).toBe(false);

    await openColumnsMenu(page);
    await toggleColumn(page, "URL");

    expect(await isColumnVisible(page, "URL")).toBe(true);
  });

  test("Added On column can be hidden and shown", async ({ page }) => {
    await navigateToFeedsPage(page);

    expect(await isColumnVisible(page, "Added on")).toBe(true);

    await openColumnsMenu(page);
    await toggleColumn(page, "Added On");

    expect(await isColumnVisible(page, "Added on")).toBe(false);

    await openColumnsMenu(page);
    await toggleColumn(page, "Added On");

    expect(await isColumnVisible(page, "Added on")).toBe(true);
  });

  test("Refresh Rate column can be hidden and shown", async ({ page }) => {
    await navigateToFeedsPage(page);

    expect(await isColumnVisible(page, "Refresh Rate")).toBe(true);

    await openColumnsMenu(page);
    await toggleColumn(page, "Refresh Rate");

    expect(await isColumnVisible(page, "Refresh Rate")).toBe(false);

    await openColumnsMenu(page);
    await toggleColumn(page, "Refresh Rate");

    expect(await isColumnVisible(page, "Refresh Rate")).toBe(true);
  });

  test("Shared with Me column can be hidden and shown", async ({ page }) => {
    await navigateToFeedsPage(page);

    expect(await isColumnVisible(page, "Shared with Me")).toBe(true);

    await openColumnsMenu(page);
    await toggleColumn(page, "Shared with Me");

    expect(await isColumnVisible(page, "Shared with Me")).toBe(false);

    await openColumnsMenu(page);
    await toggleColumn(page, "Shared with Me");

    expect(await isColumnVisible(page, "Shared with Me")).toBe(true);
  });

  test("column visibility persists after page refresh", async ({ page }) => {
    await navigateToFeedsPage(page);

    await openColumnsMenu(page);
    await toggleColumn(page, "URL");
    await closeColumnsMenu(page);

    expect(await isColumnVisible(page, "URL")).toBe(false);

    await openColumnsMenu(page);
    await toggleColumn(page, "Refresh Rate");
    await closeColumnsMenu(page);

    expect(await isColumnVisible(page, "URL")).toBe(false);
    expect(await isColumnVisible(page, "Refresh Rate")).toBe(false);
    expect(await isColumnVisible(page, "Status")).toBe(true);

    await page.reload();
    await page.waitForSelector("table tbody tr", { timeout: 15000 });

    expect(await isColumnVisible(page, "URL")).toBe(false);
    expect(await isColumnVisible(page, "Refresh Rate")).toBe(false);
    expect(await isColumnVisible(page, "Status")).toBe(true);

    await openColumnsMenu(page);
    expect(await isColumnCheckedInMenu(page, "URL")).toBe(false);
    expect(await isColumnCheckedInMenu(page, "Refresh Rate")).toBe(false);
    expect(await isColumnCheckedInMenu(page, "Status")).toBe(true);
    await closeColumnsMenu(page);
  });

  test("cannot hide the last visible column", async ({ page }) => {
    await navigateToFeedsPage(page);

    const columnsToHide = COLUMNS.slice(0, -1);
    for (const column of columnsToHide) {
      await openColumnsMenu(page);
      if (await isColumnCheckedInMenu(page, column.label)) {
        await toggleColumn(page, column.label);
      } else {
        await closeColumnsMenu(page);
      }
    }

    const lastColumn = COLUMNS[COLUMNS.length - 1];
    expect(await isColumnVisible(page, lastColumn.label)).toBe(true);

    await openColumnsMenu(page);
    const lastCheckbox = page
      .locator(`[role="menuitemcheckbox"]:has-text("${lastColumn.label}")`)
      .first();
    const isDisabled = await lastCheckbox.isDisabled();
    const ariaDisabled = await lastCheckbox.getAttribute("aria-disabled");

    expect(isDisabled || ariaDisabled === "true").toBe(true);
    await closeColumnsMenu(page);
  });
});
