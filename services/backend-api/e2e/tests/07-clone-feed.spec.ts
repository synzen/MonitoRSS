import { test, expect } from "../fixtures/test-fixtures";
import {
  getTestChannelId,
  createConnection,
  deleteFeed,
  updateFeed,
  updateConnection,
} from "../helpers/api";

test.describe("Clone Feed", () => {
  test("can clone a feed with all settings and connections through the UI", async ({
    page,
    testFeed,
  }) => {
    const channelId = getTestChannelId();
    test.skip(!channelId, "channelId must be configured in e2econfig.json");

    const uniqueLabel = `extprop-${testFeed.id.slice(-8)}`;

    // Set up extensive feed settings via API
    await updateFeed(page, testFeed.id, {
      userRefreshRateSeconds: 1800,
      passingComparisons: ["title", "author"],
      blockingComparisons: ["link"],
      formatOptions: {
        dateFormat: "YYYY-MM-DD HH:mm",
        dateTimezone: "Europe/London",
        dateLocale: "fr",
      },
      dateCheckOptions: {
        oldArticleDateDiffMsThreshold: 604800000, // 7 days in ms
      },
      externalProperties: [
        {
          id: "ext-prop-clone-1",
          sourceField: "link",
          label: uniqueLabel,
          cssSelector: "img.main",
        },
      ],
    });

    // Create a connection with custom settings
    const connectionName = `Clone Test Connection ${Date.now()}`;
    const connection = await createConnection(page, testFeed.id, channelId!, {
      name: connectionName,
    });

    // Add filters, rate limits, and custom placeholders to the connection
    await updateConnection(page, testFeed.id, connection.id, {
      filters: {
        expression: {
          type: "LOGICAL",
          op: "AND",
          children: [
            {
              type: "RELATIONAL",
              op: "CONTAINS",
              left: { type: "ARTICLE", value: "title" },
              right: { type: "STRING", value: "clone-test-filter" },
            },
          ],
        },
      },
      rateLimits: [{ timeWindowSeconds: 300, limit: 10 }],
      customPlaceholders: [
        {
          id: "cp-clone-feed-1",
          referenceName: "clonedFeedPlaceholder",
          sourcePlaceholder: "{{title}}",
          steps: [{ id: "step-1", type: "UPPERCASE" }],
        },
      ],
    });

    let clonedFeedId: string | undefined;

    try {
      // Navigate to the feed page
      await page.goto(`/feeds/${testFeed.id}`);
      await expect(
        page.getByRole("heading", { name: testFeed.title }),
      ).toBeVisible({ timeout: 10000 });

      // Open Feed Actions menu and click Clone
      await page.getByRole("button", { name: "Feed Actions" }).click();
      await page.getByRole("menuitem").filter({ hasText: "Clone" }).click();

      // Verify clone dialog appears
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

      // Click Clone button in the dialog
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Clone", exact: true })
        .click();

      // Wait for success message and click "View cloned feed" link
      const successAlert = page.getByRole("alert");
      await expect(successAlert).toContainText("Successfully cloned feed", {
        timeout: 30000,
      });

      const viewClonedFeedLink = page.getByRole("link", {
        name: "View cloned feed",
      });
      await expect(viewClonedFeedLink).toBeVisible({ timeout: 10000 });

      // Extract cloned feed ID from the link for cleanup
      const clonedFeedUrl = await viewClonedFeedLink.getAttribute("href");
      const match = clonedFeedUrl?.match(/\/feeds\/([^/?]+)/);
      clonedFeedId = match?.[1];

      // Navigate to feeds list via breadcrumb, then find the cloned feed
      await page.getByRole("link", { name: "Feeds" }).click();
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

      // Click on the cloned feed link (it has the same title as the original)
      await page.getByRole("link", { name: testFeed.title }).first().click();

      // Wait for navigation to cloned feed page
      await expect(page.getByRole("tab", { name: "Settings" })).toBeVisible({
        timeout: 10000,
      });

      // Verify Settings tab values
      await page.getByRole("tab", { name: "Settings" }).click();

      await expect(
        page.locator('input[name="userRefreshRateMinutes"]'),
      ).toHaveValue("30", { timeout: 10000 });

      await expect(page.locator('input[name="dateTimezone"]')).toHaveValue(
        "Europe/London",
        { timeout: 10000 },
      );

      await expect(page.locator('input[name="dateFormat"]')).toHaveValue(
        "YYYY-MM-DD HH:mm",
        { timeout: 10000 },
      );

      await expect(page.locator('select[name="dateLocale"]')).toHaveValue(
        "fr",
        {
          timeout: 10000,
        },
      );

      await expect(
        page.locator('input[name="oldArticleDateDiffMsThreshold"]'),
      ).toHaveValue("7", { timeout: 10000 });

      // Verify Comparisons tab
      await page.getByRole("tab", { name: "Comparisons" }).click();

      await expect(
        page.getByRole("button", { name: /Delete passing comparison title/i }),
      ).toBeVisible({ timeout: 10000 });

      await expect(
        page.getByRole("button", { name: /Delete passing comparison author/i }),
      ).toBeVisible({ timeout: 10000 });

      await expect(
        page.getByRole("button", { name: /Delete blocking comparison link/i }),
      ).toBeVisible({ timeout: 10000 });

      // Verify External Properties tab
      await page.getByRole("tab", { name: "External Properties" }).click();

      await expect(
        page.getByRole("button", { name: /Delete selector/i }),
      ).toBeVisible({ timeout: 10000 });

      await expect(page.locator(`input[value="${uniqueLabel}"]`)).toBeVisible({
        timeout: 10000,
      });

      // Verify Connections tab - connection should be cloned
      await page.getByRole("tab", { name: "Connections" }).click();

      const connectionLink = page.getByRole("link", { name: connectionName });
      await expect(connectionLink).toBeVisible({ timeout: 10000 });

      // Navigate to the cloned connection
      await connectionLink.click();

      await expect(
        page.getByRole("heading", { name: connectionName }),
      ).toBeVisible({ timeout: 10000 });

      // Verify connection filters
      await page.getByRole("tab", { name: "Article Filters" }).click();
      await expect(
        page.locator('input[value="clone-test-filter"]'),
      ).toBeVisible({ timeout: 10000 });

      // Verify connection rate limits
      await page.getByRole("tab", { name: "Delivery Rate Limits" }).click();
      await expect(page.locator('input[value="10"]')).toBeVisible({
        timeout: 10000,
      });

      // Verify connection custom placeholders
      await page.getByRole("tab", { name: "Custom Placeholders" }).click();
      await expect(page.getByText("clonedFeedPlaceholder").first()).toBeVisible(
        { timeout: 10000 },
      );
    } finally {
      // Clean up cloned feed
      if (clonedFeedId) {
        await deleteFeed(page, clonedFeedId).catch(() => {});
      }
    }
  });

  test("clone dialog shows original feed title and URL", async ({
    page,
    testFeed,
  }) => {
    await page.goto(`/feeds/${testFeed.id}`);
    await expect(
      page.getByRole("heading", { name: testFeed.title }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Feed Actions" }).click();
    await page.getByRole("menuitem").filter({ hasText: "Clone" }).click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

    // Verify the dialog shows the feed title (first input is title)
    const titleInput = page.getByRole("dialog").locator("input").first();
    await expect(titleInput).toHaveValue(testFeed.title, { timeout: 10000 });

    // Verify the dialog shows the feed URL (second input is URL)
    const urlInput = page.getByRole("dialog").locator("input").nth(1);
    await expect(urlInput).toHaveValue(testFeed.url, { timeout: 10000 });
  });

  test("can clone feed with custom title", async ({ page, testFeed }) => {
    let clonedFeedId: string | undefined;

    try {
      await page.goto(`/feeds/${testFeed.id}`);
      await expect(
        page.getByRole("heading", { name: testFeed.title }),
      ).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: "Feed Actions" }).click();
      await page.getByRole("menuitem").filter({ hasText: "Clone" }).click();

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

      // Change the title to a custom value - use the first input in dialog (title field)
      const customTitle = `Custom Cloned Feed ${Date.now()}`;
      const titleInput = page.getByRole("dialog").locator("input").first();
      await titleInput.clear();
      await titleInput.fill(customTitle);

      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Clone", exact: true })
        .click();

      // Wait for success and navigate to cloned feed
      const successAlert = page
        .getByRole("alert")
        .filter({ hasText: "Successfully cloned feed" });
      await expect(successAlert).toBeVisible({ timeout: 30000 });

      const viewClonedFeedLink = page.getByRole("link", {
        name: "View cloned feed",
      });

      const clonedFeedUrl = await viewClonedFeedLink.getAttribute("href");
      const match = clonedFeedUrl?.match(/\/feeds\/([^/?]+)/);
      clonedFeedId = match?.[1];

      // Navigate to feeds list via breadcrumb, then find the cloned feed
      await page.getByRole("link", { name: "Feeds" }).click();
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

      // Click on the cloned feed link with custom title
      await page.getByRole("link", { name: customTitle }).click();

      // Verify the cloned feed has the custom title
      await expect(
        page.getByRole("heading", { name: customTitle }),
      ).toBeVisible({ timeout: 10000 });
    } finally {
      if (clonedFeedId) {
        await deleteFeed(page, clonedFeedId).catch(() => {});
      }
    }
  });

  test("clone preserves date format settings", async ({ page, testFeed }) => {
    // Set up specific date format settings
    await updateFeed(page, testFeed.id, {
      formatOptions: {
        dateFormat: "DD/MM/YYYY",
        dateTimezone: "Asia/Tokyo",
        dateLocale: "ja",
      },
    });

    let clonedFeedId: string | undefined;

    try {
      await page.goto(`/feeds/${testFeed.id}`);
      await expect(
        page.getByRole("heading", { name: testFeed.title }),
      ).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: "Feed Actions" }).click();
      await page.getByRole("menuitem").filter({ hasText: "Clone" }).click();

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Clone", exact: true })
        .click();

      const successAlert = page
        .getByRole("alert")
        .filter({ hasText: "Successfully cloned feed" });
      await expect(successAlert).toBeVisible({ timeout: 30000 });

      const viewClonedFeedLink = page.getByRole("link", {
        name: "View cloned feed",
      });

      const clonedFeedUrl = await viewClonedFeedLink.getAttribute("href");
      const match = clonedFeedUrl?.match(/\/feeds\/([^/?]+)/);
      clonedFeedId = match?.[1];

      // Navigate to feeds list via breadcrumb, then find the cloned feed
      await page.getByRole("link", { name: "Feeds" }).click();
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

      // Click on the cloned feed link (it has the same title as the original)
      await page.getByRole("link", { name: testFeed.title }).first().click();

      // Navigate to Settings tab
      await page.getByRole("tab", { name: "Settings" }).click();

      // Verify date format settings were preserved
      await expect(page.locator('input[name="dateFormat"]')).toHaveValue(
        "DD/MM/YYYY",
        { timeout: 10000 },
      );

      await expect(page.locator('input[name="dateTimezone"]')).toHaveValue(
        "Asia/Tokyo",
        { timeout: 10000 },
      );

      await expect(page.locator('select[name="dateLocale"]')).toHaveValue(
        "ja",
        {
          timeout: 10000,
        },
      );
    } finally {
      if (clonedFeedId) {
        await deleteFeed(page, clonedFeedId).catch(() => {});
      }
    }
  });
});
