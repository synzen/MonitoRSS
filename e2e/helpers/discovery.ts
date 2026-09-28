import { expect, type Page } from "../fixtures/test-fixtures";
import { MOCK_RSS_FEED_URL } from "./constants";

// Adds a feed through the discovery UI's URL search and returns once the
// discovery surface has actually closed (the feeds table is showing).
export async function addFeedViaDiscovery(page: Page): Promise<void> {
  // The discovery heading differs by scope ("...to your Discord" personal,
  // "Add feeds for your team" in a workspace); the search box is scope-agnostic,
  // so use it as the discovery-ready signal.
  const search = page.getByRole("textbox", {
    name: "Search popular feeds or paste a URL",
  });
  await expect(search).toBeVisible({ timeout: 15000 });
  await search.fill(MOCK_RSS_FEED_URL);
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await page
    .getByRole("button", { name: /^Add .+ feed$/i })
    .first()
    .click();

  // "View your feeds" only renders once the feed-creation request has
  // succeeded (the "N feeds added!" panel).
  const viewFeeds = page.getByRole("button", { name: /View your feeds/ });
  await expect(viewFeeds).toBeVisible();
  await viewFeeds.click();

  // The post-add list refetch re-renders the discovery panel around the
  // moment of the click, and the click can be swallowed by that re-render:
  // the feed is already in the list while the "feeds added" panel stays up,
  // latched open by the add-session state until a click lands. Retry until
  // the panel is actually gone.
  await expect(async () => {
    if (await viewFeeds.isVisible()) {
      await viewFeeds.click();
    }

    await expect(viewFeeds).toBeHidden();
  }).toPass({ timeout: 15000 });
}
