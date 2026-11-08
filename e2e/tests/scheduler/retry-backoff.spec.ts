import { test, expect, type Page } from "../../fixtures/test-fixtures";
import {
  createConnection,
  createFeed,
  createWorkspace,
  deleteFeed,
  generateTestId,
  getTestChannelId,
} from "../../helpers/api";
import {
  mockRssFlakyFeedFailUrl,
  mockRssFlakyFeedOkUrl,
  mockRssFlakyFeedRateLimitUrl,
  mockRssFlakyFeedUrl,
} from "../../helpers/constants";
import { backdateRequestsForLookupKey } from "../../helpers/requests-db";
import {
  clearWorkspaceBulkRetryCooldownInDb,
  enableWorkspacesFeatureInDb,
  getUserMongoIdFromDiscordId,
  setVerifiedEmailInDb,
} from "../../helpers/workspaces-db";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";

// The retry backoff (ADR-011) lives on the scheduled fetch path, so this spec
// runs against real scheduler ticks (the stack's schedule emitter fires 60s
// refresh-rate feeds every 30-90s). Wall-clock tiers (24h suspension, 14d
// expiry) are fast-forwarded by backdating the URL's request rows in the
// feed-requests Postgres — the backoff derives all of its state from those
// rows, so that is the closest thing to turning back the clock. Everything
// else — badges, alerts, retry buttons, toasts — is asserted through the UI.

const TICK_TIMEOUT = 240_000;

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(
    page.getByRole("button", { name: "Account settings" }),
  ).toBeVisible({
    timeout: 15000,
  });
}

async function switchToWorkspace(
  page: Page,
  workspaceName: string,
  slug: string,
): Promise<void> {
  await page.getByRole("button", { name: /Switch workspace/ }).click();
  await page.getByRole("menuitemradio", { name: workspaceName }).click();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${slug}/feeds$`));
}

async function openWorkspaceFeeds(
  page: Page,
  workspaceName: string,
  slug: string,
): Promise<void> {
  await page.goto("/feeds");
  await waitForAuthenticatedApp(page);
  await switchToWorkspace(page, workspaceName, slug);
}

async function openFeedLogs(page: Page, feedTitle: string): Promise<void> {
  await page
    .getByRole("link", { name: feedTitle, exact: true })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible();
  await page.getByRole("button", { name: "View request history" }).click();
  await expect(
    page.locator('table[aria-labelledby="request-history-table-title"]'),
  ).toBeVisible();
}

function failingRequestLocator(page: Page, statusCode: number) {
  return page
    .locator('table[aria-labelledby="request-history-table-title"]')
    .getByText(`BAD_STATUS_CODE (${statusCode})`);
}

// Parses the health alert's "next earliest automatic attempt will be on
// DD MMM YYYY, HH:mm:ss" wall-clock text into a timestamp (browser and spec
// share the machine timezone).
function parseAlertTimestamp(text: string): number {
  const match = text.match(
    /(\d{2}) ([A-Za-z]{3}) (\d{4}), (\d{2}):(\d{2}):(\d{2})/,
  );
  if (!match) {
    throw new Error(`No timestamp found in: ${text}`);
  }
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const [, day, month, year, hour, minute, second] = match;
  return new Date(
    Number(year),
    months[month],
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ).getTime();
}

async function retryAllFailedFeeds(page: Page, failedCount: number): Promise<void> {
  const noun = failedCount === 1 ? "feed" : "feeds";
  await page
    .getByRole("button", { name: `Retry all ${failedCount} failed ${noun}` })
    .click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Retry all failed feeds" }).last().click();
}

test.describe("Feed retry backoff (ADR-011)", () => {
  test("a failing feed keeps fetching at its full refresh rate", async ({
    page,
  }) => {
    test.setTimeout(600_000);

    const key = generateTestId();
    const feedTitle = `Backoff Rate ${key}`;
    const healthyTitle = `Backoff Healthy ${key}`;
    const flakyFeedUrl = mockRssFlakyFeedUrl(key);
    let flakyFeedId: string | undefined;
    let healthyFeedId: string | undefined;

    try {
      await page.goto("/feeds");
      await waitForAuthenticatedApp(page);

      const discordUserId = await getDiscordUserIdFromPage(page);
      await enableWorkspacesFeatureInDb(discordUserId);
      // Workspace creation requires a verified email; seed one directly (the
      // SMTP-verified flow is covered by the account specs).
      await setVerifiedEmailInDb(
        discordUserId,
        `retry-backoff-rate-${discordUserId}@example.com`,
      );
      const userId = await getUserMongoIdFromDiscordId(discordUserId);
      const workspaceName = `E2E Backoff Rate ${key}`;
      const slug = `retry-backoff-rate-${key}`;
      const { id: workspaceId } = await createWorkspace(page, {
        name: workspaceName,
        slug,
      });

      // Feeds only get scheduled once they have a delivery connection.
      const flakyFeed = await createFeed(page, {
        url: flakyFeedUrl,
        title: feedTitle,
        workspaceId,
      });
      flakyFeedId = flakyFeed.id;
      const healthyFeed = await createFeed(page, {
        title: healthyTitle,
        workspaceId,
      });
      healthyFeedId = healthyFeed.id;
      await createConnection(page, flakyFeed.id, getTestChannelId());
      await createConnection(page, healthyFeed.id, getTestChannelId());

      await openWorkspaceFeeds(page, workspaceName, slug);
      await expect(
        page
          .getByRole("row", { name: new RegExp(healthyTitle) })
          .getByLabel("Ok", { exact: true }),
      ).toBeVisible();

      await page.request.post(mockRssFlakyFeedFailUrl(key));

      // Without the ADR-011 change a first failure pushed the next attempt 5
      // minutes out and doubling from there; the failing feed must instead be
      // fetched again at (or before) its own refresh rate, so the failing
      // attempts accumulate.
      await expect(async () => {
        await page.reload();
        await expect(
          page.getByRole("link", { name: feedTitle, exact: true }),
        ).toBeVisible({ timeout: 5000 });
        await page
          .getByRole("link", { name: feedTitle, exact: true })
          .first()
          .click();
        await expect(
          page.getByText("Requests are currently failing"),
        ).toBeVisible({ timeout: 5000 });
      }).toPass({ timeout: TICK_TIMEOUT, intervals: [30_000] });

      await page
        .getByRole("button", { name: "View request history" })
        .click();
      await expect(
        page.locator('table[aria-labelledby="request-history-table-title"]'),
      ).toBeVisible();

      // The requests table only refetches on mount, so each observation is a
      // fresh load of the logs view.
      await expect(async () => {
        await page.reload();
        await expect(
          page.locator('table[aria-labelledby="request-history-table-title"]'),
        ).toBeVisible({ timeout: 10_000 });
        expect(await failingRequestLocator(page, 500).count()).toBeGreaterThanOrEqual(3);
      }).toPass({ timeout: 420_000, intervals: [45_000] });

      // The healthy feed is untouched by the backoff: still enabled and Ok.
      await openWorkspaceFeeds(page, workspaceName, slug);
      await expect(
        page
          .getByRole("row", { name: new RegExp(healthyTitle) })
          .getByLabel("Ok", { exact: true }),
      ).toBeVisible();
    } finally {
      if (flakyFeedId) {
        await deleteFeed(page, flakyFeedId).catch(() => {});
      }
      if (healthyFeedId) {
        await deleteFeed(page, healthyFeedId).catch(() => {});
      }
    }
  });

  test("suspension, rate limits, expiry, and retry-all follow the time-based backoff", async ({
    page,
  }) => {
    test.setTimeout(1_500_000);

    const key = generateTestId();
    const feedTitle = `Backoff Lifecycle ${key}`;
    const healthyTitle = `Backoff Unaffected ${key}`;
    const flakyFeedUrl = mockRssFlakyFeedUrl(key);
    let flakyFeedId: string | undefined;
    let healthyFeedId: string | undefined;

    try {
      await page.goto("/feeds");
      await waitForAuthenticatedApp(page);

      const discordUserId = await getDiscordUserIdFromPage(page);
      await enableWorkspacesFeatureInDb(discordUserId);
      await setVerifiedEmailInDb(
        discordUserId,
        `retry-backoff-lifecycle-${discordUserId}@example.com`,
      );
      const userId = await getUserMongoIdFromDiscordId(discordUserId);
      const workspaceName = `E2E Backoff Lifecycle ${key}`;
      const slug = `retry-backoff-lifecycle-${key}`;
      const { id: workspaceId } = await createWorkspace(page, {
        name: workspaceName,
        slug,
      });

      const flakyFeed = await createFeed(page, {
        url: flakyFeedUrl,
        title: feedTitle,
        workspaceId,
      });
      flakyFeedId = flakyFeed.id;
      const healthyFeed = await createFeed(page, {
        title: healthyTitle,
        workspaceId,
      });
      healthyFeedId = healthyFeed.id;
      await createConnection(page, flakyFeed.id, getTestChannelId());
      await createConnection(page, healthyFeed.id, getTestChannelId());

      await openWorkspaceFeeds(page, workspaceName, slug);

      // Establish a failing history: flip the source to 500 and wait for a
      // failing scheduled tick.
      await page.request.post(mockRssFlakyFeedFailUrl(key));
      await expect(async () => {
        await page.reload();
        await expect(
          page.getByRole("link", { name: feedTitle, exact: true }),
        ).toBeVisible({ timeout: 5000 });
        await page
          .getByRole("link", { name: feedTitle, exact: true })
          .first()
          .click();
        await expect(
          page.getByText("Requests are currently failing"),
        ).toBeVisible({ timeout: 5000 });
      }).toPass({ timeout: TICK_TIMEOUT, intervals: [30_000] });

      // Give the URL a guaranteed success row to anchor the backoff clock on:
      // restore the source and retry via the health alert's manual request.
      await page.request.post(mockRssFlakyFeedOkUrl(key));
      await page.getByRole("button", { name: "Retry feed request" }).click();
      await expect(
        page
          .getByRole("alert")
          .getByText("Request to feed was successful."),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByText("Requests are currently failing"),
      ).not.toBeVisible({ timeout: 30_000 });

      // Break the source again and wait for one more failing tick, so the
      // latest attempt is a failure while the last success is in the past.
      await page.request.post(mockRssFlakyFeedFailUrl(key));
      await expect(async () => {
        await page.reload();
        await expect(
          page.getByText("Requests are currently failing"),
        ).toBeVisible({ timeout: 5000 });
      }).toPass({ timeout: TICK_TIMEOUT, intervals: [30_000] });

      // Suspension: backdate the last success 2 days so the URL sits in the
      // 24h-72h tier, where probing is hourly instead of per-tick. The failing
      // attempts must stop accumulating even though ticks keep firing.
      await backdateRequestsForLookupKey({
        lookupKey: flakyFeedUrl,
        days: 2,
        status: "OK",
      });
      // Let the next tick apply the skip, then confirm the failing attempts
      // stop accumulating over a window where active-phase ticks would have
      // added two more.
      await page.waitForTimeout(90_000);
      await openWorkspaceFeeds(page, workspaceName, slug);
      await openFeedLogs(page, feedTitle);
      const suspendedCount = await failingRequestLocator(page, 500).count();
      expect(suspendedCount).toBeGreaterThanOrEqual(1);
      await page.waitForTimeout(150_000);
      await page.reload();
      await expect(
        page.locator('table[aria-labelledby="request-history-table-title"]'),
      ).toBeVisible();
      expect(await failingRequestLocator(page, 500).count()).toBe(
        suspendedCount,
      );

      // Any success resets the backoff. A manual request is the user-facing
      // way to force one: restore the source and retry via the alert button.
      await page.request.post(mockRssFlakyFeedOkUrl(key));
      await page
        .getByRole("button", { name: "Retry feed request" })
        .click();
      await expect(
        page
          .getByRole("alert")
          .getByText("Request to feed was successful."),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByText("Requests are currently failing"),
      ).not.toBeVisible({ timeout: 30_000 });

      // Rate-limit floor: a 429 with a 2h Retry-After must push the next
      // automatic attempt past the header even in the active phase.
      await page.request.post(mockRssFlakyFeedRateLimitUrl(key));
      await expect(async () => {
        await page.reload();
        await expect(
          page.getByText("Requests are currently failing"),
        ).toBeVisible({ timeout: 5000 });
        await page
          .getByRole("button", { name: "View request history" })
          .click();
        await expect(
          failingRequestLocator(page, 429).first(),
        ).toBeVisible({ timeout: 5000 });
      }).toPass({ timeout: TICK_TIMEOUT, intervals: [30_000] });
      const rateLimitRows = await failingRequestLocator(page, 429).count();
      expect(rateLimitRows).toBe(1);

      const alertText = await page
        .getByText(/The next earliest automatic attempt will be on/)
        .textContent();
      const nextAttemptAt = parseAlertTimestamp(alertText ?? "");
      const twoHoursMs = 2 * 3_600_000;
      expect(Math.abs(nextAttemptAt - (Date.now() + twoHoursMs))).toBeLessThan(
        10 * 60_000,
      );

      // Expiry: 14 days of continuous failure stops the probing and disables
      // the feed. Backdate the last success past the expiry threshold.
      await backdateRequestsForLookupKey({
        lookupKey: flakyFeedUrl,
        days: 15,
        status: "OK",
      });
      await openWorkspaceFeeds(page, workspaceName, slug);
      await expect(async () => {
        await page.reload();
        await expect(
          page
            .getByRole("row", { name: new RegExp(feedTitle) })
            .getByLabel("Requires attention"),
        ).toBeVisible({ timeout: 5000 });
      }).toPass({ timeout: 300_000, intervals: [30_000] });

      await page
        .getByRole("link", { name: feedTitle, exact: true })
        .first()
        .click();
      await expect(
        page.getByText(
          "This feed is disabled because its source could not be reached.",
        ),
      ).toBeVisible();
      await expect(
        page.getByText(
          "MonitoRSS could not fetch this feed for 14 days, so it has stopped checking it.",
        ),
      ).toBeVisible();

      // Bulk retry: the forced fetch still hits the 429 source, so the feed
      // stays disabled — but the command is accepted and the cooldown starts.
      await openWorkspaceFeeds(page, workspaceName, slug);
      await retryAllFailedFeeds(page, 1);
      await expect(
        page.getByRole("alert").getByText("Failed feeds queued for retry."),
      ).toBeVisible();
      await page.waitForTimeout(20_000);
      await page.reload();
      await expect(
        page
          .getByRole("row", { name: new RegExp(feedTitle) })
          .getByLabel("Requires attention"),
      ).toBeVisible({ timeout: 15_000 });

      // The 10-minute bulk-retry cooldown rejects an immediate second run;
      // the confirm dialog stays open on the failed attempt, so dismiss it
      // the way a user would (the dialog allows escape).
      await retryAllFailedFeeds(page, 1);
      // exact:true: the failure toast concatenates the same sentence after its
      // title, so a prefix match would resolve to two elements (strict mode).
      await expect(
        page.getByText(
          "Please wait a few minutes before retrying all failed feeds again.",
          { exact: true },
        ),
      ).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("alertdialog")).not.toBeVisible({
        timeout: 10_000,
      });

      // Recovered source + expired cooldown: the retry-all's forced fetch
      // succeeds and revives the feed without any manual re-enabling.
      await page.request.post(mockRssFlakyFeedOkUrl(key));
      await clearWorkspaceBulkRetryCooldownInDb(workspaceId);
      await retryAllFailedFeeds(page, 1);
      await expect(
        page.getByRole("alert").getByText("Failed feeds queued for retry."),
      ).toBeVisible();
      await expect(async () => {
        await page.reload();
        await expect(
          page
            .getByRole("row", { name: new RegExp(feedTitle) })
            .getByLabel("Ok", { exact: true }),
        ).toBeVisible({ timeout: 5000 });
      }).toPass({ timeout: 120_000, intervals: [10_000, 20_000] });
      await expect(
        page.getByRole("button", { name: /Retry all \d+ failed feeds?/ }),
      ).toHaveCount(0);

      // The healthy feed went through all of this untouched.
      await expect(
        page
          .getByRole("row", { name: new RegExp(healthyTitle) })
          .getByLabel("Ok", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: healthyTitle, exact: true })
        .first()
        .click();
      await expect(
        page.getByText("Requests are currently failing"),
      ).not.toBeVisible({ timeout: 15_000 });
    } finally {
      if (flakyFeedId) {
        await deleteFeed(page, flakyFeedId).catch(() => {});
      }
      if (healthyFeedId) {
        await deleteFeed(page, healthyFeedId).catch(() => {});
      }
    }
  });
});
