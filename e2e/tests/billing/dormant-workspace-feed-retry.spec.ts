import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  enableWorkspacesFeatureInDb,
  getUserMongoIdFromDiscordId,
  seedWorkspaceWithMembershipsInDb,
  seedWorkspaceFeedsInDb,
} from "../../helpers/workspaces-db";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";

// "Attempt to re-enable" on a FAILED_REQUESTS feed goes through the manual-request
// endpoint, which used to clear the disabled code with no feed-limit check — so a
// feed in a dormant workspace (no subscription, feed limit 0) could be pushed back
// into service. Dormancy only exists when Paddle is configured, and e2e-mock.sh
// blanks the Paddle vars for non-billing runs, so this spec lives in the
// e2e-paddle project (it never touches Paddle's API itself — a seeded
// never-subscribed workspace is dormant on its own). The feed page must explain
// the subscription requirement instead of offering a retry that can only fail.

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

const FAILED_REQUESTS_ALERT_TEXT =
  "This feed is currently disabled because there has been too many connection failures.";

test.describe("Dormant workspace failed-feed retry", () => {
  test("explains the subscription requirement instead of offering a doomed re-enable", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);

    const workspaceName = `E2E Dormant Retry WS ${Date.now()}`;
    const { workspaceId, slug } = await seedWorkspaceWithMembershipsInDb({
      workspaceName,
      selfUserId,
      selfRole: "owner",
    });

    // A feed left behind from before the workspace went dormant, disabled for
    // failing requests (creation is gated, so it cannot be created while dormant).
    await seedWorkspaceFeedsInDb({
      workspaceId,
      userId: selfUserId,
      discordUserId,
      feeds: [{ title: "Failing Feed", url: MOCK_RSS_FEED_URL, disabledCode: "FAILED_REQUESTS" }],
    });

    // Enter the workspace through the switcher and anchor on the committed scope.
    await page.reload();
    await waitForAuthenticatedApp(page);
    await page.getByRole("button", { name: /Switch workspace/ }).click();
    await page.getByRole("menuitemradio", { name: workspaceName }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${slug}/feeds$`), { timeout: 15000 });
    await expect(
      page.getByRole("button", { name: `Switch workspace, current: ${workspaceName}` }),
    ).toBeVisible({ timeout: 15000 });

    // The never-subscribed workspace is dormant.
    await expect(page.getByText("This workspace is not subscribed")).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
    await page.getByRole("link", { name: "Failing Feed", exact: true }).click();

    // The failure alert still explains the disabled state, but the re-enable
    // button is replaced by the subscription explanation: re-enabling is
    // blocked by the feed limit (0) for as long as the workspace is dormant.
    await expect(page.getByText(FAILED_REQUESTS_ALERT_TEXT)).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/can't be re-enabled because the workspace is not subscribed/),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Attempt to re-enable" })).not.toBeVisible();
  });
});
