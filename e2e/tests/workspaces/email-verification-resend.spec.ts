import { test, expect, type Page } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb } from "../../helpers/workspaces-db";
import {
  peekVerificationCode,
  waitForVerificationCode,
  resetCapturedMail,
} from "../../helpers/smtp";

// The verify step discloses the server's resend cooldown (RESEND_COOLDOWN_MS, 60s)
// and code TTL (CODE_TTL_MS, 10 min) so a too-soon resend isn't a silent failure.
// This drives the real create-team verify step through the browser: after a send,
// the resend control is inert with a countdown and the expiry is shown; resending
// to the same address while the server cooldown is still active surfaces the
// friendly 429 message in the UI.

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Account settings" })).toBeVisible({
    timeout: 15000,
  });
}

async function openCreateTeamVerifyStep(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Account settings" }).click();
  await page.getByRole("menuitem", { name: /create a workspace/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: /send code/i })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Email verification resend disclosures", () => {
  test("discloses the cooldown and expiry, and surfaces the 429 on a too-soon resend", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    await enableWorkspacesFeatureInDb(discordUserId);
    // No verified email: the create-team dialog renders the editable verify step.
    await page.reload();
    await waitForAuthenticatedApp(page);

    const email = `resend-${discordUserId}@example.com`;
    await resetCapturedMail(email);
    await openCreateTeamVerifyStep(page);

    const dialog = page.getByRole("dialog");
    const emailInput = dialog.getByLabel("Email address");

    await emailInput.fill(email);
    await dialog.getByRole("button", { name: /^send code$/i }).click();

    // The first code is dispatched, moving us to the code-entry view.
    // (waitFor, not peek: this is a DELIVERY assertion and must tolerate slow CI.)
    await waitForVerificationCode(email);

    // The TTL is disclosed up front, before any expiry error can occur.
    await expect(dialog.getByText(/the code expires in 10 minutes/i)).toBeVisible();

    // The resend control is inert and shows the live countdown rather than
    // failing silently. The accessible name stays "Resend code"; the "(Ns)" is
    // visual-only.
    const resend = dialog.getByRole("button", { name: "Resend code" });
    await expect(resend).toHaveAttribute("aria-disabled", "true");
    await expect(resend).toHaveText(/resend code \(\d+s\)/i);

    // "Change email" clears the client-side cooldown guard, but the SERVER
    // cooldown for this (user, address) is still inside its 60s window.
    await dialog.getByRole("button", { name: /change email/i }).click();
    await expect(emailInput).toBeVisible();

    await resetCapturedMail(email);
    await emailInput.fill(email);
    await dialog.getByRole("button", { name: /^send code$/i }).click();

    // The server rejects the too-soon resend; the UI shows the friendly message
    // (not a raw server string) and no second code is dispatched.
    await expect(dialog.getByText(/please wait a moment before requesting/i)).toBeVisible({
      timeout: 15000,
    });

    const blockedCode = await peekVerificationCode(email);
    expect(blockedCode).toBeNull();
  });
});
