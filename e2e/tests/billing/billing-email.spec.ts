import {
  test,
  expect,
  type Page,
  createContextForDiscordUser,
} from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import {
  enableWorkspacesFeatureInDb,
  setVerifiedEmailInDb,
  getUserMongoIdFromDiscordId,
  seedWorkspaceWithMembershipsInDb,
  setWorkspaceBillingCustomerInDb,
} from "../../helpers/workspaces-db";
import { createPaddleCustomer } from "../../helpers/paddle-api";
import {
  waitForVerificationCode,
  waitForMail,
  resetCapturedMail,
} from "../../helpers/smtp";

// Billing-email separation against the REAL Paddle sandbox (e2e-paddle
// project): the workspace's billing email is a per-workspace value seeded from
// the owner's verified email, owner-editable from the Billing page, and
// untouched by verified-email change/revert (identity-only). Asserted entirely
// through the rendered UI.
//
// No full checkout: the workspace is seeded with an active subscription shell
// and pointed at a real sandbox customer (created via the Paddle API), so the
// "Change billing email" save hits Paddle for real and persists.

async function waitForAuthenticatedApp(page: Page): Promise<void> {
  await expect(
    page.getByRole("button", { name: "Account settings" }),
  ).toBeVisible({
    timeout: 15000,
  });
}

async function openAccountSettings(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Account settings" }).click();
  await page.getByRole("menuitem", { name: /account settings/i }).click();
  await expect(
    page.getByRole("heading", { name: "Account Settings" }),
  ).toBeVisible({
    timeout: 15000,
  });
}

function extractRevertPath(emailBody: string): string {
  const cleaned = emailBody
    .replace(/=\r?\n/g, "")
    .replace(/&#x3D;/g, "=")
    .replace(/&amp;/g, "&");

  const matches = [
    ...cleaned.matchAll(/\/email-verification\/revert\?token=([A-Za-z0-9_.-]+)/g),
  ];
  if (matches.length === 0) {
    throw new Error("No revert link found in the change-notice email body");
  }

  const token = matches
    .map((m) => m[1])
    .map((t) => t.replace(/\.{2,}/g, "."))
    .reduce((longest, t) => (t.length > longest.length ? t : longest), "");

  return `/email-verification/revert?token=${token}`;
}

test.describe("Workspace billing email", () => {
  test("owner edit round-trips and survives change-email plus revert", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);

    await page.goto("/feeds");
    await waitForAuthenticatedApp(page);

    const discordUserId = await getDiscordUserIdFromPage(page);
    const verifiedEmail = `billing-owner-${discordUserId}@example.com`;
    const editedBillingEmail = `billing-edited-${discordUserId}@example.com`;
    const changedVerifiedEmail = `billing-changed-${discordUserId}@example.com`;

    await enableWorkspacesFeatureInDb(discordUserId);
    await setVerifiedEmailInDb(discordUserId, verifiedEmail);
    await resetCapturedMail([
      verifiedEmail,
      editedBillingEmail,
      changedVerifiedEmail,
    ]);

    const selfUserId = await getUserMongoIdFromDiscordId(discordUserId);
    const { slug: workspaceSlug, workspaceId } =
      await seedWorkspaceWithMembershipsInDb({
        workspaceName: `E2E Billing Email ${discordUserId}`,
        selfUserId,
        selfRole: "owner",
        withActiveSubscription: true,
      });

    // Point the seeded billing record at a real sandbox customer created with
    // the owner's verified email (the post-checkout seed state).
    const customerId = await createPaddleCustomer(verifiedEmail);
    await setWorkspaceBillingCustomerInDb({
      workspaceId,
      customerId,
      email: verifiedEmail,
    });

    await page.reload();
    await waitForAuthenticatedApp(page);

    // The Billing page surfaces the seeded address as the "Billed to" line.
    await page.goto(`/workspaces/${workspaceSlug}/settings/billing`);
    await expect(
      page.getByRole("heading", { name: "Billing" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(verifiedEmail)).toBeVisible({ timeout: 15000 });

    // Owner edit round-trip through the rendered form.
    await page.getByRole("button", { name: /change billing email/i }).click();
    const billingDialog = page.getByLabel("Billing email");
    await expect(billingDialog).toBeVisible({ timeout: 10000 });
    await billingDialog.fill(editedBillingEmail);
    await page.getByRole("button", { name: /save billing email/i }).click();
    await expect(page.getByText(editedBillingEmail)).toBeVisible({
      timeout: 15000,
    });

    // Persisted across reload (provider updated first, local follows).
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Billing" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(editedBillingEmail)).toBeVisible({
      timeout: 15000,
    });

    // Changing the verified email is identity-only: the billing address stays.
    await openAccountSettings(page);
    await expect(
      page.getByRole("textbox", { name: "Verified workspace email" }),
    ).toHaveValue(verifiedEmail);
    await page.getByRole("button", { name: /change email/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email address").fill(changedVerifiedEmail);
    await dialog.getByRole("button", { name: /^send code$/i }).click();
    const code = await waitForVerificationCode(changedVerifiedEmail);
    await dialog.getByLabel(/verification code/i).fill(code);
    await dialog.getByRole("button", { name: /^verify$/i }).click();
    await expect(
      page.getByRole("alert").getByText(/your verified email has been updated/i),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("textbox", { name: "Verified workspace email" }),
    ).toHaveValue(changedVerifiedEmail);

    await page.goto(`/workspaces/${workspaceSlug}/settings/billing`);
    await expect(
      page.getByRole("heading", { name: "Billing" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(editedBillingEmail)).toBeVisible({
      timeout: 15000,
    });

    // Reverting the verified email likewise leaves billing alone. The revert
    // invalidates the session, so assert the restored identity plus the stable
    // billing address from a fresh session.
    const notice = await waitForMail(verifiedEmail);
    const revertPath = extractRevertPath(notice.body);
    await page.goto(revertPath);
    await expect(
      page.getByRole("heading", { name: /revert this email change\?/i }),
    ).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /revert this change/i }).click();
    await expect(
      page.getByRole("heading", { name: /your email change was reverted/i }),
    ).toBeVisible({ timeout: 15000 });

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
      ).toHaveValue(verifiedEmail);

      await freshPage.goto(`/workspaces/${workspaceSlug}/settings/billing`);
      await expect(
        freshPage.getByRole("heading", { name: "Billing" }),
      ).toBeVisible({ timeout: 15000 });
      await expect(freshPage.getByText(editedBillingEmail)).toBeVisible({
        timeout: 15000,
      });
    } finally {
      await freshContext.close();
    }
  });
});
