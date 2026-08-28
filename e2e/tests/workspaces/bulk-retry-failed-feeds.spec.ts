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
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
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

    await page.getByRole("button", { name: "Retry all failed feeds" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Retry 21 failed feeds?");
    await expect(dialog).toContainText("Requests will run in the background");
    await page.getByRole("button", { name: "Retry all failed feeds" }).last().click();

    await expect(page.getByText("Pending Retry").first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Retry eligible 1", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Retry eligible 2", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Currently retrying after failed requests"),
    ).toHaveCount(20);
    await expect(page.getByText("Not eligible", { exact: true })).toHaveCount(0);
  });
});
