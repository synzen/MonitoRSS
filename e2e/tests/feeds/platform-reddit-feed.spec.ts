import { test, expect } from "../../fixtures/test-fixtures";
import { createConnection, deleteFeed, getTestChannelId } from "../../helpers/api";
import { vendorMockExtendUrl } from "../../helpers/constants";
import {
  clearSupporterStatusInDb,
  getDiscordUserIdFromPage,
  setSupporterStatusInDb,
} from "../../helpers/paddle-db";

// Platform-source provider feeds (Reddit through the private package's
// reddit adapter): the user pastes a plain destination URL, feed-requests
// routes it through the package's matcher to the adapter, which is pointed at
// the package's own vendor doubles
// (@synzen/platform-adapters/mock-vendor, mounted by scripts/vendor-mock.ts)
// via PLATFORM_SOURCE_PROVIDER_BASE_URL in docker-compose.e2e.yml, and the
// rest of the pipeline treats it like any other feed. No Reddit credential is
// needed. Vendor API shapes live in the private package — this spec only
// drives its control hooks.
//
// Opt-in (E2E_PLATFORM=1): these specs exercise the platform layer, which
// exists only when the private package is installed (NPM_TOKEN build). Public
// CI runs must not depend on it, so the specs skip unless explicitly opted in.

let subredditCounter = 0;

// A unique subreddit per test so parallel workers and repeated fetches never
// collide on feed URLs or feed-requests request rows. The adapter
// renders the channel title "Reddit r/<name> posts", so the feed title is
// predictable for assertions.
function uniquePlatformSubreddit(): { name: string; url: string; title: string } {
  const name = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${subredditCounter++}`;
  return {
    name,
    url: `https://www.reddit.com/r/${name}`,
    title: `Reddit r/${name} posts`,
  };
}

// The stack's schedule emitter fires 1-minute refresh-rate feeds every 30-90s
// (see retry-backoff.spec.ts), so delivery waits on real scheduler ticks.
const TICK_TIMEOUT = 240_000;

async function searchDiscoveryFor(page: import("@playwright/test").Page, url: string) {
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

test.describe("Platform reddit feed pipeline", () => {
  test("adds a subreddit feed without a Reddit credential and delivers the post once", async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      process.env.E2E_PLATFORM !== "1",
      "Opt-in platform run: set E2E_PLATFORM=1 with the private package installed (NPM_TOKEN build)",
    );
    test.setTimeout(600_000);

    const channelId = getTestChannelId();
    if (!channelId) {
      testInfo.skip(true, "No channelId configured");
      return;
    }

    const { name, url, title } = uniquePlatformSubreddit();
    const articleTitle = `${name} post two`;

    // A non-supporter's article daily limit is 0, so nothing ever delivers;
    // grant supporter status before the feed is created and clean up after.
    const discordUserId = await getDiscordUserIdFromPage(page);
    await setSupporterStatusInDb(discordUserId);

    try {
      await searchDiscoveryFor(page, url);

      // Validation resolves through the provider.
      const addButton = page.getByRole("button", { name: `Add ${title} feed` });
      await expect(addButton).toBeVisible({ timeout: 30000 });
      await addButton.click();

      await expect(
        page.getByRole("heading", { name: /1 feed added!/ }),
      ).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: /View your feeds/ }).click();
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });

      // Fixture setup via API: the connection must exist before the first
      // scheduled tick, or the article gets recorded as seen with nowhere to go.
      await page.getByRole("link", { name: title, exact: true }).click();
      const feedId = page.url().match(/\/feeds\/([^/?]+)/)?.[1];
      expect(feedId, `feed id from ${page.url()}`).toBeTruthy();
      await createConnection(page, feedId as string, channelId);

      await page.getByRole("tab", { name: "Logs" }).click();
      const deliveryTable = page.locator(
        'table[aria-labelledby="delivery-history-table-title"]',
      );

      // The pipeline's FIRST fetch of a feed stores its articles without
      // delivering them (getArticlesToDeliver's first-run behavior), so
      // delivering anything requires a post that appears AFTER that first
      // fetch. Wait past the first scheduler tick (the emitter fires 1-minute
      // feeds every 30-90s), then flip the vendor double to also serve a
      // second post with its own canonical id.
      await page.waitForTimeout(120_000);
      await page.request.post(vendorMockExtendUrl("subreddit", name));

      // The new post is delivered to the mocked Discord channel, surfaced
      // through the feed's delivery history. The delivery-history table
      // fetches once on mount, so poll with reloads until the delivered row
      // renders.
      await expect(async () => {
        await page.reload();
        await expect(
          deliveryTable
            .getByRole("row")
            .filter({ hasText: articleTitle })
            .filter({ hasText: "Delivered" }),
        ).toBeVisible({ timeout: 15000 });
      }).toPass({ timeout: TICK_TIMEOUT });

      // Two more scheduler ticks must not re-deliver the same post: dedup keys
      // on the provider's canonical <guid>, which stays stable across fetches.
      // The first post is never delivered at all (stored by the first run).
      // The double's extend adds TWO posts (a gallery and a video), so this
      // feed's delivered rows are exactly those two, each once.
      await page.waitForTimeout(240_000);
      await page.reload();
      await expect(
        deliveryTable.getByRole("row").filter({ hasText: articleTitle }),
      ).toHaveCount(1);
      await expect(
        deliveryTable
          .getByRole("row")
          .filter({ hasText: "Delivered" })
          .filter({ hasText: name }),
      ).toHaveCount(2);

      await deleteFeed(page, feedId as string);
    } finally {
      await clearSupporterStatusInDb(discordUserId);
    }
  });

  test("a non-existent subreddit surfaces the not-found validation error", async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      process.env.E2E_PLATFORM !== "1",
      "Opt-in platform run: set E2E_PLATFORM=1 with the private package installed (NPM_TOKEN build)",
    );
    test.setTimeout(60000);

    const { url } = uniquePlatformSubreddit();
    const missingUrl = url.replace("/r/e2e", "/r/missing-e2e");

    await searchDiscoveryFor(page, missingUrl);

    // The provider 404s -> BAD_STATUS_CODE(404) row -> FEED_NOT_FOUND through
    // the existing validation error path.
    await expect(page.getByText("Failed to validate feed")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByText(/Feed does not exist or is not accessible/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Add .+ feed$/i }),
    ).toHaveCount(0);
  });
});
