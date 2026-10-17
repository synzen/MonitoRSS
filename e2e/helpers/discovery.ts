import { expect, type Page } from "../fixtures/test-fixtures";
import { MOCK_RSS_FEED_URL } from "./constants";

// Fills the discovery search box with a URL and submits it, retrying until the
// submit provably lands (awaitLanded resolves).
//
// Right after navigation — most often right after workspace creation — the
// workspaces/user-feeds queries are still resolving. When they land, the feeds
// page swaps between the empty-state and regular discovery layouts, remounting
// the search input and wiping in-progress text. A fill that gets wiped submits
// an empty query (which just clears), so without a retry the validation result
// never appears and the test times out.
export async function fillDiscoverySearchAndSubmit(
  page: Page,
  url: string,
  awaitLanded: () => Promise<void>,
): Promise<void> {
  // The discovery heading differs by scope, so the scope-agnostic search box
  // is the discovery-ready signal.
  const search = page.getByRole("textbox", {
    name: "Search popular feeds or paste a URL",
  });
  await expect(search).toBeVisible({ timeout: 15000 });

  await expect(async () => {
    await search.fill(url);
    // If a remount wiped the fill before React saw it, the submit below would
    // send an empty query — fail fast here so toPass retries the fill.
    await expect(search).toHaveValue(url, { timeout: 5000 });
    await page.getByRole("button", { name: "Go", exact: true }).click();
    // Proves the submit landed on a live input. A remount after the click wipes
    // both the input and the in-flight validation, so this fails and retries too.
    await awaitLanded();
  }).toPass({ timeout: 90000 });
}

export async function awaitUrlValidationAddButton(page: Page): Promise<void> {
  await expect(
    page.getByRole("button", { name: /^Add .+ feed$/i }).first(),
  ).toBeVisible({ timeout: 15000 });
}

// Adds a feed through the discovery UI's URL search and returns once the
// discovery surface has actually closed (the feeds table is showing).
export async function addFeedViaDiscovery(page: Page): Promise<void> {
  await fillDiscoverySearchAndSubmit(page, MOCK_RSS_FEED_URL, () =>
    awaitUrlValidationAddButton(page),
  );

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
