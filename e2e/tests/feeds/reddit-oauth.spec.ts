import { test, expect } from "../../fixtures/test-fixtures";
import { getDiscordUserIdFromPage } from "../../helpers/paddle-db";
import { seedRevokedRedditCredentialInDb } from "../../helpers/reddit-db";
import { connectRedditViaPopup, uniqueSubreddit } from "../../helpers/reddit-oauth";

// Personal-scope Reddit OAuth through the real (mocked) popup flow: the connect button
// opens /api/v1/reddit/login, which round-trips the mock reddit server's authorize
// endpoint and the backend callback (session-stored state validation, token exchange),
// then posts back to the opener. Adding the feed afterwards proves the stored grant
// actually authenticates fetches: the mock serves subreddit RSS only to requests
// carrying a Bearer token it issued, and 403s everything else.

test.describe("Reddit OAuth (personal)", () => {
  test("connecting through the gate popup auto-retries and adds the subreddit feed", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const { url, title } = uniqueSubreddit();

    await page.goto("/feeds");
    await expect(
      page.getByRole("heading", { name: "Get news delivered to your Discord" }),
    ).toBeVisible({ timeout: 15000 });

    const searchInput = page.getByRole("textbox", {
      name: "Search popular feeds or paste a URL",
    });
    await searchInput.fill(url);
    await page.getByRole("button", { name: "Go", exact: true }).click();

    await expect(page.getByText("Connect your Reddit account to continue")).toBeVisible({
      timeout: 30000,
    });

    await connectRedditViaPopup(
      page,
      page.getByRole("button", { name: "Connect Reddit in popup window" }),
    );

    // The popup's completion auto-retries the blocked validation with the new grant:
    // the gate clears and the feed card appears without any further input.
    const addButton = page.getByRole("button", { name: /^Add .+ feed$/i }).first();
    await expect(addButton).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Connect your Reddit account to continue")).toHaveCount(0);

    await addButton.click();
    await expect(page.getByRole("heading", { name: /1 feed added!/ })).toBeVisible({
      timeout: 10000,
    });

    // The feed (titled from the authenticated fetch's channel title) is in the table.
    await page.getByRole("button", { name: /View your feeds/ }).click();
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
    // exact-named link: the row also renders the URL link, which contains the title.
    await expect(
      page.getByRole("table").getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
  });

  test("a dead connection shows the reconnect prompt and reconnecting revives feed adds", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const { url, title } = uniqueSubreddit();

    await page.goto("/feeds");
    await expect(
      page.getByRole("heading", { name: "Get news delivered to your Discord" }),
    ).toBeVisible({ timeout: 15000 });

    // A previously connected account whose grant has died (e.g. revoked at Reddit).
    const discordUserId = await getDiscordUserIdFromPage(page);
    await seedRevokedRedditCredentialInDb(discordUserId);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Get news delivered to your Discord" }),
    ).toBeVisible({ timeout: 15000 });

    const searchInput = page.getByRole("textbox", {
      name: "Search popular feeds or paste a URL",
    });
    await searchInput.fill(url);
    await page.getByRole("button", { name: "Go", exact: true }).click();

    // The gate distinguishes a dead connection from never-connected.
    await expect(page.getByText("Reconnect your Reddit account")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(/no longer active/i)).toBeVisible();

    await connectRedditViaPopup(
      page,
      page.getByRole("button", { name: "Reconnect Reddit in popup window" }),
    );

    const addButton = page.getByRole("button", { name: /^Add .+ feed$/i }).first();
    await expect(addButton).toBeVisible({ timeout: 30000 });

    await addButton.click();
    await expect(page.getByRole("heading", { name: /1 feed added!/ })).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: /View your feeds/ }).click();
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
    // exact-named link: the row also renders the URL link, which contains the title.
    await expect(
      page.getByRole("table").getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
  });

  test("connecting from the edit-feed dialog auto-retries the blocked save", async ({
    page,
    testFeed,
  }) => {
    test.setTimeout(90000);
    const { url } = uniqueSubreddit();

    await page.goto(`/feeds/${testFeed.id}`);
    await expect(page.getByRole("heading", { name: testFeed.title })).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: "Feed Actions" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();

    const editDialog = page.getByRole("dialog");
    const urlInput = editDialog.getByLabel("RSS Feed Link");
    await expect(urlInput).toBeVisible({ timeout: 10000 });
    await urlInput.fill(url);
    await editDialog.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Connect your Reddit account to continue")).toBeVisible({
      timeout: 30000,
    });

    await connectRedditViaPopup(
      page,
      page.getByRole("button", { name: "Connect Reddit in popup window" }),
    );

    // The dialog owns the retry on the connected edge: the blocked save re-runs with the
    // new grant and the dialog closes itself on success.
    await expect(editDialog).not.toBeVisible({ timeout: 30000 });

    // The URL change stuck: reopening the editor shows the subreddit URL.
    await page.getByRole("button", { name: "Feed Actions" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("dialog").getByLabel("RSS Feed Link")).toHaveValue(url, {
      timeout: 10000,
    });
  });
});
