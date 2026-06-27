import {
  test,
  expect,
  type Page,
  createContextForDiscordUser,
} from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { enableWorkspacesFeatureInDb, setVerifiedEmailInDb } from "../../helpers/workspaces-db";
import { waitForVerificationCode, waitForMail, resetCapturedMail } from "../../helpers/smtp";

// Drives the full "this wasn't me, revert" recovery path through the real UI and
// the real change-notice email: a user changes their verified email (which emails
// the OLD address a notice containing a revert link), then opens that link, clicks
// the confirm button, and the change is undone. Restoration is asserted through
// the rendered settings page; the precise session-epoch 401 is owned by the
// backend integration test.

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

async function changeVerifiedEmail(page: Page, newEmail: string): Promise<void> {
  await openAccountSettings(page);
  await page.getByRole("button", { name: /change email/i }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email address").fill(newEmail);
  await dialog.getByRole("button", { name: /^send code$/i }).click();

  const code = await waitForVerificationCode(newEmail);
  await dialog.getByLabel(/verification code/i).fill(code);
  await dialog.getByRole("button", { name: /^verify$/i }).click();

  await expect(
    page.getByRole("alert").getByText(/your verified email has been updated/i),
  ).toBeVisible({ timeout: 15000 });
}

// Pull the revert link out of the change-notice email sent to the old address.
// The captured body joins several decodings of the transfer-encoded MIME part;
// quoted-printable can soft-wrap a long href with `=\r\n` mid-token, so the first
// regex hit may be a truncated copy. Remove QP soft breaks and HTML entities
// first, then take the LONGEST token match across the cleaned body (the intact
// one). The href is also HTML-entity-escaped (`=` -> `&#x3D;`) as a client stores
// it.
function extractRevertPath(emailBody: string): string {
  const cleaned = emailBody
    .replace(/=\r?\n/g, "") // quoted-printable soft line breaks
    .replace(/&#x3D;/g, "=") // HTML-entity '=' back to a literal
    .replace(/&amp;/g, "&"); // HTML-entity '&' back to a literal

  const matches = [
    ...cleaned.matchAll(/\/email-verification\/revert\?token=([A-Za-z0-9_.-]+)/g),
  ];
  if (matches.length === 0) {
    throw new Error("No revert link found in the change-notice email body");
  }

  const token = matches
    .map((m) => m[1])
    // SMTP dot-stuffing doubles a leading '.' on a line; once QP soft-breaks are
    // removed the token's single '.' separator can surface as '..'. A valid token
    // (base64url '.' hex) has exactly one dot and neither half contains a dot, so
    // collapsing any run of dots back to one is safe.
    .map((t) => t.replace(/\.{2,}/g, "."))
    .reduce((longest, t) => (t.length > longest.length ? t : longest), "");

  return `/email-verification/revert?token=${token}`;
}

test.describe("Revert verified email", () => {
  test("undoes an email change via the revert link in the change notice", async ({
    page,
    browser,
  }) => {
    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    const oldEmail = `revert-old-${discordUserId}@example.com`;
    const newEmail = `revert-new-${discordUserId}@example.com`;

    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, oldEmail);
    await resetCapturedMail([oldEmail, newEmail]);
    await page.reload();
    await waitForAuthenticatedApp(page);

    // Change the email: the settings page now shows the new address, and a change
    // notice is dispatched to the OLD address.
    await changeVerifiedEmail(page, newEmail);
    await expect(
      page.getByRole("textbox", { name: "Verified workspace email" }),
    ).toHaveValue(newEmail);

    // Recover the revert link from the real notice email sent to the old address.
    const notice = await waitForMail(oldEmail);
    const revertPath = extractRevertPath(notice.body);

    // Open the revert confirm page. Nothing happens until the user clicks — the
    // page does not act on load.
    await page.goto(revertPath);
    await expect(
      page.getByRole("heading", { name: /revert this email change\?/i }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: /revert this change/i }).click();

    // The confirm page reports success through the rendered UI.
    await expect(
      page.getByRole("heading", { name: /your email change was reverted/i }),
    ).toBeVisible({ timeout: 15000 });

    // Restoration verified through the UI. The revert invalidated the original
    // session (epoch bump), so a brand-new session for the same user is required
    // to view the account again — which itself confirms the sign-out. That fresh
    // session's settings page shows the verified email restored to the original.
    const freshContext = await createContextForDiscordUser(
      browser,
      test.info(),
      discordUserId,
    );
    try {
      const freshPage = await freshContext.newPage();
      await freshPage.goto("/feeds");
      await waitForAuthenticatedApp(freshPage);
      await openAccountSettings(freshPage);
      await expect(
        freshPage.getByRole("textbox", { name: "Verified workspace email" }),
      ).toHaveValue(oldEmail);
    } finally {
      await freshContext.close();
    }
  });
});
