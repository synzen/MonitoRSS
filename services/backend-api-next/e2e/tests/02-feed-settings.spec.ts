import { test, expect } from "../fixtures/test-fixtures";
import {
  getTestServerName,
  getTestChannelName,
  getTestForumChannelName,
  getTestInviteUsername,
} from "../helpers/api";

test.describe("Feed Settings", () => {
  test("can view feed settings page", async ({ page, testFeed }) => {
    await page.goto(`/feeds/${testFeed.id}`);
    await expect(
      page.getByRole("heading", { name: testFeed.title }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("can create a connection through the UI modal", async ({
    page,
    testFeed,
  }) => {
    const serverName = getTestServerName();
    const channelName = getTestChannelName();

    test.skip(
      !serverName || !channelName,
      "serverName and channelName must be configured in e2econfig.json",
    );

    await page.goto(`/feeds/${testFeed.id}`);
    await expect(
      page.getByRole("heading", { name: testFeed.title }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: /Add Discord channel/i }).click();

    await page.locator("#server-select").click();
    await page
      .locator('[role="option"]')
      .filter({ hasText: serverName! })
      .click();

    await page.locator("#channel-select").click();
    await page.getByRole("option", { name: channelName!, exact: true }).click();

    await page
      .getByRole("radio", { name: /Don't use threads/i })
      .click({ force: true });

    await page.getByRole("button", { name: /Next: Choose Template/i }).click();

    await expect(page.getByTestId("template-selection-modal")).toBeVisible({
      timeout: 10000,
    });

    await page.getByText("Simple Text").first().click();

    // Wait for the preview to load after selecting a template
    // Verify the preview content appears (article title shown in bold/strong)
    await expect(
      page
        .locator('[data-testid="template-selection-modal"]')
        .locator("strong")
        .filter({ hasText: "Test Article" }),
    ).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: "Save all changes" }).click();

    await expect(page.getByText("You're all set")).toBeVisible({
      timeout: 10000,
    });
  });

  test("can create a forum connection through the UI modal", async ({
    page,
    testFeed,
  }) => {
    const serverName = getTestServerName();
    const forumChannelName = getTestForumChannelName();

    test.skip(
      !serverName || !forumChannelName,
      "serverName and forumChannelName must be configured in e2econfig.json",
    );

    await page.goto(`/feeds/${testFeed.id}`);
    await expect(
      page.getByRole("heading", { name: testFeed.title }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: /Add Discord forum/i }).click();

    await page.locator("#server-select").click();
    await page
      .locator('[role="option"]')
      .filter({ hasText: serverName! })
      .click();

    await page.locator("#channel-select").click();
    await page
      .getByRole("option", { name: forumChannelName!, exact: true })
      .click();

    await page.getByRole("button", { name: /Next: Choose Template/i }).click();

    await expect(
      page.getByTestId("forum-template-selection-modal"),
    ).toBeVisible({
      timeout: 10000,
    });

    await page.getByText("Simple Text").first().click();

    await expect(
      page
        .locator('[data-testid="forum-template-selection-modal"]')
        .locator("strong")
        .filter({ hasText: "Test Article" }),
    ).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: "Save all changes" }).click();

    await expect(page.getByText("You're all set")).toBeVisible({
      timeout: 10000,
    });
  });

  test("can create a Discord webhook connection through the UI modal", async ({
    page,
    testFeed,
  }) => {
    const serverName = getTestServerName();
    const channelName = getTestChannelName();

    test.skip(
      !serverName || !channelName,
      "serverName and channelName must be configured in e2econfig.json",
    );

    await page.goto(`/feeds/${testFeed.id}`);
    await expect(
      page.getByRole("heading", { name: testFeed.title }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: /Add Discord webhook/i }).click();

    await page.locator("#server-select").click();
    await page
      .locator('[role="option"]')
      .filter({ hasText: serverName! })
      .click();

    await page.locator("#channel-select").click();
    await page.getByRole("option", { name: channelName!, exact: true }).click();

    await page.getByRole("button", { name: /Next: Choose Template/i }).click();

    await expect(
      page.getByTestId("webhook-template-selection-modal"),
    ).toBeVisible({
      timeout: 10000,
    });

    await page.getByText("Simple Text").first().click();

    await expect(
      page
        .locator('[data-testid="webhook-template-selection-modal"]')
        .locator("strong")
        .filter({ hasText: "Test Article" }),
    ).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: "Save all changes" }).click();

    await expect(page.getByText("You're all set")).toBeVisible({
      timeout: 10000,
    });
  });

  test.describe("Miscellaneous Feed Settings", () => {
    test("can update refresh rate and verify it in Feed Overview", async ({
      page,
      testFeed,
    }) => {
      await page.goto(`/feeds/${testFeed.id}?view=settings`);
      await expect(
        page.getByRole("heading", { name: testFeed.title }),
      ).toBeVisible({ timeout: 10000 });

      await expect(
        page.getByRole("heading", { name: "Refresh Rate" }),
      ).toBeVisible({ timeout: 10000 });

      const refreshRateInput = page.locator(
        'input[name="userRefreshRateMinutes"]',
      );
      await refreshRateInput.clear();
      await refreshRateInput.fill("15");

      await page.getByRole("button", { name: "Save all changes" }).click();

      await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10000 });

      await page.goto(`/feeds/${testFeed.id}`);
      await expect(
        page.getByRole("heading", { name: "Feed Overview" }),
      ).toBeVisible({ timeout: 10000 });

      await expect(page.getByText(/15 minutes/i)).toBeVisible({
        timeout: 10000,
      });

      await page.goto(`/feeds/${testFeed.id}?view=settings`);
      await expect(refreshRateInput).toHaveValue("15", { timeout: 10000 });
    });

    test("can update article date checks", async ({ page, testFeed }) => {
      await page.goto(`/feeds/${testFeed.id}?view=settings`);
      await expect(
        page.getByRole("heading", { name: testFeed.title }),
      ).toBeVisible({ timeout: 10000 });

      await expect(
        page.getByRole("heading", { name: "Article Date Checks" }),
      ).toBeVisible({ timeout: 10000 });

      const dateThresholdInput = page.locator(
        'input[name="oldArticleDateDiffMsThreshold"]',
      );
      await dateThresholdInput.clear();
      await dateThresholdInput.fill("7");

      await page.getByRole("button", { name: "Save all changes" }).click();

      await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10000 });

      await page.reload();
      await expect(dateThresholdInput).toHaveValue("7", { timeout: 10000 });
    });

    test("can update date placeholder settings", async ({ page, testFeed }) => {
      await page.goto(`/feeds/${testFeed.id}?view=settings`);
      await expect(
        page.getByRole("heading", { name: testFeed.title }),
      ).toBeVisible({ timeout: 10000 });

      const timezoneInput = page.locator('input[name="dateTimezone"]');
      await timezoneInput.clear();
      await timezoneInput.fill("America/New_York");

      const dateFormatInput = page.locator('input[name="dateFormat"]');
      await dateFormatInput.clear();
      await dateFormatInput.fill("YYYY-MM-DD");

      const dateLocaleSelect = page.locator('select[name="dateLocale"]');
      await dateLocaleSelect.selectOption("de");

      await page.getByRole("button", { name: "Save all changes" }).click();

      await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10000 });

      await page.reload();
      await expect(timezoneInput).toHaveValue("America/New_York", {
        timeout: 10000,
      });
      await expect(dateFormatInput).toHaveValue("YYYY-MM-DD", {
        timeout: 10000,
      });
      await expect(dateLocaleSelect).toHaveValue("de", { timeout: 10000 });
    });

    test("can send a feed management invite", async ({
      page,
      testFeedWithConnection,
    }) => {
      const serverName = getTestServerName();
      const inviteUsername = getTestInviteUsername();

      test.skip(
        !serverName || !inviteUsername,
        "serverName and inviteUsername must be configured in e2econfig.json",
      );

      const { feed } = testFeedWithConnection;

      await page.goto(`/feeds/${feed.id}?view=settings`);
      await expect(page.getByRole("heading", { name: feed.title })).toBeVisible(
        { timeout: 10000 },
      );

      await expect(
        page.getByRole("heading", { name: "Feed Management Invites" }),
      ).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: /Invite user to/i }).click();
      await page.getByRole("menuitem", { name: "Co-manage feed" }).click();

      await expect(
        page.getByRole("dialog", { name: /Invite User to Co-manage/i }),
      ).toBeVisible({ timeout: 10000 });

      await page.locator("#server-select").click();
      await page
        .locator('[role="option"]')
        .filter({ hasText: serverName! })
        .click();

      await page.locator("#user-select").click();
      await page.locator("#user-select").fill(inviteUsername!);
      await page
        .locator('[role="option"]')
        .filter({ hasText: inviteUsername! })
        .first()
        .click({ timeout: 15000 });

      await page
        .getByRole("button", { name: "Select all Connections", exact: true })
        .click();

      await page
        .getByRole("button", { name: /Invite User to Co-manage/i })
        .click();

      await expect(
        page.getByText(
          new RegExp(`Successfully sent invite to ${inviteUsername}`),
        ),
      ).toBeVisible({
        timeout: 10000,
      });

      await expect(
        page.getByText(inviteUsername!, { exact: true }),
      ).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("Pending")).toBeVisible({ timeout: 10000 });
    });
  });
});
