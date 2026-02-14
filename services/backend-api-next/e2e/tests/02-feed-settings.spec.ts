import { test, expect } from "../fixtures/test-fixtures";
import {
  getTestServerName,
  getTestChannelName,
  getTestForumChannelName,
  getTestInviteUsername,
  createFeed,
  deleteFeed,
  updateFeed,
} from "../helpers/api";

test.describe("Feed Settings", () => {
  test("can view feed settings page", async ({ page, testFeed }) => {
    await page.goto(`/feeds/${testFeed.id}`);
    await expect(
      page.getByRole("heading", { name: testFeed.title }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("can delete a feed through the UI", async ({ page, testFeed }) => {
    await page.goto(`/feeds/${testFeed.id}`);
    await expect(
      page.getByRole("heading", { name: testFeed.title }),
    ).toBeVisible({ timeout: 10000 });

    // Open Feed Actions menu
    await page.getByRole("button", { name: "Feed Actions" }).click();

    // Click Delete menu item
    await page.getByRole("menuitem", { name: /delete/i }).click();

    // Confirm deletion in modal
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    // Verify redirect to feeds list
    await expect(page).toHaveURL("/feeds", { timeout: 10000 });

    // Verify success alert is shown
    await expect(
      page.getByText(
        new RegExp(`Successfully deleted feed.*${testFeed.title}`),
      ),
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

  test.describe("Copy Feed Settings", () => {
    async function clickCheckbox(
      page: import("@playwright/test").Page,
      name: string | RegExp,
    ) {
      const checkbox = page.getByRole("checkbox", { name });
      await checkbox.scrollIntoViewIfNeeded();
      await checkbox.click({ force: true });
    }

    async function navigateToFeedAndTab(
      page: import("@playwright/test").Page,
      feedTitle: string,
      tabName: "Settings" | "Comparisons" | "External Properties",
    ) {
      // Click Feeds breadcrumb to go to feeds list
      await page.getByRole("link", { name: "Feeds" }).click();
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

      // Click on the feed link in the table
      await page.getByRole("link", { name: feedTitle }).click();
      await expect(page.getByRole("tab", { name: tabName })).toBeVisible({
        timeout: 10000,
      });

      // Click the tab
      await page.getByRole("tab", { name: tabName }).click();
    }

    test("can copy subset of settings to selected feeds", async ({
      page,
      testFeed,
    }) => {
      const sourceFeed = testFeed;
      await updateFeed(page, sourceFeed.id, {
        userRefreshRateSeconds: 900,
        passingComparisons: ["title"],
        blockingComparisons: ["description"],
      });

      const targetFeed1 = await createFeed(page, {
        title: `Copy Target 1 ${sourceFeed.id}`,
      });
      const targetFeed2 = await createFeed(page, {
        title: `Copy Target 2 ${sourceFeed.id}`,
      });
      const targetFeed3 = await createFeed(page, {
        title: `Copy Target 3 ${sourceFeed.id}`,
      });

      try {
        await page.goto(`/feeds/${sourceFeed.id}`);
        await expect(
          page.getByRole("heading", { name: sourceFeed.title }),
        ).toBeVisible({ timeout: 10000 });

        await page.getByRole("button", { name: "Feed Actions" }).click();
        await page.getByRole("menuitem", { name: /copy settings to/i }).click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

        await clickCheckbox(page, "Refresh Rate");
        await clickCheckbox(page, "Passing Comparisons");

        await clickCheckbox(page, new RegExp(targetFeed1.title));
        await clickCheckbox(page, new RegExp(targetFeed2.title));

        await page
          .getByRole("button", { name: /Copy to 2 matching feeds/ })
          .click();

        await expect(
          page.getByText(/Successfully copied feed settings/i),
        ).toBeVisible({ timeout: 10000 });

        // Verify target feed 1 has copied settings via UI
        await navigateToFeedAndTab(page, targetFeed1.title, "Settings");
        await expect(
          page.locator('input[name="userRefreshRateMinutes"]'),
        ).toHaveValue("15", { timeout: 10000 });

        await page.getByRole("tab", { name: "Comparisons" }).click();
        await expect(
          page.getByRole("button", {
            name: /Delete passing comparison title/i,
          }),
        ).toBeVisible({ timeout: 10000 });
        await expect(
          page.getByRole("button", {
            name: /Delete blocking comparison description/i,
          }),
        ).not.toBeVisible();

        // Verify target feed 2 has copied settings via UI
        await navigateToFeedAndTab(page, targetFeed2.title, "Settings");
        await expect(
          page.locator('input[name="userRefreshRateMinutes"]'),
        ).toHaveValue("15", { timeout: 10000 });

        // Verify target feed 3 was NOT updated (not selected) - should have default value, not 15
        await navigateToFeedAndTab(page, targetFeed3.title, "Settings");
        await expect(
          page.locator('input[name="userRefreshRateMinutes"]'),
        ).not.toHaveValue("15", { timeout: 10000 });
      } finally {
        await deleteFeed(page, targetFeed1.id);
        await deleteFeed(page, targetFeed2.id);
        await deleteFeed(page, targetFeed3.id);
      }
    });

    test("can copy settings to all matching feeds", async ({
      page,
      testFeed,
    }) => {
      const sourceFeed = testFeed;
      await updateFeed(page, sourceFeed.id, {
        userRefreshRateSeconds: 600,
      });

      const targetFeed1 = await createFeed(page, {
        title: `Copy All Target 1 ${sourceFeed.id}`,
      });
      const targetFeed2 = await createFeed(page, {
        title: `Copy All Target 2 ${sourceFeed.id}`,
      });
      const targetFeed3 = await createFeed(page, {
        title: `Copy All Target 3 ${sourceFeed.id}`,
      });

      try {
        await page.goto(`/feeds/${sourceFeed.id}`);
        await expect(
          page.getByRole("heading", { name: sourceFeed.title }),
        ).toBeVisible({ timeout: 10000 });

        await page.getByRole("button", { name: "Feed Actions" }).click();
        await page.getByRole("menuitem", { name: /copy settings to/i }).click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

        await clickCheckbox(page, "Refresh Rate");
        await clickCheckbox(page, /Select all \d+ matching feeds/);

        await page
          .getByRole("button", { name: /Copy to \d+ matching feeds/ })
          .click();

        await expect(
          page.getByText(/Successfully copied feed settings/i),
        ).toBeVisible({ timeout: 10000 });

        // Verify all target feeds have copied settings via UI
        await navigateToFeedAndTab(page, targetFeed1.title, "Settings");
        await expect(
          page.locator('input[name="userRefreshRateMinutes"]'),
        ).toHaveValue("10", { timeout: 10000 });

        await navigateToFeedAndTab(page, targetFeed2.title, "Settings");
        await expect(
          page.locator('input[name="userRefreshRateMinutes"]'),
        ).toHaveValue("10", { timeout: 10000 });

        await navigateToFeedAndTab(page, targetFeed3.title, "Settings");
        await expect(
          page.locator('input[name="userRefreshRateMinutes"]'),
        ).toHaveValue("10", { timeout: 10000 });
      } finally {
        await deleteFeed(page, targetFeed1.id);
        await deleteFeed(page, targetFeed2.id);
        await deleteFeed(page, targetFeed3.id);
      }
    });

    test("can copy all settings at once", async ({ page, testFeed }) => {
      const sourceFeed = testFeed;
      const uniqueLabel = `img-${sourceFeed.id.slice(-8)}`;
      await updateFeed(page, sourceFeed.id, {
        userRefreshRateSeconds: 1200,
        passingComparisons: ["author"],
        blockingComparisons: ["link"],
        formatOptions: {
          dateFormat: "YYYY-MM-DD",
          dateTimezone: "America/New_York",
          dateLocale: "de",
        },
        dateCheckOptions: {
          oldArticleDateDiffMsThreshold: 604800000,
        },
        externalProperties: [
          {
            id: "ext-prop-1",
            sourceField: "link",
            label: uniqueLabel,
            cssSelector: "img",
          },
        ],
      });

      const targetFeed = await createFeed(page, {
        title: `Copy All Settings Target ${sourceFeed.id}`,
      });

      try {
        await page.goto(`/feeds/${sourceFeed.id}`);
        await expect(
          page.getByRole("heading", { name: sourceFeed.title }),
        ).toBeVisible({ timeout: 10000 });

        await page.getByRole("button", { name: "Feed Actions" }).click();
        await page.getByRole("menuitem", { name: /copy settings to/i }).click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

        await clickCheckbox(page, "External Properties");
        await clickCheckbox(page, "Passing Comparisons");
        await clickCheckbox(page, "Blocking Comparisons");
        await clickCheckbox(page, "Date Checks");
        await clickCheckbox(page, "Date Placeholder Settings");
        await clickCheckbox(page, "Refresh Rate");

        await clickCheckbox(page, new RegExp(targetFeed.title));

        await page
          .getByRole("button", { name: /Copy to 1 matching feed/ })
          .click();

        await expect(
          page.getByText(/Successfully copied feed settings/i),
        ).toBeVisible({ timeout: 10000 });

        // Verify settings via UI
        await navigateToFeedAndTab(page, targetFeed.title, "Settings");
        await expect(
          page.locator('input[name="userRefreshRateMinutes"]'),
        ).toHaveValue("20", { timeout: 10000 });
        await expect(page.locator('input[name="dateTimezone"]')).toHaveValue(
          "America/New_York",
          { timeout: 10000 },
        );
        await expect(page.locator('input[name="dateFormat"]')).toHaveValue(
          "YYYY-MM-DD",
          { timeout: 10000 },
        );
        await expect(page.locator('select[name="dateLocale"]')).toHaveValue(
          "de",
          { timeout: 10000 },
        );
        await expect(
          page.locator('input[name="oldArticleDateDiffMsThreshold"]'),
        ).toHaveValue("7", { timeout: 10000 });

        // Verify comparisons via UI
        await page.getByRole("tab", { name: "Comparisons" }).click();
        await expect(
          page.getByRole("button", {
            name: /Delete passing comparison author/i,
          }),
        ).toBeVisible({ timeout: 10000 });
        await expect(
          page.getByRole("button", {
            name: /Delete blocking comparison link/i,
          }),
        ).toBeVisible({ timeout: 10000 });

        // Verify external properties via UI
        await page.getByRole("tab", { name: "External Properties" }).click();
        await expect(
          page.getByRole("button", {
            name: /Delete selector/i,
          }),
        ).toBeVisible({ timeout: 10000 });
        await expect(page.locator(`input[value="${uniqueLabel}"]`)).toBeVisible(
          { timeout: 10000 },
        );
      } finally {
        await deleteFeed(page, targetFeed.id);
      }
    });

    test("search filters target feeds correctly", async ({
      page,
      testFeed,
    }) => {
      const sourceFeed = testFeed;
      const uniqueId = sourceFeed.id;
      await updateFeed(page, sourceFeed.id, {
        userRefreshRateSeconds: 300,
      });

      const alphaFeed = await createFeed(page, {
        title: `Alpha Test ${uniqueId}`,
      });
      const betaFeed = await createFeed(page, {
        title: `Beta Test ${uniqueId}`,
      });
      const gammaFeed = await createFeed(page, {
        title: `Gamma Test ${uniqueId}`,
      });

      try {
        await page.goto(`/feeds/${sourceFeed.id}`);
        await expect(
          page.getByRole("heading", { name: sourceFeed.title }),
        ).toBeVisible({ timeout: 10000 });

        await page.getByRole("button", { name: "Feed Actions" }).click();
        await page.getByRole("menuitem", { name: /copy settings to/i }).click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

        await clickCheckbox(page, "Refresh Rate");

        await page
          .getByPlaceholder("Search for target feeds")
          .fill(`Beta Test ${uniqueId}`);
        await page.getByRole("button", { name: "Search" }).click();

        await expect(
          page.getByRole("checkbox", {
            name: new RegExp(`Beta Test ${uniqueId}`),
          }),
        ).toBeVisible({ timeout: 10000 });

        await clickCheckbox(page, /Select all 1 matching feed/);

        await page
          .getByRole("button", { name: /Copy to 1 matching feed/ })
          .click();

        await expect(
          page.getByText(/Successfully copied feed settings/i),
        ).toBeVisible({ timeout: 10000 });

        // Verify beta feed has copied settings via UI
        await navigateToFeedAndTab(page, betaFeed.title, "Settings");
        await expect(
          page.locator('input[name="userRefreshRateMinutes"]'),
        ).toHaveValue("5", { timeout: 10000 });

        // Verify alpha feed was NOT updated (filtered out by search) - should have default value, not 5
        await navigateToFeedAndTab(page, alphaFeed.title, "Settings");
        await expect(
          page.locator('input[name="userRefreshRateMinutes"]'),
        ).not.toHaveValue("5", { timeout: 10000 });

        // Verify gamma feed was NOT updated (filtered out by search) - should have default value, not 5
        await navigateToFeedAndTab(page, gammaFeed.title, "Settings");
        await expect(
          page.locator('input[name="userRefreshRateMinutes"]'),
        ).not.toHaveValue("5", { timeout: 10000 });
      } finally {
        await deleteFeed(page, alphaFeed.id);
        await deleteFeed(page, betaFeed.id);
        await deleteFeed(page, gammaFeed.id);
      }
    });

    test("shows validation error when no settings selected", async ({
      page,
      testFeed,
    }) => {
      const targetFeed = await createFeed(page, {
        title: `Validation Target ${testFeed.id}`,
      });

      try {
        await page.goto(`/feeds/${testFeed.id}`);
        await expect(
          page.getByRole("heading", { name: testFeed.title }),
        ).toBeVisible({ timeout: 10000 });

        await page.getByRole("button", { name: "Feed Actions" }).click();
        await page.getByRole("menuitem", { name: /copy settings to/i }).click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

        await clickCheckbox(page, new RegExp(targetFeed.title));

        await page
          .getByRole("button", { name: /Copy to 1 matching feed/ })
          .click();

        await expect(
          page.getByText(/At least one setting must be selected/i),
        ).toBeVisible({ timeout: 10000 });
      } finally {
        await deleteFeed(page, targetFeed.id);
      }
    });

    test("shows validation error when no target feeds selected", async ({
      page,
      testFeed,
    }) => {
      await page.goto(`/feeds/${testFeed.id}`);
      await expect(
        page.getByRole("heading", { name: testFeed.title }),
      ).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: "Feed Actions" }).click();
      await page.getByRole("menuitem", { name: /copy settings to/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

      await clickCheckbox(page, "Refresh Rate");

      const copyButton = page.getByRole("button", {
        name: /Copy to 0 matching feeds/,
      });
      await expect(copyButton).toBeVisible({ timeout: 5000 });

      await copyButton.click();

      await expect(
        page.getByText(/At least one target feed must be selected/i),
      ).toBeVisible({ timeout: 10000 });
    });

    test("button shows correct count as feeds are selected", async ({
      page,
      testFeed,
    }) => {
      const targetFeed1 = await createFeed(page, {
        title: `Count Target 1 ${testFeed.id}`,
      });
      const targetFeed2 = await createFeed(page, {
        title: `Count Target 2 ${testFeed.id}`,
      });

      try {
        await page.goto(`/feeds/${testFeed.id}`);
        await expect(
          page.getByRole("heading", { name: testFeed.title }),
        ).toBeVisible({ timeout: 10000 });

        await page.getByRole("button", { name: "Feed Actions" }).click();
        await page.getByRole("menuitem", { name: /copy settings to/i }).click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

        await clickCheckbox(page, "Refresh Rate");

        await expect(
          page.getByRole("button", { name: /Copy to 0 matching feeds/ }),
        ).toBeVisible({ timeout: 5000 });

        await clickCheckbox(page, new RegExp(targetFeed1.title));

        await expect(
          page.getByRole("button", { name: /Copy to 1 matching feed/ }),
        ).toBeVisible({ timeout: 5000 });

        await clickCheckbox(page, new RegExp(targetFeed2.title));

        await expect(
          page.getByRole("button", { name: /Copy to 2 matching feeds/ }),
        ).toBeVisible({ timeout: 5000 });

        await clickCheckbox(page, new RegExp(targetFeed1.title));

        await expect(
          page.getByRole("button", { name: /Copy to 1 matching feed/ }),
        ).toBeVisible({ timeout: 5000 });
      } finally {
        await deleteFeed(page, targetFeed1.id);
        await deleteFeed(page, targetFeed2.id);
      }
    });
  });
});
