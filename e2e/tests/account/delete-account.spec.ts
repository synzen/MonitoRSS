import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { setVerifiedEmailInDb } from "../../helpers/workspaces-db";
import { waitForVerificationCode, waitForMail, resetCapturedMail } from "../../helpers/smtp";

// Drives GDPR account deletion end to end through the Account Settings danger
// section: send the one-time code to the verified email, confirm it in the
// dialog, and observe erasure through the UI. The erasure cascade itself is
// owned by the backend integration tests; here we prove the flow and that the
// previously verified email no longer exists on the (re-provisioned) account.

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

test.describe("Account deletion", () => {
  test("erases the account through the settings dialog", async ({ page }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    const email = `delete-account-${discordUserId}@example.com`;

    await setVerifiedEmailInDb(discordUserId, email);
    await resetCapturedMail(email);
    await page.reload();
    await waitForAuthenticatedApp(page);

    await openAccountSettings(page);

    const section = page.getByRole("region", { name: "Delete Account" });
    await section.getByRole("button", { name: /^delete account$/i }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText(/permanently erases/i)).toBeVisible();

    await dialog.getByRole("button", { name: /send confirmation code/i }).click();

    const code = await waitForVerificationCode(email);

    // The code must arrive in the dedicated deletion email, not the generic
    // verify-your-email template.
    const mail = await waitForMail(email);
    expect(mail.subject).toBe("Confirm your MonitoRSS account deletion");

    await dialog.getByLabel(/confirmation code/i).fill(code);
    await dialog.getByRole("button", { name: /permanently delete account/i }).click();

    await expect(
      dialog.getByText(/your account and its data have been deleted/i),
    ).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByRole("button", { name: /return to homepage/i })).toBeVisible();

    // The mock session survives, so the next load provisions a fresh blank
    // account for the same Discord id. The previously verified email being gone
    // is the UI-observable proof that the old user document was erased.
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await openAccountSettings(page);

    await expect(page.getByRole("textbox", { name: "Verified workspace email" })).toHaveValue(
      "(no verified email)",
    );
  });

  test("explains the verified-email requirement instead of offering to send a code", async ({
    page,
  }) => {
    // A freshly provisioned user has no verified email.
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);
    await openAccountSettings(page);

    const section = page.getByRole("region", { name: "Delete Account" });
    await section.getByRole("button", { name: /^delete account$/i }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText(/verified email required/i)).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /send confirmation code/i }),
    ).toBeHidden();
  });
});
