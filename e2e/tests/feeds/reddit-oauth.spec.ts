import { test, expect } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { seedRevokedRedditCredentialInDb } from "../../helpers/reddit-db";
import { connectReddit } from "../../helpers/reddit-oauth";

// Personal-scope Reddit OAuth machinery through the real (mocked) flow on the
// account settings page: the connect button opens /api/v1/reddit/login, which
// round-trips the mock reddit server's authorize endpoint and the backend
// callback (session-stored state validation, token exchange), then lands back
// on the settings page.

async function gotoAccountSettings(page: import("@playwright/test").Page) {
  await page.goto("/feeds");
  await expect(
    page.getByRole("button", { name: "Account settings" }),
  ).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Account settings" }).click();
  await page.getByRole("menuitem", { name: /account settings/i }).click();
}

test.describe("Reddit OAuth (personal)", () => {
  test("connecting on the account settings page completes the OAuth round trip and disconnecting removes the grant", async ({
    page,
  }) => {
    test.setTimeout(90000);

    await gotoAccountSettings(page);

    await expect(page.getByText("Not Connected")).toBeVisible({
      timeout: 15000,
    });

    await connectReddit(
      page,
      page.getByRole("button", { name: "Connect Reddit" }),
    );

    await expect(page.getByText("Connected", { exact: true })).toBeVisible({
      timeout: 30000,
    });

    await page.getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByText("Not Connected")).toBeVisible({
      timeout: 15000,
    });
  });

  test("a dead connection shows the disconnected state and reconnecting revives it", async ({
    page,
  }) => {
    test.setTimeout(90000);

    await gotoAccountSettings(page);

    // A previously connected account whose grant has died (e.g. revoked at Reddit).
    const discordUserId = await getDiscordUserIdFromPage(page);
    await seedRevokedRedditCredentialInDb(discordUserId);
    await page.reload();
    await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
      timeout: 15000,
    });

    // The settings row distinguishes a dead connection from never-connected.
    await expect(page.getByText("Disconnected", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/no longer active/i)).toBeVisible();

    await connectReddit(
      page,
      page.getByRole("button", { name: "Reconnect Reddit" }),
    );

    await expect(page.getByText("Connected", { exact: true })).toBeVisible({
      timeout: 30000,
    });
  });
});
