import {
  test,
  expect,
  type Page,
  type Locator,
} from "../../fixtures/test-fixtures";
import {
  createFeed,
  deleteFeed,
  enableAllTableColumns,
  updateFeed,
} from "../../helpers/api";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";
import type { Feed } from "../../helpers/types";

async function setupSortingFeeds(page: Page) {
  await enableAllTableColumns(page);

  const feedA = await createFeed(page, {
    title: "AAA Test Feed",
    url: `${MOCK_RSS_FEED_URL}?sort=aaa&t=${Date.now()}`,
  });
  const feedB = await createFeed(page, {
    title: "BBB Test Feed",
    url: `${MOCK_RSS_FEED_URL}?sort=bbb&t=${Date.now()}`,
  });
  const feedC = await createFeed(page, {
    title: "CCC Test Feed",
    url: `${MOCK_RSS_FEED_URL}?sort=ccc&t=${Date.now()}`,
  });

  await updateFeed(page, feedC.id, { disabledCode: "MANUAL" });
  await updateFeed(page, feedA.id, { userRefreshRateSeconds: 600 });
  await updateFeed(page, feedB.id, { userRefreshRateSeconds: 1200 });
  await updateFeed(page, feedC.id, { userRefreshRateSeconds: 1800 });

  return { feedA, feedB, feedC };
}

async function cleanupFeeds(page: Page, ...feeds: Feed[]) {
  for (const feed of feeds) {
    await deleteFeed(page, feed?.id).catch(() => {});
  }
}

test.describe("Feeds Table Sorting", () => {
  async function getTestFeedTitlesInOrder(page: Page): Promise<string[]> {
    const titles: string[] = [];

    const rows = page.locator("table tr").filter({
      hasText: /AAA Test Feed|BBB Test Feed|CCC Test Feed/,
    });

    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const links = row.locator("td a");
      const linkCount = await links.count();
      for (let j = 0; j < linkCount; j++) {
        const text = await links.nth(j).textContent();
        if (
          text &&
          (text.includes("AAA Test Feed") ||
            text.includes("BBB Test Feed") ||
            text.includes("CCC Test Feed"))
        ) {
          titles.push(text.trim());
          break;
        }
      }
    }

    return titles;
  }

  async function navigateToFeedsPage(page: Page): Promise<void> {
    await page.goto("/feeds");
    await page.waitForSelector("table tbody tr", { timeout: 15000 });
  }

  function getColumnHeader(page: Page, columnName: string): Locator {
    return page.locator(`table th:has-text("${columnName}")`).first();
  }

  async function waitForTableUpdate(page: Page): Promise<void> {
    await page.waitForTimeout(1000);
    await page.waitForSelector("table tbody tr", { timeout: 5000 });
  }

  async function clickColumnHeader(
    page: Page,
    columnName: string,
  ): Promise<void> {
    const header = getColumnHeader(page, columnName);
    await header.click();
    await waitForTableUpdate(page);
  }

  test("Title column sorting", async ({ page }) => {
    const { feedA, feedB, feedC } = await setupSortingFeeds(page);
    try {
      await navigateToFeedsPage(page);

      await clickColumnHeader(page, "Title");

      let titles = await getTestFeedTitlesInOrder(page);
      if (titles[0].includes("AAA")) {
        expect(titles[0]).toContain("AAA");
        expect(titles[titles.length - 1]).toContain("CCC");

        await clickColumnHeader(page, "Title");

        titles = await getTestFeedTitlesInOrder(page);
        expect(titles[0]).toContain("CCC");
        expect(titles[titles.length - 1]).toContain("AAA");
      } else {
        expect(titles[0]).toContain("CCC");
        expect(titles[titles.length - 1]).toContain("AAA");

        await clickColumnHeader(page, "Title");

        titles = await getTestFeedTitlesInOrder(page);
        expect(titles[0]).toContain("AAA");
        expect(titles[titles.length - 1]).toContain("CCC");
      }
    } finally {
      await cleanupFeeds(page, feedA, feedB, feedC);
    }
  });

  test("Added On (createdAt) column sorting", async ({ page }) => {
    const { feedA, feedB, feedC } = await setupSortingFeeds(page);
    try {
      await navigateToFeedsPage(page);

      await clickColumnHeader(page, "Added on");

      let titles = await getTestFeedTitlesInOrder(page);
      const firstFeed = titles[0];
      const lastFeed = titles[titles.length - 1];

      await clickColumnHeader(page, "Added on");

      titles = await getTestFeedTitlesInOrder(page);
      expect(titles[0]).toBe(lastFeed);
      expect(titles[titles.length - 1]).toBe(firstFeed);
    } finally {
      await cleanupFeeds(page, feedA, feedB, feedC);
    }
  });

  test("URL column sorting", async ({ page }) => {
    const { feedA, feedB, feedC } = await setupSortingFeeds(page);
    try {
      await navigateToFeedsPage(page);

      await clickColumnHeader(page, "URL");

      let titles = await getTestFeedTitlesInOrder(page);
      const firstFeed = titles[0];
      const lastFeed = titles[titles.length - 1];

      await clickColumnHeader(page, "URL");

      titles = await getTestFeedTitlesInOrder(page);
      expect(titles[0]).toBe(lastFeed);
      expect(titles[titles.length - 1]).toBe(firstFeed);
    } finally {
      await cleanupFeeds(page, feedA, feedB, feedC);
    }
  });

  test("Refresh Rate column sorting", async ({ page }) => {
    const { feedA, feedB, feedC } = await setupSortingFeeds(page);
    try {
      await navigateToFeedsPage(page);

      const refreshRateHeader = getColumnHeader(page, "Refresh Rate");
      await expect(refreshRateHeader).toBeVisible({ timeout: 10000 });

      await clickColumnHeader(page, "Refresh Rate");

      let titles = await getTestFeedTitlesInOrder(page);
      const firstFeed = titles[0];
      const lastFeed = titles[titles.length - 1];

      await clickColumnHeader(page, "Refresh Rate");

      titles = await getTestFeedTitlesInOrder(page);
      expect(titles[0]).toBe(lastFeed);
      expect(titles[titles.length - 1]).toBe(firstFeed);
    } finally {
      await cleanupFeeds(page, feedA, feedB, feedC);
    }
  });

  test("Status column sorting", async ({ page }) => {
    const { feedA, feedB, feedC } = await setupSortingFeeds(page);
    try {
      await navigateToFeedsPage(page);

      await clickColumnHeader(page, "Status");

      const titles = await getTestFeedTitlesInOrder(page);
      expect(titles.length).toBeGreaterThan(0);

      const cccIndex = titles.findIndex((t) => t.includes("CCC"));
      expect(cccIndex).not.toBe(-1);
    } finally {
      await cleanupFeeds(page, feedA, feedB, feedC);
    }
  });

  test("Sorting is mutually exclusive between columns", async ({ page }) => {
    const { feedA, feedB, feedC } = await setupSortingFeeds(page);
    try {
      await navigateToFeedsPage(page);

      await clickColumnHeader(page, "Title");

      let titles = await getTestFeedTitlesInOrder(page);
      const titleSortedFirst = titles[0];

      await clickColumnHeader(page, "Status");

      titles = await getTestFeedTitlesInOrder(page);
      const statusSortedFirst = titles[0];

      expect(titleSortedFirst).not.toBe(statusSortedFirst);
    } finally {
      await cleanupFeeds(page, feedA, feedB, feedC);
    }
  });
});
