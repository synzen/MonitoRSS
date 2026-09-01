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

test.describe("Bulk retry failed workspace feeds", () => {
  test("queues every eligible failed feed through the rendered workspace feeds page", async ({
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

    // The command queues the feeds and surfaces the success alert; the filter
    // change is user-initiated via the alert's link, never auto-applied.
    await expect(page.getByText("Failed feeds queued for retry.")).toBeVisible();
    await page.getByText("View pending retries.").click();

    // The applied filter renders as a chip, and the recovering feeds come
    // through the rendered table under the Pending Retry status. Rows sort
    // newest-first, so page one holds all 21 feeds; the setup checklist
    // outside the table also lists feed titles, so scope lookups to the table.
    await expect(page.getByText("Pending Retry")).toBeVisible();

    const feedsTable = page.getByRole("table");
    await expect(
      feedsTable.getByRole("row", { name: /Retry eligible 21\b/ }),
    ).toBeVisible();
    await expect(
      feedsTable.getByRole("row", { name: /Retry eligible 2\b/ }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Currently retrying after failed requests"),
    ).toHaveCount(21);
    await expect(
      feedsTable.getByText("Not eligible", { exact: true }),
    ).toHaveCount(0);
  });

  test("leaves excluded feeds in their rendered status while eligible feeds become pending", async ({
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
    await expect(
      page.getByLabel("Currently retrying after failed requests"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Plan-disabled feed", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Feed limit exceeded")).toBeVisible();
  });
});
