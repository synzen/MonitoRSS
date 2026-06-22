import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb, setVerifiedEmailInDb } from "../../helpers/workspaces-db";
import { waitForVerificationCode, resetCapturedMail } from "../../helpers/smtp";

// Drives the Account Settings change-email dialog end to end: a workspace-enabled
// user with an existing verified email opens the dialog, verifies a NEW address
// through the real OTP send + confirm, and the settings page then displays the
// new verified email. The old-address change notice is owned by the backend
// integration test, so it is intentionally not asserted here.

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

async function openAccountSettings(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Account settings" }).click();
  await page.getByRole("menuitem", { name: /account settings/i }).click();
  await expect(page.getByRole("heading", { name: "Account Settings" })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Change verified email", () => {
  test("verifies a new address through the dialog and shows it on the settings page", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    const oldEmail = `change-old-${discordUserId}@example.com`;
    const newEmail = `change-new-${discordUserId}@example.com`;

    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, oldEmail);
    await resetCapturedMail(newEmail);
    await page.reload();
    await waitForAuthenticatedApp(page);

    await openAccountSettings(page);

    // The verified-email row shows the current address and a change action.
    await expect(page.getByRole("textbox", { name: "Verified workspace email" })).toHaveValue(oldEmail);
    await page.getByRole("button", { name: /change email/i }).click();

    const dialog = page.getByRole("dialog");
    const emailInput = dialog.getByLabel("Email address");

    // The field starts empty; the current address is context in the intro only.
    await expect(emailInput).toHaveValue("");
    await expect(dialog.getByText(oldEmail)).toBeVisible();

    await emailInput.fill(newEmail);
    await dialog.getByRole("button", { name: /^send code$/i }).click();

    const code = await waitForVerificationCode(newEmail);
    await dialog.getByLabel(/verification code/i).fill(code);
    await dialog.getByRole("button", { name: /^verify$/i }).click();

    // Success is confirmed through the rendered settings page: the dialog closes
    // and the verified-email row now displays the new address.
    await expect(
      page.getByRole("alert").getByText(/your verified email has been updated/i),
    ).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("textbox", { name: "Verified workspace email" })).toHaveValue(newEmail);
  });
});
