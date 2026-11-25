import { test, expect, createContextForDiscordUser } from "../../fixtures/test-fixtures";
import { createConnection, deleteFeed, getTestChannelId } from "../../helpers/api";
import {
  VENDOR_MOCK_STATS_URL,
  vendorMockExtendUrl,
} from "../../helpers/constants";
import {
  clearSupporterStatusInDb,
  getDiscordUserIdFromPage,
  setSupporterStatusInDb,
} from "../../helpers/paddle-db";

// Platform-source provider feeds (Twitter/X through the private package's
// default twitter adapter): the user pastes a
// plain profile URL, feed-requests routes it through the package's matcher to
// the adapter, which is pointed at the package's own vendor doubles
// (@synzen/platform-adapters/mock-vendor, mounted by scripts/vendor-mock.ts)
// via PLATFORM_SOURCE_PROVIDER_BASE_URL in docker-compose.e2e.yml, and the
// rest of the pipeline treats it like any other feed. The key is a dummy
// KEY:SECRET pair: the doubles never authenticate. Vendor API shapes live in
// the private package — this spec only drives its control hooks.
//
// Opt-in (E2E_PLATFORM=1): these specs exercise the platform layer, which
// exists only when the private package is installed (NPM_TOKEN build). Public
// CI runs must not depend on it, so the specs skip unless explicitly opted in.

// The stats the package's mock-vendor exposes for dedup and GC-release
// assertions.
interface VendorStats {
  feedsCreated: number;
  creationsByHandle: Record<string, number>;
  fetchesByFeedId: Record<string, number>;
  deletionsByHandle: Record<string, number>;
  firstFeedIdByHandle: Record<string, string>;
}

let handleCounter = 0;

// A unique handle per test (X caps handles at 15 word characters) so parallel
// workers and repeated fetches never collide on feed URLs or feed-requests
// request rows. The adapter renders the channel title
// "X @<handle> posts", so the feed title is predictable for assertions.
function uniquePlatformHandle(): { handle: string; url: string; title: string } {
  const handle = `e2e${Date.now().toString(36).slice(-6)}${Math.random()
    .toString(36)
    .slice(2, 5)}${handleCounter++}`;
  return {
    handle,
    url: `https://x.com/${handle}`,
    title: `X @${handle} posts`,
  };
}

// An 18-digit Discord-style id for the second actor of the dedup proof (the
// backend validates Discord ids as numeric). Layout mirrors
// test-fixtures' generateUniqueUserId so parallel workers never collide.
let secondUserCounter = 0;
function uniqueSecondUserId(): string {
  return String(
    910000000000000000n +
      BigInt(Date.now() % 1_000_000_000) * 1000n +
      BigInt(++secondUserCounter),
  );
}

async function readVendorStats(
  page: import("@playwright/test").Page,
): Promise<VendorStats> {
  const res = await page.request.get(VENDOR_MOCK_STATS_URL);
  return (await res.json()) as VendorStats;
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

test.describe("Platform twitter feed pipeline", () => {
  test("adds an x.com profile feed without any provider key and delivers the tweet once", async ({
    page,
    browser,
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

    const { handle, url, title } = uniquePlatformHandle();
    const articleTitle = `@${handle} tweet two`;

    // A non-supporter's article daily limit is 0, so nothing ever delivers;
    // grant supporter status before the feed is created and clean up after.
    const discordUserId = await getDiscordUserIdFromPage(page);
    await setSupporterStatusInDb(discordUserId);

    // Baseline before either feed touches the vendor: the dedup assertion
    // reads the DELTA for this handle, so concurrent specs' creations on other
    // handles cannot interfere.
    const statsBefore = await readVendorStats(page);

    // The second actor of the dedup proof adds the same profile via API
    // (setup only); a session cookie for any fabricated Discord id is enough.
    const secondUserId = uniqueSecondUserId();
    const secondContext = await createContextForDiscordUser(
      browser,
      testInfo,
      secondUserId,
    );

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
      // delivering anything requires a tweet that appears AFTER that first
      // fetch. Wait past the first scheduler tick (the emitter fires 1-minute
      // feeds every 30-90s), then flip the vendor double to also serve a
      // second tweet with its own canonical id.
      await page.waitForTimeout(120_000);
      await page.request.post(vendorMockExtendUrl("twitter", handle));

      // The second user's feed is created while the delivery wait runs, so its
      // first scheduled fetch overlaps this window.
      const secondFeedRes = await secondContext.request.post("/api/v1/user-feeds", {
        data: { url, title: `${title} (second user)` },
      });
      expect(
        secondFeedRes.ok(),
        `second user's feed creation: ${secondFeedRes.status()}`,
      ).toBe(true);
      const secondFeedData = (await secondFeedRes.json()) as {
        result: { id: string };
      };
      const secondFeedId = secondFeedData.result.id;

      // The new tweet is delivered to the mocked Discord channel, surfaced
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

      // Both users' feeds must have fetched the SAME remote vendor feed
      // (the handle's first create) before the creation count is meaningful.
      const vendorFeedId = (await readVendorStats(page))
        .firstFeedIdByHandle[handle]!;
      expect(vendorFeedId).toBeTruthy();
      await expect(async () => {
        const stats = await readVendorStats(page);
        expect(stats.fetchesByFeedId[vendorFeedId] ?? 0).toBeGreaterThanOrEqual(2);
      }).toPass({ timeout: TICK_TIMEOUT });

      // THE DEDUP GUARANTEE: two users adding the same x.com profile must
      // create exactly ONE feed on the vendor. The adapter remembers the
      // remote feed id in feed-requests' durable state store, so every later
      // fetch — from either user's feed — retrieves instead of creates.
      // Assertion via the vendor double's stats, not the UI: remote vendor
      // creations have no rendered surface anywhere in MonitoRSS.
      const statsAfter = await readVendorStats(page);
      expect(
        (statsAfter.creationsByHandle[handle] ?? 0) -
          (statsBefore.creationsByHandle[handle] ?? 0),
      ).toBe(1);

      // Two more scheduler ticks must not re-deliver the same tweet: dedup
      // keys on the provider's canonical <guid>, which stays stable across
      // fetches. The first tweet is never delivered at all (stored by the
      // first run).
      await page.waitForTimeout(240_000);
      await page.reload();
      await expect(
        deliveryTable.getByRole("row").filter({ hasText: articleTitle }),
      ).toHaveCount(1);
      await expect(
        deliveryTable.getByRole("row").filter({ hasText: "Delivered" }),
      ).toHaveCount(1);

      await deleteFeed(page, feedId as string);
      await secondContext.request.delete(`/api/v1/user-feeds/${secondFeedId}`);
    } finally {
      await secondContext.close();
      await clearSupporterStatusInDb(discordUserId);
    }
  });

  test("a non-existent x.com profile surfaces the not-found validation error", async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      process.env.E2E_PLATFORM !== "1",
      "Opt-in platform run: set E2E_PLATFORM=1 with the private package installed (NPM_TOKEN build)",
    );
    test.setTimeout(60000);

    // The missing handle must stay within X's 15-character cap so the
    // package's matcher still classifies the URL as a platform identity —
    // a longer handle would fall to the normal-fetch path and 404 there
    // instead, passing for the wrong reason.
    const missingUrl = `https://x.com/missing${Date.now()
      .toString(36)
      .slice(-6)}${handleCounter++}`;

    await searchDiscoveryFor(page, missingUrl);

    // The vendor double 404s the create -> BAD_STATUS_CODE(404) row ->
    // FEED_NOT_FOUND through the existing validation error path.
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

  test("deleting the feed releases the vendor feed on the next GC sweep", async ({
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

    const { handle, url, title } = uniquePlatformHandle();
    const discordUserId = await getDiscordUserIdFromPage(page);
    await setSupporterStatusInDb(discordUserId);

    const statsBefore = await readVendorStats(page);

    try {
      await searchDiscoveryFor(page, url);
      const addButton = page.getByRole("button", { name: /Add .+ feed$/ });
      await expect(addButton).toBeVisible({ timeout: 30000 });
      await addButton.click();
      await expect(
        page.getByRole("heading", { name: /1 feed added!/ }),
      ).toBeVisible({ timeout: 10000 });
      await page.getByRole("button", { name: /View your feeds/ }).click();
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });

      // The sweep's active-URL set counts only feeds with an enabled Discord
      // connection, so the vendor key survives only once the connection
      // exists. A sweep firing in the seconds between feed-add and connection
      // would release the key early and self-heal through the adapter's
      // 404-recreate; the assertion below is indifferent to that ordering.
      await page.getByRole("link", { name: title, exact: true }).click();
      const feedId = page.url().match(/\/feeds\/([^/?]+)/)?.[1];
      expect(feedId, `feed id from ${page.url()}`).toBeTruthy();
      await createConnection(page, feedId as string, channelId);

      await deleteFeed(page, feedId as string);

      // The emitter sweeps on BACKEND_API_MAINTENANCE_INTERVAL_MS (5s in the
      // e2e stack) and the release then drains off the 5-second pacing queue.
      // The vendor side has no rendered surface anywhere in MonitoRSS, so
      // like the dedup assertion this reads the vendor double's stats.
      await expect(async () => {
        const stats = await readVendorStats(page);
        expect(
          (stats.deletionsByHandle[handle] ?? 0) -
            (statsBefore.deletionsByHandle[handle] ?? 0),
        ).toBeGreaterThanOrEqual(1);
      }).toPass({ timeout: 120_000 });
    } finally {
      await clearSupporterStatusInDb(discordUserId);
    }
  });
});
