import { test, expect, createContextForDiscordUser } from "../../fixtures/test-fixtures";
import { E2E_ADMIN_DISCORD_ID } from "../../helpers/mock-discord-data";
import {
  enableWorkspacesFeatureInDb,
  setVerifiedEmailInDb,
  seedForeignWorkspaceWithFeedInDb,
} from "../../helpers/workspaces-db";

// A site admin (a Discord id in BACKEND_API_ADMIN_USER_IDS) can open the feeds
// page of a workspace they are NOT a member of, to troubleshoot. The workspace,
// its owner, and its feed are seeded for a different user; the admin navigates to
// the workspace feeds URL directly and sees the feed rendered in the table.

test.describe("Site-admin workspace access", () => {
  test("admin views a non-member workspace's feed list", async ({ browser }, testInfo) => {
    // The admin's own account needs the workspaces feature + a verified email so
    // the workspace shell renders for them.
    await enableWorkspacesFeatureInDb(E2E_ADMIN_DISCORD_ID);
    await setVerifiedEmailInDb(
      E2E_ADMIN_DISCORD_ID,
      `admin-${E2E_ADMIN_DISCORD_ID}@example.com`,
    );

    const feedTitle = `Admin Visible Feed ${Date.now()}`;
    const { slug } = await seedForeignWorkspaceWithFeedInDb({
      workspaceName: "Customer Workspace",
      feedTitle,
      feedUrl: "https://example.com/admin-observed-feed.xml",
    });

    const context = await createContextForDiscordUser(
      browser,
      testInfo,
      E2E_ADMIN_DISCORD_ID,
    );

    try {
      const page = await context.newPage();

      // Direct-URL navigation to a workspace the admin does not belong to.
      await page.goto(`/workspaces/${slug}/feeds`);

      // The seeded feed renders in the workspace feeds table for the admin: each
      // row exposes a "Configure {title}" link.
      await expect(
        page.getByRole("link", { name: `Configure ${feedTitle}` }),
      ).toBeVisible({ timeout: 15000 });
      await expect(page).toHaveURL(new RegExp(`/workspaces/${slug}/feeds`));
    } finally {
      await context.close();
    }
  });
});
