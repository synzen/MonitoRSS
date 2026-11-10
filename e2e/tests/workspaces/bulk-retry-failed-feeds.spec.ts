import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  enableWorkspacesFeatureInDb,
  getUserMongoIdFromDiscordId,
  seedWorkspaceFeedsInDb,
  seedWorkspaceWithMembershipsInDb,
} from "../../helpers/workspaces-db";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(
    page.getByRole("button", { name: "Account settings" }),
  ).toBeVisible({
    timeout: 15000,
  });
}

// Retry-all no longer moves feeds into a recovery limbo (ADR-011): the command
// forces a fresh fetch per URL, and a feed revives the moment that fetch
// succeeds. The table only re-renders on a refetch, so revival is observed by
// reloading until the rendered badges flip.
async function expectFeedsRevived(page: Page, count: number): Promise<void> {
  await expect(async () => {
    await page.reload();
    await waitForAuthenticatedApp(page);
    await expect(page.getByLabel("Ok")).toHaveCount(count, {
      timeout: 5000,
    });
  }).toPass({ timeout: 90_000, intervals: [10_000, 20_000] });
}

test.describe("Bulk retry failed workspace feeds", () => {
  test("queues every eligible failed feed and revives the ones whose source recovered", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    const userId = await getUserMongoIdFromDiscordId(discordUserId);
    const workspaceName = `E2E Bulk Retry ${Date.now()}`;
    const { workspaceId, slug } = await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId: userId,
      selfRole: "owner",
    });

    // The seeded feeds point at the healthy mock RSS source, so their forced
    // retry fetches succeed and they must come back enabled.
    await seedWorkspaceFeedsInDb({
      workspaceId,
      userId,
      discordUserId,
      feeds: [
        ...Array.from({ length: 21 }, (_, index) => ({
          title: `Retry eligible ${index + 1}`,
          url: `${MOCK_RSS_FEED_URL}?bulk-retry=${index}-${Date.now()}`,
          disabledCode: "FAILED_REQUESTS",
          healthStatus: "FAILED",
        })),
        {
          title: "Not eligible",
          url: `${MOCK_RSS_FEED_URL}?bulk-retry=excluded-${Date.now()}`,
          disabledCode: "EXCEEDED_FEED_LIMIT",
          healthStatus: "FAILED",
        },
      ],
    });

    await page.reload();
    await waitForAuthenticatedApp(page);
    await page.getByRole("button", { name: /Switch workspace/ }).click();
    await page.getByRole("menuitemradio", { name: workspaceName }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${slug}/feeds$`));

    // Before the bulk action the seeded feeds are terminally failed: the
    // requires-attention alert (with the retry action) and the Requires
    // attention status are both rendered.
    const retryAllButton = page.getByRole("button", {
      name: "Retry all 21 failed feeds",
    });
    await expect(retryAllButton).toBeVisible();
    await expect(page.getByLabel("Requires attention").first()).toBeVisible();

    await retryAllButton.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Retry 21 failed feeds?");
    await expect(dialog).toContainText("Requests will run in the background");
    await page
      .getByRole("button", { name: "Retry all failed feeds" })
      .last()
      .click();

    // The command queues the fetches and surfaces the success alert; the
    // filter change is user-initiated via the alert's link, never auto-applied.
    await expect(
      page.getByRole("alert").getByText("Failed feeds queued for retry."),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Feeds whose source has recovered will resume delivery automatically.",
      ),
    ).toBeVisible();

    // Eligible feeds point at a healthy source, so their forced fetches
    // succeed and they revive; the excluded feed stays as it was.
    await expectFeedsRevived(page, 21);
    await expect(
      page.getByRole("row", { name: /Not eligible/ }).getByLabel(
        "Feed limit exceeded",
      ),
    ).toBeVisible();
    await expect(
      page
        .getByRole("row", { name: /Not eligible/ })
        .getByLabel("Ok"),
    ).toHaveCount(0);
  });

  test("leaves excluded feeds in their rendered status while eligible feeds revive", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    const userId = await getUserMongoIdFromDiscordId(discordUserId);
    const workspaceName = `E2E Retry Eligibility ${Date.now()}`;
    const { workspaceId, slug } = await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId: userId,
      selfRole: "owner",
    });
    await seedWorkspaceFeedsInDb({
      workspaceId,
      userId,
      discordUserId,
      feeds: [
        {
          title: "Eligible request failure",
          url: `${MOCK_RSS_FEED_URL}?eligible=${Date.now()}`,
          disabledCode: "FAILED_REQUESTS",
          healthStatus: "FAILED",
        },
        {
          title: "Plan-disabled feed",
          url: `${MOCK_RSS_FEED_URL}?plan-disabled=${Date.now()}`,
          disabledCode: "EXCEEDED_FEED_LIMIT",
          healthStatus: "FAILED",
        },
      ],
    });

    await page.reload();
    await page.getByRole("button", { name: /Switch workspace/ }).click();
    await page.getByRole("menuitemradio", { name: workspaceName }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${slug}/feeds$`));

    await page.getByRole("button", { name: "Retry all 1 failed feed" }).click();
    await page
      .getByRole("button", { name: "Retry all failed feeds" })
      .last()
      .click();

    await expect(
      page.getByRole("link", {
        name: "Eligible request failure",
        exact: true,
      }),
    ).toBeVisible();
    await expectFeedsRevived(page, 1);
    await expect(
      page.getByRole("link", { name: "Plan-disabled feed", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("row", { name: /Plan-disabled feed/ })
        .getByLabel("Feed limit exceeded"),
    ).toBeVisible();
  });
});
