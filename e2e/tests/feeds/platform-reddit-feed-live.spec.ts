import { test, expect } from "../../fixtures/test-fixtures";
import {
  createConnection,
  deleteFeed,
  getTestChannelId,
} from "../../helpers/api";
import {
  clearSupporterStatusInDb,
  getDiscordUserIdFromPage,
  setSupporterStatusInDb,
} from "../../helpers/paddle-db";

// Live-provider E2E: the private adapters package (built into the image via
// NPM_TOKEN) serves reddit through its declared default provider, fetching
// REAL reddit posts. Skipped entirely unless the run opts in, so the default
// mock-provider suite is untouched. Vendor names and provider env vars are
// never written here — they live only in the private package; this spec is
// provider-agnostic. Live runs export the package's own provider-selection
// and credential env vars (see the monitorss-platform-adapters README):
//
//   E2E_PLATFORM_LIVE=1 \
//   NPM_TOKEN=<github read:packages token> \
//   <the package's provider-selection and credential env vars> \
//   npm run e2e -- tests/feeds/platform-reddit-feed-live.spec.ts

const SUBREDDIT_URL = "https://www.reddit.com/r/askreddit";

// New posts land within minutes on a high-traffic subreddit; scheduler ticks
// fire every 30-90s, so the first real delivery needs several of them.
const DELIVERY_TIMEOUT = 600_000;

async function searchDiscoveryFor(
  page: import("@playwright/test").Page,
  url: string,
) {
  await page.goto("/feeds");
  await expect(
    page.getByRole("heading", { name: "Get news delivered to your Discord" }),
  ).toBeVisible({ timeout: 15000 });

  const searchInput = page.getByRole("textbox", {
    name: "Search popular feeds or paste a URL",
  });
  await searchInput.fill(url);
  await page.getByRole("button", { name: "Go", exact: true }).click();
}

test.describe("Platform reddit feed pipeline (live provider)", () => {
  test.skip(
    process.env.E2E_PLATFORM_LIVE !== "1",
    "Opt-in live run: set E2E_PLATFORM_LIVE=1 with the private package built in (NPM_TOKEN) and the package's provider-selection + credential env vars exported",
  );

  test("adds a real subreddit and delivers each new post exactly once", async ({
    page,
  }, testInfo) => {
    test.setTimeout(900_000);

    const channelId = getTestChannelId();
    if (!channelId) {
      testInfo.skip(true, "No channelId configured");
      return;
    }

    const discordUserId = await getDiscordUserIdFromPage(page);
    await setSupporterStatusInDb(discordUserId);

    try {
      await searchDiscoveryFor(page, SUBREDDIT_URL);

      // Validation resolves through the real provider.
      const addButton = page.getByRole("button", {
        name: "Add r/askreddit feed",
      });
      await expect(addButton).toBeVisible({ timeout: 60000 });
      await addButton.click();

      await expect(
        page.getByRole("heading", { name: /1 feed added!/ }),
      ).toBeVisible({ timeout: 30000 });

      await page.getByRole("button", { name: /View your feeds/ }).click();
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });

      await page
        .getByRole("link", { name: "r/askreddit", exact: true })
        .click();
      const feedId = page.url().match(/\/feeds\/([^/?]+)/)?.[1];
      expect(feedId, `feed id from ${page.url()}`).toBeTruthy();
      await createConnection(page, feedId as string, channelId);

      await page.getByRole("tab", { name: "Logs" }).click();
      const deliveryTable = page.locator(
        'table[aria-labelledby="delivery-history-table-title"]',
      );

      // The first fetch stores articles without delivering them; posts that
      // only appear on later ticks get delivered.
      await expect(async () => {
        await page.reload();
        await expect(
          deliveryTable
            .getByRole("row")
            .filter({ hasText: "Delivered" })
            .first(),
        ).toBeVisible({ timeout: 15000 });
      }).toPass({ timeout: DELIVERY_TIMEOUT });

      // Dedup: canonical <guid>s are stable across fetches, so no title may
      // ever appear in two delivered rows.
      const seenTitles = new Map<string, number>();
      const assertNoDuplicateDeliveries = async () => {
        const rows = deliveryTable
          .getByRole("row")
          .filter({ hasText: "Delivered" });

        for (const row of await rows.all()) {
          const title = (await row.textContent()) ?? "";

          seenTitles.set(title, (seenTitles.get(title) ?? 0) + 1);
        }

        for (const [title, count] of seenTitles) {
          expect(count, `delivered more than once: ${title}`).toBe(1);
        }
      };

      await assertNoDuplicateDeliveries();
      await page.waitForTimeout(240_000);
      await assertNoDuplicateDeliveries();

      await deleteFeed(page, feedId as string);
    } finally {
      await clearSupporterStatusInDb(discordUserId);
    }
  });
});
