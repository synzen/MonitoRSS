import { expect, test, type Page } from "../../fixtures/test-fixtures";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  enableWorkspacesFeatureInDb,
  getUserMongoIdFromDiscordId,
  seedPersonalFeedsInDb,
  setVerifiedEmailInDb,
} from "../../helpers/workspaces-db";

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(
    page.getByRole("button", { name: "Account settings" }),
  ).toBeVisible({
    timeout: 15_000,
  });
}

test("moves personal feeds from an active empty team and refreshes both rendered lists", async ({
  page,
}) => {
  await page.goto("/feeds");
  await waitForAuthenticatedApp(page);

  const discordUserId = await getDiscordUserIdFromPage(page);
  await enableWorkspacesFeatureInDb(discordUserId);
  await setVerifiedEmailInDb(
    discordUserId,
    `verified-${discordUserId}@example.com`,
  );
  const userId = await getUserMongoIdFromDiscordId(discordUserId);
  const stamp = Date.now();
  const feedTitles = [`Move Alpha ${stamp}`, `Move Beta ${stamp}`];

  await seedPersonalFeedsInDb({
    userId,
    discordUserId,
    feeds: feedTitles.map((title) => ({ title, url: MOCK_RSS_FEED_URL })),
  });

  await page.reload();
  await expect(
    page.getByRole("link", { name: feedTitles[0], exact: true }),
  ).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: /switch workspace/i }).click();
  await page.getByRole("menuitem", { name: /create a workspace/i }).click();
  const workspaceName = `E2E Move Team ${stamp}`;
  const createDialog = page.getByRole("dialog");
  await createDialog.getByLabel("Workspace name").fill(workspaceName);
  await createDialog.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/feeds$/, {
    timeout: 15_000,
  });
  const workspaceUrl = page.url();

  await page.getByRole("button", { name: "Move personal feeds" }).click();
  const moveDialog = page.getByRole("dialog", {
    name: `Move personal feeds to ${workspaceName}`,
  });
  await expect(moveDialog).toBeVisible({ timeout: 15_000 });

  for (const title of feedTitles) {
    await expect(moveDialog.getByRole("checkbox", { name: title })).toBeChecked(
      {
        timeout: 15_000,
      },
    );
  }

  await moveDialog.getByRole("button", { name: "Move feeds" }).click();

  await expect(page).toHaveURL(workspaceUrl);
  await expect(
    page.getByRole("alert").filter({ hasText: "2 personal feeds moved" }),
  ).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
  for (const title of feedTitles) {
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
  }

  await page.getByRole("button", { name: /switch workspace/i }).click();
  await page.getByRole("menuitemradio", { name: /personal/i }).click();
  await expect(page).toHaveURL(/\/feeds$/);
  await expect(
    page.getByRole("button", { name: "Switch workspace, current: Personal" }),
  ).toBeVisible({ timeout: 15_000 });
  for (const title of feedTitles) {
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toHaveCount(0);
  }
  await expect(
    page.getByRole("button", { name: "Move personal feeds" }),
  ).toHaveCount(0);
});
