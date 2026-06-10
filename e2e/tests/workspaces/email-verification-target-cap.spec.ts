import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb } from "../../helpers/workspaces-db";
import {
  peekVerificationCode,
  waitForVerificationCode,
  resetCapturedMail,
} from "../../helpers/smtp";

// The generic email-verification send (used by the create-team verify step) caps
// how many DISTINCT addresses a single user can have codes sent to within the
// window (5/hour). This exercises that cap through the real UI: after sending to
// the cap's worth of distinct addresses, the next NEW address is refused and no
// code is dispatched to it.

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

async function openCreateTeamVerifyStep(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Account settings" }).click();
  await page.getByRole("menuitem", { name: /create a team/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: /send code/i })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Email verification distinct-target cap", () => {
  test("refuses to send a code to a new address once the per-user cap is reached", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    // No verified email: the create-team dialog renders the editable verify step.
    await page.reload();
    await waitForAuthenticatedApp(page);

    await resetCapturedMail(
      [0, 1, 2, 3, 4, 6].map((i) => `cap-${i}-${discordUserId}@example.com`),
    );
    await openCreateTeamVerifyStep(page);

    const dialog = page.getByRole("dialog");
    const emailInput = dialog.getByLabel("Email address");

    // Send to five distinct addresses (the cap). Each send moves the step to the
    // code entry view; "Change email" returns to the address field for the next.
    for (let i = 0; i < 5; i += 1) {
      const email = `cap-${i}-${discordUserId}@example.com`;
      await emailInput.fill(email);
      await dialog.getByRole("button", { name: /^send code$/i }).click();

      // Confirm the code actually went out for this allowed address.
      // (waitFor, not peek: this is a DELIVERY assertion and must tolerate slow CI.)
      await waitForVerificationCode(email);

      await dialog.getByRole("button", { name: /change email/i }).click();
      await expect(emailInput).toBeVisible();
    }

    // A sixth, brand-new address must be refused by the distinct-target cap.
    const sixth = `cap-6-${discordUserId}@example.com`;
    await emailInput.fill(sixth);
    await dialog.getByRole("button", { name: /^send code$/i }).click();

    // The UI surfaces the cap error and stays on the address step.
    await expect(dialog.getByText(/too many different email addresses/i)).toBeVisible({
      timeout: 15000,
    });

    // No code was dispatched to the sixth address.
    const blockedCode = await peekVerificationCode(sixth);
    expect(blockedCode).toBeNull();
  });
});
