import { expect, test, type Page } from "../../fixtures/test-fixtures";
import { MOCK_RSS_FEED_URL } from "../../helpers/constants";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  changePersonalFeedOwnerInDb,
  deletePersonalFeedInDb,
  enableWorkspacesFeatureInDb,
  getUserMongoIdFromDiscordId,
  removeWorkspaceMembershipInDb,
  seedPersonalFeedsInDb,
  seedWorkspaceFeedsInDb,
  seedWorkspaceWithMembershipsInDb,
  setVerifiedEmailInDb,
} from "../../helpers/workspaces-db";

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(
    page.getByRole("button", { name: "Account settings" }),
  ).toBeVisible({
    timeout: 15_000,
  });
}

async function openConcurrentMoveDialog(page: Page, label: string) {
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
  const workspaceName = `E2E ${label} ${stamp}`;
  const { workspaceId, slug } = await seedWorkspaceWithMembershipsInDb({
    workspaceName,
    selfUserId: userId,
    selfRole: "owner",
  });
  const movingTitle = `${label} personal ${stamp}`;
  await seedPersonalFeedsInDb({
    userId,
    discordUserId,
    feeds: [{ title: movingTitle, url: MOCK_RSS_FEED_URL }],
  });

  await page.goto(`/workspaces/${slug}/feeds`);
  await page.getByRole("button", { name: "Move personal feeds" }).click();
  const dialog = page.getByRole("dialog", {
    name: `Move personal feeds to ${workspaceName}`,
  });
  const checkbox = dialog.getByRole("checkbox", { name: movingTitle });
  await expect(checkbox).toBeChecked({ timeout: 15_000 });

  return { checkbox, dialog, movingTitle, userId, workspaceId };
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

test("paginates an over-capacity personal feed move and shows the selected total", async ({
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
  const workspaceName = `E2E Paginated Move ${stamp}`;
  const { slug } = await seedWorkspaceWithMembershipsInDb({
    workspaceName,
    selfUserId: userId,
    selfRole: "owner",
    withActiveSubscription: true,
  });
  const feedTitles = Array.from(
    { length: 71 },
    (_, index) =>
      `Paginated personal ${String(index + 1).padStart(2, "0")} ${stamp}`,
  );
  await seedPersonalFeedsInDb({
    userId,
    discordUserId,
    feeds: feedTitles.map((title) => ({ title, url: MOCK_RSS_FEED_URL })),
  });

  await page.goto(`/workspaces/${slug}/feeds`);
  await page.getByRole("button", { name: "Move personal feeds" }).click();
  const dialog = page.getByRole("dialog", {
    name: `Move personal feeds to ${workspaceName}`,
  });

  await expect(dialog.getByText("0 of 71 feeds selected")).toBeVisible({
    timeout: 15_000,
  });
  const firstPageFeed = dialog.getByRole("checkbox", { name: feedTitles[0] });
  await expect(firstPageFeed).toBeVisible();
  await expect(
    dialog.getByRole("checkbox", { name: feedTitles[25] }),
  ).toHaveCount(0);

  await dialog.getByRole("button", { name: "View more feeds" }).click();
  const secondPageFeed = dialog.getByRole("checkbox", { name: feedTitles[25] });
  await expect(secondPageFeed).toBeVisible({ timeout: 15_000 });

  await dialog.locator("label").filter({ hasText: feedTitles[25] }).click();
  await expect(secondPageFeed).toBeChecked();
  await expect(dialog.getByText("1 of 71 feeds selected")).toBeVisible();
});

test("moves a constrained batch into a populated workspace and preserves disabled states", async ({
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
  const workspaceName = `E2E Populated Move ${stamp}`;
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
      { title: `Existing active ${stamp}`, url: MOCK_RSS_FEED_URL },
      {
        title: `Existing manual ${stamp}`,
        url: MOCK_RSS_FEED_URL,
        disabledCode: "MANUAL",
      },
      {
        title: `Existing limit ${stamp}`,
        url: MOCK_RSS_FEED_URL,
        disabledCode: "EXCEEDED_FEED_LIMIT",
      },
    ],
  });
  const manualTitle = `Moving manual ${stamp}`;
  const limitTitle = `Moving limit ${stamp}`;
  const remainingTitle = `Remain personal ${stamp}`;
  await seedPersonalFeedsInDb({
    userId,
    discordUserId,
    feeds: [
      { title: manualTitle, url: MOCK_RSS_FEED_URL, disabledCode: "MANUAL" },
      {
        title: limitTitle,
        url: MOCK_RSS_FEED_URL,
        disabledCode: "EXCEEDED_FEED_LIMIT",
      },
      { title: remainingTitle, url: MOCK_RSS_FEED_URL },
    ],
  });

  await page.goto(`/workspaces/${slug}/feeds`);
  await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Move personal feeds" }).click();
  const dialog = page.getByRole("dialog", {
    name: `Move personal feeds to ${workspaceName}`,
  });

  for (const title of [manualTitle, limitTitle, remainingTitle]) {
    await expect(dialog.getByRole("checkbox", { name: title })).not.toBeChecked(
      {
        timeout: 15_000,
      },
    );
  }
  await dialog
    .getByLabel("Which feeds to select when they do not all fit")
    .selectOption("oldest");
  await dialog
    .getByRole("button", { name: "Select my oldest 2 feeds" })
    .click();
  await expect(
    dialog.getByRole("checkbox", { name: manualTitle }),
  ).toBeChecked();
  await expect(
    dialog.getByRole("checkbox", { name: limitTitle }),
  ).toBeChecked();
  await expect(
    dialog.getByRole("checkbox", { name: remainingTitle }),
  ).not.toBeChecked();
  await dialog.getByRole("button", { name: "Move feeds" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "2 personal feeds moved" }),
  ).toBeVisible({ timeout: 15_000 });
  const manualRow = page.getByRole("row").filter({
    has: page.getByRole("link", { name: manualTitle, exact: true }),
  });
  const limitRow = page.getByRole("row").filter({
    has: page.getByRole("link", { name: limitTitle, exact: true }),
  });
  await expect(manualRow.getByLabel("Manually disabled")).toBeVisible({
    timeout: 15_000,
  });
  await expect(limitRow.getByLabel("Ok")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Move personal feeds" }),
  ).toBeDisabled();
  await expect(page.getByText(/workspace is full/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Manage capacity" }),
  ).toBeVisible();
});

test("keeps the selection visible and refreshes capacity after a concurrent workspace change", async ({
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
  const workspaceName = `E2E Concurrent Move ${stamp}`;
  const { workspaceId, slug } = await seedWorkspaceWithMembershipsInDb({
    workspaceName,
    selfUserId: userId,
    selfRole: "owner",
  });
  await seedWorkspaceFeedsInDb({
    workspaceId,
    userId,
    discordUserId,
    feeds: Array.from({ length: 4 }, (_, index) => ({
      title: `Existing ${index + 1} ${stamp}`,
      url: MOCK_RSS_FEED_URL,
    })),
  });
  const movingTitle = `Concurrent personal ${stamp}`;
  await seedPersonalFeedsInDb({
    userId,
    discordUserId,
    feeds: [{ title: movingTitle, url: MOCK_RSS_FEED_URL }],
  });

  await page.goto(`/workspaces/${slug}/feeds`);
  await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Move personal feeds" }).click();
  const dialog = page.getByRole("dialog", {
    name: `Move personal feeds to ${workspaceName}`,
  });
  const movingCheckbox = dialog.getByRole("checkbox", { name: movingTitle });
  await expect(movingCheckbox).toBeChecked({ timeout: 15_000 });

  await seedWorkspaceFeedsInDb({
    workspaceId,
    userId,
    discordUserId,
    feeds: [
      { title: `Concurrent workspace feed ${stamp}`, url: MOCK_RSS_FEED_URL },
    ],
  });
  await dialog.getByRole("button", { name: "Move feeds" }).click();

  await expect(
    dialog.getByText(/available capacity changed.*no feeds were moved/i),
  ).toBeVisible({ timeout: 15_000 });
  await expect(movingCheckbox).toBeChecked();
  await expect(dialog.getByText("1 of 0 selected")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    dialog.getByRole("button", { name: "Move feeds" }),
  ).toHaveAttribute("aria-disabled", "true");
});

test("keeps the selection and a specific error visible after the selected feed is deleted", async ({
  page,
}) => {
  const { checkbox, dialog, movingTitle, userId } =
    await openConcurrentMoveDialog(page, "Deleted Move");

  await deletePersonalFeedInDb({ userId, title: movingTitle });
  await dialog.getByRole("button", { name: "Move feeds" }).click();

  await expect(
    dialog.getByText(/selected feeds no longer exist.*no feeds were moved/i),
  ).toBeVisible({ timeout: 15_000 });
  await expect(checkbox).toBeChecked();
  await expect(dialog).toBeVisible();
});

test("keeps the selection and a specific error visible after feed ownership changes", async ({
  page,
}) => {
  const { checkbox, dialog, movingTitle, userId } =
    await openConcurrentMoveDialog(page, "Ownership Move");

  await changePersonalFeedOwnerInDb({ userId, title: movingTitle });
  await dialog.getByRole("button", { name: "Move feeds" }).click();

  await expect(
    dialog.getByText(
      /selected feeds are no longer your personal feeds.*no feeds were moved/i,
    ),
  ).toBeVisible({ timeout: 15_000 });
  await expect(checkbox).toBeChecked();
  await expect(dialog).toBeVisible();
});

test("keeps the selection and a specific error visible after workspace membership changes", async ({
  page,
}) => {
  const { checkbox, dialog, userId, workspaceId } =
    await openConcurrentMoveDialog(page, "Membership Move");

  await removeWorkspaceMembershipInDb({ workspaceId, userId });
  await dialog.getByRole("button", { name: "Move feeds" }).click();

  await expect(
    dialog.getByText(/workspace membership changed.*no feeds were moved/i),
  ).toBeVisible({ timeout: 15_000 });
  await expect(checkbox).toBeChecked();
  await expect(dialog).toBeVisible();
});
