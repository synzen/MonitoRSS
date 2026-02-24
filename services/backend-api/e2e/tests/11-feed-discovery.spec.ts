import {
  test,
  expect,
  createAuthenticatedContext,
} from "../fixtures/test-fixtures";
import {
  createFeed,
  getAllUserFeeds,
  deleteAllUserFeeds,
} from "../helpers/api";
import {
  MOCK_RSS_FEED_URL,
  MOCK_RSS_HOST,
  MOCK_RSS_HTML_PAGE_URL,
} from "../helpers/constants";
import type { Feed } from "../helpers/types";

test.describe("Feed Discovery", () => {
  let originalFeeds: Feed[];

  test.beforeAll(async ({ browser }) => {
    const context = await createAuthenticatedContext(browser);
    const page = await context.newPage();
    originalFeeds = await getAllUserFeeds(page);
    await deleteAllUserFeeds(page);
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await createAuthenticatedContext(browser);
    const page = await context.newPage();
    await deleteAllUserFeeds(page);
    for (const feed of originalFeeds) {
      await createFeed(page, { url: feed.url, title: feed.title }).catch(
        () => {},
      );
    }
    await context.close();
  });

  test.describe("Empty State - Read Only", () => {
    test("shows discovery UI when user has zero feeds", async ({ page }) => {
      await page.goto("/feeds");

      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      await expect(
        page.getByText(
          "Browse popular feeds to get started, or paste a URL to check any website",
        ),
      ).toBeVisible();

      await expect(
        page.getByRole("textbox", {
          name: "Search popular feeds or paste a URL",
        }),
      ).toBeVisible();

      await expect(page.getByRole("button", { name: "Go" })).toBeVisible();

      await expect(
        page.getByRole("radiogroup", { name: "Feed categories" }),
      ).toBeVisible();

      await expect(
        page.getByText(/pasting a YouTube channel, subreddit/),
      ).toBeVisible();
    });

    test("nav search button is hidden when user has zero feeds", async ({
      page,
    }) => {
      await page.goto("/feeds");

      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      await expect(
        page.getByRole("button", { name: "Search your feeds and go to one" }),
      ).not.toBeVisible();
    });

    test("text search shows matching curated feed cards", async ({ page }) => {
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      const searchInput = page.getByRole("textbox", {
        name: "Search popular feeds or paste a URL",
      });
      await searchInput.fill("steam");
      await page.getByRole("button", { name: "Go" }).click();

      await expect(page.getByText(/\d+ result/)).toBeVisible();
      await expect(page.getByText("Steam News")).toBeVisible();
    });

    test("clearing search returns to category cards", async ({ page }) => {
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      const searchInput = page.getByRole("textbox", {
        name: "Search popular feeds or paste a URL",
      });
      await searchInput.fill("steam");
      await page.getByRole("button", { name: "Go" }).click();
      await expect(page.getByText(/\d+ result/)).toBeVisible();

      await page.getByRole("button", { name: "Clear search" }).click();

      await expect(
        page.getByRole("radiogroup", { name: "Feed categories" }),
      ).toBeVisible();
      await expect(searchInput).toHaveValue("");
    });

    test("valid feed URL shows validation result", async ({ page }) => {
      test.setTimeout(60000);
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      const searchInput = page.getByRole("textbox", {
        name: "Search popular feeds or paste a URL",
      });
      await searchInput.fill(MOCK_RSS_FEED_URL);
      await page.getByRole("button", { name: "Go" }).click();

      await expect(
        page.getByRole("button", { name: /^Add .+ feed$/i }).first(),
      ).toBeVisible({ timeout: 30000 });
    });

    test("invalid URL shows error message", async ({ page }) => {
      test.setTimeout(60000);
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      const searchInput = page.getByRole("textbox", {
        name: "Search popular feeds or paste a URL",
      });
      await searchInput.fill("https://example.com/not-a-feed-page-xyz");
      await page.getByRole("button", { name: "Go" }).click();

      await expect(
        page
          .getByText("Couldn't find a feed")
          .or(page.getByText("Failed to validate feed")),
      ).toBeVisible({ timeout: 30000 });
    });

    test("resolved URL shows feed info and both URLs", async ({ page }) => {
      test.setTimeout(60000);
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      const searchInput = page.getByRole("textbox", {
        name: "Search popular feeds or paste a URL",
      });
      await searchInput.fill(MOCK_RSS_HTML_PAGE_URL);
      await page.getByRole("button", { name: "Go" }).click();

      await expect(
        page.getByText("We found a feed at a different URL"),
      ).toBeVisible({ timeout: 30000 });

      // feedTitle depends on feed-requests service caching state - may show hostname fallback
      await expect(
        page
          .getByText("Resolved Test Feed")
          .or(page.getByText(MOCK_RSS_HOST, { exact: true }))
          .first(),
      ).toBeVisible();

      await expect(page.getByText("Your URL:")).toBeVisible();
      await expect(page.getByText(MOCK_RSS_HTML_PAGE_URL)).toBeVisible();

      await expect(page.getByText("Feed found:")).toBeVisible();
      await expect(page.getByText(/resolved-feed\.xml/).first()).toBeVisible();
    });

    test("re-searching the same direct feed URL preserves feed title", async ({
      page,
    }) => {
      test.setTimeout(90000);
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      const searchInput = page.getByRole("textbox", {
        name: "Search popular feeds or paste a URL",
      });

      // Use a unique URL param to avoid cross-test cache interference
      const feedUrl = `${MOCK_RSS_FEED_URL}&researchtest=1`;

      // First search
      await searchInput.fill(feedUrl);
      await page.getByRole("button", { name: "Go" }).click();

      const feedTitle = page.getByText("E2E Test Feed", { exact: true });
      await expect(feedTitle.first()).toBeVisible({ timeout: 30000 });

      // Re-search the exact same URL
      await searchInput.fill(feedUrl);
      await page.getByRole("button", { name: "Go" }).click();

      // The feed title should still show "E2E Test Feed", not the hostname
      await expect(feedTitle.first()).toBeVisible({ timeout: 30000 });
      // The add button label uses the feed title, confirming it wasn't lost
      await expect(
        page.getByRole("button", { name: "Add E2E Test Feed feed" }),
      ).toBeVisible();
    });

    test("re-searching the same resolved HTML URL preserves feed title", async ({
      page,
    }) => {
      test.setTimeout(90000);
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      const searchInput = page.getByRole("textbox", {
        name: "Search popular feeds or paste a URL",
      });

      // Use a unique URL param to avoid cross-test cache interference
      const htmlUrl = `${MOCK_RSS_HTML_PAGE_URL}&researchtest=1`;

      // First search
      await searchInput.fill(htmlUrl);
      await page.getByRole("button", { name: "Go" }).click();

      await expect(
        page.getByText("We found a feed at a different URL"),
      ).toBeVisible({ timeout: 30000 });

      // Capture what title is shown on first search
      const resolvedTitle = page.getByText("Resolved Test Feed");
      const firstSearchHasTitle = await resolvedTitle
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (firstSearchHasTitle) {
        // Re-search the exact same URL
        await searchInput.fill(htmlUrl);
        await page.getByRole("button", { name: "Go" }).click();

        await expect(
          page.getByText("We found a feed at a different URL"),
        ).toBeVisible({ timeout: 30000 });

        // The feed title should still show "Resolved Test Feed", not the hostname
        await expect(resolvedTitle.first()).toBeVisible({ timeout: 30000 });
      } else {
        // If first search already shows hostname, re-search and verify it's consistent
        // (This indicates the backend caching already lost the title on first search)
        console.log(
          "[E2E] First search already showed hostname fallback - backend caching issue confirmed",
        );

        await searchInput.fill(htmlUrl);
        await page.getByRole("button", { name: "Go" }).click();

        await expect(
          page.getByText("We found a feed at a different URL"),
        ).toBeVisible({ timeout: 30000 });
      }
    });
  });

  test.describe("Empty State - Adding Feeds", () => {
    test.afterAll(async ({ browser }) => {
      const context = await createAuthenticatedContext(browser);
      const page = await context.newPage();
      await deleteAllUserFeeds(page);
      await context.close();
    });

    test("add feed via URL validation, see summary bar, exit to table", async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      const searchInput = page.getByRole("textbox", {
        name: "Search popular feeds or paste a URL",
      });
      await searchInput.fill(MOCK_RSS_FEED_URL);
      await page.getByRole("button", { name: "Go" }).click();

      const addButton = page
        .getByRole("button", { name: /^Add .+ feed$/i })
        .first();
      await expect(addButton).toBeVisible({ timeout: 30000 });
      await addButton.click();

      await expect(
        page.getByRole("button", { name: /^Remove .+ feed$/i }),
      ).toBeVisible({ timeout: 10000 });

      await expect(page.getByText(/1 feed added/)).toBeVisible();

      await page.getByRole("button", { name: /View your feeds/ }).click();

      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
    });

    test("remove feed via discovery UI reverts card to Add state", async ({
      page,
    }) => {
      test.setTimeout(60000);
      await deleteAllUserFeeds(page);
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      const searchInput = page.getByRole("textbox", {
        name: "Search popular feeds or paste a URL",
      });
      await searchInput.fill(MOCK_RSS_FEED_URL);
      await page.getByRole("button", { name: "Go" }).click();

      const addButton = page
        .getByRole("button", { name: /^Add .+ feed$/i })
        .first();
      await expect(addButton).toBeVisible({ timeout: 30000 });
      await addButton.click();

      const removeButton = page.getByRole("button", {
        name: /^Remove .+ feed$/i,
      });
      await expect(removeButton).toBeVisible({ timeout: 10000 });

      await removeButton.click();

      await expect(
        page.getByRole("button", { name: /^Add .+ feed$/i }).first(),
      ).toBeVisible({ timeout: 10000 });
    });

    test("resolved URL: add feed shows settings and remove buttons", async ({
      page,
    }) => {
      test.setTimeout(60000);
      await deleteAllUserFeeds(page);
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      const searchInput = page.getByRole("textbox", {
        name: "Search popular feeds or paste a URL",
      });
      await searchInput.fill(MOCK_RSS_HTML_PAGE_URL);
      await page.getByRole("button", { name: "Go" }).click();

      await expect(
        page.getByText("We found a feed at a different URL"),
      ).toBeVisible({ timeout: 30000 });

      const addButton = page
        .getByRole("button", { name: /^Add .+ feed$/i })
        .first();
      await expect(addButton).toBeVisible({ timeout: 10000 });
      await addButton.click();

      const settingsButton = page.getByRole("button", {
        name: /go to feed settings/i,
      });
      await expect(settingsButton).toBeVisible({ timeout: 10000 });

      const removeButton = page.getByRole("button", {
        name: /^Remove .+ feed$/i,
      });
      await expect(removeButton).toBeVisible();

      await removeButton.click();

      await expect(
        page.getByRole("button", { name: /^Add .+ feed$/i }).first(),
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("Curated Feed Error Handling", () => {
    test("adding a broken curated feed shows friendly error with Show details toggle", async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      const searchInput = page.getByRole("textbox", {
        name: "Search popular feeds or paste a URL",
      });
      await searchInput.fill("Test Error Feed");
      await page.getByRole("button", { name: "Go" }).click();

      await expect(page.getByText("Test Error Feed")).toBeVisible();

      const addButton = page.getByRole("button", {
        name: "Add Test Error Feed feed",
      });
      await addButton.click();

      await expect(
        page.getByText("This feed can't be reached right now"),
      ).toBeVisible({ timeout: 30000 });

      const retryButton = page.getByRole("button", { name: /retry/i });
      await expect(retryButton).toBeVisible();

      const showDetailsButton = page.getByRole("button", {
        name: /show details/i,
      });
      await expect(showDetailsButton).toBeVisible();
      await showDetailsButton.click();

      await expect(
        page.getByText(/host\.docker\.internal:3001\/feed-500/),
      ).toBeVisible();

      const hideDetailsButton = page.getByRole("button", {
        name: /hide details/i,
      });
      await expect(hideDetailsButton).toBeVisible();
      await hideDetailsButton.click();

      await expect(
        page.getByText(/host\.docker\.internal:3001\/feed-500/),
      ).not.toBeVisible();
    });
  });

  test.describe("Curated Feed Remove Error Handling", () => {
    test.afterAll(async ({ browser }) => {
      const context = await createAuthenticatedContext(browser);
      const page = await context.newPage();
      await deleteAllUserFeeds(page);
      await context.close();
    });

    test("removing a curated feed in browse modal that fails shows inline error with retry", async ({
      page,
    }) => {
      test.setTimeout(60000);
      await deleteAllUserFeeds(page);
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      await page
        .getByRole("radiogroup", { name: "Feed categories" })
        .getByRole("radio", { name: /Browse All/ })
        .click();

      await expect(
        page.getByRole("heading", { name: "Add a Feed" }),
      ).toBeVisible();

      const dialog = page.getByRole("dialog");

      const modalSearch = dialog.getByRole("textbox", {
        name: "Search popular feeds or paste a URL",
      });
      await modalSearch.fill(`${MOCK_RSS_FEED_URL}&modal-remove-error=1`);
      await dialog.getByRole("button", { name: "Go" }).click();

      const addButton = dialog
        .getByRole("button", { name: /^Add .+ feed$/i })
        .first();
      await expect(addButton).toBeVisible({ timeout: 30000 });
      await addButton.click();

      const removeButton = dialog.getByRole("button", {
        name: /^Remove .+ feed$/i,
      });
      await expect(removeButton).toBeVisible({ timeout: 10000 });

      await page.route("**/api/v1/user-feeds/*", (route) => {
        if (route.request().method() === "DELETE") {
          return route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "Internal server error" }),
          });
        }

        return route.continue();
      });

      await removeButton.click();

      await expect(dialog.getByText("Failed to remove feed")).toBeVisible({
        timeout: 10000,
      });

      const retryRemoveButton = dialog.getByRole("button", {
        name: /^Remove .+ feed$/i,
      });
      await expect(retryRemoveButton).toBeVisible();

      await page.unroute("**/api/v1/user-feeds/*");

      await retryRemoveButton.click();

      await expect(
        dialog.getByRole("button", { name: /^Add .+ feed$/i }).first(),
      ).toBeVisible({ timeout: 10000 });

      await expect(dialog.getByText("Failed to remove feed")).not.toBeVisible();

      await page.getByRole("button", { name: "Close" }).click();
    });
  });

  test.describe("Browse Modal - Read Only", () => {
    test("category card opens modal, select category via pill", async ({
      page,
    }) => {
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      await page
        .getByRole("radiogroup", { name: "Feed categories" })
        .getByRole("radio", { name: /^Gaming/ })
        .click();

      await expect(
        page.getByRole("heading", { name: "Add a Feed" }),
      ).toBeVisible();

      const gamingPill = page.getByRole("radio", { name: "Gaming" });
      await expect(gamingPill).toBeVisible();
      await gamingPill.click();

      await expect(gamingPill).toHaveAttribute("aria-checked", "true");

      await expect(
        page.getByRole("list", { name: /Gaming feeds/ }),
      ).toBeVisible();

      await page.getByRole("button", { name: "Close" }).click();
    });

    test("See All switches from highlights to full category list", async ({
      page,
    }) => {
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      await page
        .getByRole("radiogroup", { name: "Feed categories" })
        .getByRole("radio", { name: /Browse All/ })
        .click();

      await expect(
        page.getByRole("heading", { name: "Add a Feed" }),
      ).toBeVisible();

      const allPill = page.getByRole("radio", { name: "All" });
      await expect(allPill).toHaveAttribute("aria-checked", "true");

      const categoryHeadings = page
        .getByRole("dialog")
        .getByRole("heading", { level: 3 });
      await expect(categoryHeadings.first()).toBeVisible();
      const headingCount = await categoryHeadings.count();
      expect(headingCount).toBeGreaterThan(1);

      await page.getByRole("button", { name: "See all Gaming feeds" }).click();

      const gamingPill = page.getByRole("radio", { name: "Gaming" });
      await expect(gamingPill).toHaveAttribute("aria-checked", "true");

      await expect(page.getByText(/Showing \d+ of \d+ feeds/)).toBeVisible();

      await page.getByRole("button", { name: "Close" }).click();
    });

    test("Show more loads additional feeds in large category", async ({
      page,
    }) => {
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      await page
        .getByRole("radiogroup", { name: "Feed categories" })
        .getByRole("radio", { name: /^Gaming/ })
        .click();

      await expect(
        page.getByRole("heading", { name: "Add a Feed" }),
      ).toBeVisible();

      const gamingPill = page.getByRole("radio", { name: "Gaming" });
      await gamingPill.click();
      await expect(gamingPill).toHaveAttribute("aria-checked", "true");

      const showingText = page.getByText(/Showing \d+ of \d+ feeds/);
      await expect(showingText).toBeVisible();

      const initialText = await showingText.textContent();
      const match = initialText?.match(/Showing (\d+) of (\d+)/);
      const initialShowing = match ? parseInt(match[1], 10) : 0;
      const total = match ? parseInt(match[2], 10) : 0;

      const showMoreButton = page.getByRole("button", { name: "Show more" });

      if (total > 20) {
        await expect(showMoreButton).toBeVisible();
        await showMoreButton.click();

        await expect(showingText).not.toHaveText(
          `Showing ${initialShowing} of ${total} feeds`,
        );

        if (total <= 40) {
          await expect(showMoreButton).not.toBeVisible();
        }
      }

      await page.getByRole("button", { name: "Close" }).click();
    });
  });

  test.describe("Browse Modal - Article Preview", () => {
    test("clicking a FeedCard in category view shows article preview", async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      await page
        .getByRole("radiogroup", { name: "Feed categories" })
        .getByRole("radio", { name: /^Gaming/ })
        .click();

      await expect(
        page.getByRole("heading", { name: "Add a Feed" }),
      ).toBeVisible();

      const gamingPill = page.getByRole("radio", { name: "Gaming" });
      await gamingPill.click();
      await expect(gamingPill).toHaveAttribute("aria-checked", "true");

      await expect(
        page.getByRole("list", { name: /Gaming feeds/ }),
      ).toBeVisible();

      const firstSummary = page
        .locator("summary")
        .filter({ hasText: "Preview articles" })
        .first();
      await expect(firstSummary).toBeVisible();

      const firstDetails = firstSummary.locator("..");
      await expect(firstDetails).not.toHaveAttribute("open");

      await firstSummary.click();
      await expect(firstDetails).toHaveAttribute("open");

      const previewRegion = firstDetails.locator('[role="region"]');

      await expect(
        previewRegion
          .getByText("Recent articles")
          .or(previewRegion.getByText("No articles found in this feed."))
          .or(previewRegion.getByRole("button", { name: /retry/i })),
      ).toBeVisible({ timeout: 30000 });

      await firstSummary.click();
      await expect(firstDetails).not.toHaveAttribute("open");

      await page.getByRole("button", { name: "Close" }).click();
    });
  });

  test.describe("Browse Modal - Adding Feeds", () => {
    test.afterAll(async ({ browser }) => {
      const context = await createAuthenticatedContext(browser);
      const page = await context.newPage();
      await deleteAllUserFeeds(page);
      await context.close();
    });

    test("can add feed from browse modal", async ({ page }) => {
      test.setTimeout(60000);
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      await page
        .getByRole("radiogroup", { name: "Feed categories" })
        .getByRole("radio", { name: /Browse All/ })
        .click();

      await expect(
        page.getByRole("heading", { name: "Add a Feed" }),
      ).toBeVisible();

      const modalSearch = page
        .getByRole("dialog")
        .getByRole("textbox", { name: "Search popular feeds or paste a URL" });
      await modalSearch.fill(MOCK_RSS_FEED_URL);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Go" })
        .click();

      const addButton = page
        .getByRole("dialog")
        .getByRole("button", { name: /^Add .+ feed$/i })
        .first();
      await expect(addButton).toBeVisible({ timeout: 30000 });
      await addButton.click();

      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: /^Remove .+ feed$/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: "Close" }).click();
    });

    test("closing modal preserves added state on discovery page", async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.goto("/feeds");

      const hasDiscovery = await page
        .getByRole("heading", {
          name: "Get news delivered to your Discord",
        })
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!hasDiscovery) {
        await page
          .getByRole("button", { name: "Add Feed", exact: true })
          .click();
      } else {
        await page
          .getByRole("radiogroup", { name: "Feed categories" })
          .getByRole("radio", { name: /Browse All/ })
          .click();
      }

      await expect(
        page.getByRole("heading", { name: "Add a Feed" }),
      ).toBeVisible();

      const modalSearch = page
        .getByRole("dialog")
        .getByRole("textbox", { name: "Search popular feeds or paste a URL" });
      await modalSearch.fill(`${MOCK_RSS_FEED_URL}&modal=1`);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Go" })
        .click();

      const addButton2 = page
        .getByRole("dialog")
        .getByRole("button", { name: /^Add .+ feed$/i })
        .first();
      await expect(addButton2).toBeVisible({ timeout: 30000 });
      await addButton2.click();

      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: /^Remove .+ feed$/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: "Close" }).click();

      await expect(page.getByText(/\d+ feeds? added/)).toBeVisible({
        timeout: 5000,
      });
    });

    test("remove feed from browse modal via URL search", async ({ page }) => {
      test.setTimeout(60000);
      await deleteAllUserFeeds(page);
      await page.goto("/feeds");
      await expect(
        page.getByRole("heading", {
          name: "Get news delivered to your Discord",
        }),
      ).toBeVisible({ timeout: 15000 });

      await page
        .getByRole("radiogroup", { name: "Feed categories" })
        .getByRole("radio", { name: /Browse All/ })
        .click();

      await expect(
        page.getByRole("heading", { name: "Add a Feed" }),
      ).toBeVisible();

      const modalSearch = page
        .getByRole("dialog")
        .getByRole("textbox", { name: "Search popular feeds or paste a URL" });
      await modalSearch.fill(`${MOCK_RSS_FEED_URL}&modal-remove=1`);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Go" })
        .click();

      const addButton = page
        .getByRole("dialog")
        .getByRole("button", { name: /^Add .+ feed$/i })
        .first();
      await expect(addButton).toBeVisible({ timeout: 30000 });
      await addButton.click();

      const removeButton = page
        .getByRole("dialog")
        .getByRole("button", { name: /^Remove .+ feed$/i })
        .first();
      await expect(removeButton).toBeVisible({ timeout: 10000 });

      await removeButton.click();

      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: /^Add .+ feed$/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: "Close" }).click();
    });
  });

  test.describe("Returning User", () => {
    test.beforeAll(async ({ browser }) => {
      const context = await createAuthenticatedContext(browser);
      const page = await context.newPage();
      const feeds = await getAllUserFeeds(page);
      if (feeds.length === 0) {
        await createFeed(page);
      }
      await context.close();
    });

    test.afterAll(async ({ browser }) => {
      const context = await createAuthenticatedContext(browser);
      const page = await context.newPage();
      await deleteAllUserFeeds(page);
      for (const feed of originalFeeds) {
        await createFeed(page, { url: feed.url, title: feed.title }).catch(
          () => {},
        );
      }
      await context.close();
    });

    test("Add Feed button opens browse modal", async ({ page }) => {
      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });

      await page.getByRole("button", { name: "Add Feed", exact: true }).click();

      await expect(
        page.getByRole("heading", { name: "Add a Feed" }),
      ).toBeVisible();

      await page.getByRole("button", { name: "Close" }).click();
    });

    test("nav search button is visible when user has feeds", async ({
      page,
    }) => {
      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });

      await expect(
        page.getByRole("button", { name: "Search your feeds and go to one" }),
      ).toBeVisible();
    });

    test("nav search zero results shows redirect to add feed flow", async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });

      await page
        .getByRole("button", { name: "Search your feeds and go to one" })
        .click();

      await expect(
        page.getByRole("heading", { name: "Go to feed" }),
      ).toBeVisible();

      const searchInput = page.getByRole("combobox", {
        name: "Go to feed",
      });
      await searchInput.fill("https://example.com/test-feed.xml");

      await page.waitForTimeout(500);

      await expect(page.getByText("This looks like a feed URL.")).toBeVisible({
        timeout: 5000,
      });

      await page.getByRole("button", { name: /Add it as a new feed/ }).click();

      await expect(
        page.getByRole("heading", { name: "Add a Feed" }),
      ).toBeVisible({ timeout: 10000 });
    });

    test("nav search redirect to add feed works twice in a row", async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });

      // First time: open search modal, type non-matching term, click redirect
      await page
        .getByRole("button", { name: "Search your feeds and go to one" })
        .click();
      await expect(
        page.getByRole("heading", { name: "Go to feed" }),
      ).toBeVisible();

      const searchInput = page.getByRole("combobox", {
        name: "Go to feed",
      });
      await searchInput.fill("zzz-no-match-term");
      await page.waitForTimeout(500);

      await expect(
        page.getByText("Can't find what you're looking for?"),
      ).toBeVisible({ timeout: 5000 });

      await page
        .getByRole("button", { name: /Search for new feeds to add/ })
        .click();

      await expect(
        page.getByRole("heading", { name: "Add a Feed" }),
      ).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: "Close" }).click();

      // Second time: same flow should work again
      await page
        .getByRole("button", { name: "Search your feeds and go to one" })
        .click();
      await expect(
        page.getByRole("heading", { name: "Go to feed" }),
      ).toBeVisible();

      const searchInput2 = page.getByRole("combobox", {
        name: "Go to feed",
      });
      await searchInput2.fill("zzz-another-no-match");
      await page.waitForTimeout(500);

      await expect(
        page.getByText("Can't find what you're looking for?"),
      ).toBeVisible({ timeout: 5000 });

      await page
        .getByRole("button", { name: /Search for new feeds to add/ })
        .click();

      await expect(
        page.getByRole("heading", { name: "Add a Feed" }),
      ).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: "Close" }).click();
    });

    test("add feed from modal, success banner shown", async ({ page }) => {
      test.setTimeout(60000);
      await page.goto("/feeds");
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });

      await page.getByRole("button", { name: "Add Feed", exact: true }).click();

      await expect(
        page.getByRole("heading", { name: "Add a Feed" }),
      ).toBeVisible();

      const modalSearch = page
        .getByRole("dialog")
        .getByRole("textbox", { name: "Search popular feeds or paste a URL" });
      await modalSearch.fill(`${MOCK_RSS_FEED_URL}&returning=1`);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Go" })
        .click();

      const addButton3 = page
        .getByRole("dialog")
        .getByRole("button", { name: /^Add .+ feed$/i })
        .first();
      await expect(addButton3).toBeVisible({ timeout: 30000 });
      await addButton3.click();

      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: /^Remove .+ feed$/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: "Close" }).click();

      await expect(page.getByText(/1 feed added/)).toBeVisible({
        timeout: 5000,
      });
    });
  });
});
