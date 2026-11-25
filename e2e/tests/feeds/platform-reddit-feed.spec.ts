import { test, expect } from "../../fixtures/test-fixtures";
import { vendorMockExtendUrl } from "../../helpers/constants";
import { createConnection, deleteFeed, getTestChannelId, updateConnection } from "../../helpers/api";
import { connectReddit } from "../../helpers/reddit-oauth";
import {
  clearSupporterStatusInDb,
  getDiscordUserIdFromPage,
  setSupporterStatusInDb,
} from "../../helpers/paddle-db";

// Platform-source provider feeds (Reddit through the private package's
// redditofficial adapter): the user connects their Reddit account (mocked
// OAuth round trip), pastes a plain destination URL, and feed-requests routes
// it through the package's matcher to the adapter, which fetches oauth-style
// listing JSON with the user's stored grant and is pointed at the package's
// own vendor doubles (@synzen/platform-adapters/mock-vendor, mounted by
// scripts/vendor-mock.ts) via PLATFORM_SOURCE_REDDITOFFICIAL_BASE_URL in
// docker-compose.e2e.yml. The rest of the pipeline treats it like any other
// feed. The oauth double rejects Bearer-less requests, so the credential
// chain (store -> sweep -> batch item -> adapter) is exercised end to end.
// Vendor API shapes live in the private package — this spec only drives its
// control hooks.
//
// Opt-in (E2E_PLATFORM=1): these specs exercise the platform layer, which
// exists only when the private package is installed (NPM_TOKEN build). Public
// CI runs must not depend on it, so the specs skip unless explicitly opted in.

let subredditCounter = 0;

// A unique subreddit per test so parallel workers and repeated fetches never
// collide on feed URLs or feed-requests request rows. The adapter
// renders the channel title "Reddit r/<name> posts", so the feed title is
// predictable for assertions.
function uniquePlatformSubreddit(): { name: string; url: string; title: string } {
  const name = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${subredditCounter++}`;
  return {
    name,
    url: `https://www.reddit.com/r/${name}`,
    title: `Reddit r/${name} posts`,
  };
}

// The stack's schedule emitter fires 1-minute refresh-rate feeds every 30-90s
// (see retry-backoff.spec.ts), so delivery waits on real scheduler ticks.
const TICK_TIMEOUT = 240_000;

async function searchDiscoveryFor(page: import("@playwright/test").Page, url: string) {
  await page.goto("/feeds");
  await expect(
    page.getByRole("heading", { name: "Get news delivered to your Discord" }),
  ).toBeVisible({ timeout: 15000 });

  const searchInput = page.getByRole("textbox", {
    name: "Search popular feeds or paste a URL",
  });
  await searchInput.fill(url);
  await page.getByRole("button", { name: "Go", exact: true }).click();
}

// Reddit feed creation requires a connected grant, while URL validation stays
// open so discovery can show the connection prompt before a feed exists.
async function connectRedditForFeedTests(
  page: import("@playwright/test").Page,
) {
  await page.goto("/feeds");
  await expect(
    page.getByRole("button", { name: "Account settings" }),
  ).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Account settings" }).click();
  await page.getByRole("menuitem", { name: /account settings/i }).click();

  await connectReddit(
    page,
    page.getByRole("button", { name: "Connect Reddit" }),
  );

  await expect(page.getByText("Connected", { exact: true })).toBeVisible({
    timeout: 30000,
  });
}

test.describe("Platform reddit legacy compatibility", () => {
  test("previews legacy placeholders with recent production-style Reddit posts", async ({ page }, testInfo) => {
    testInfo.skip(
      process.env.E2E_PLATFORM !== "1" || process.env.E2E_REDDIT_COMPAT_FIXTURE !== "1",
      "Opt-in compatibility run: set E2E_PLATFORM=1 and E2E_REDDIT_COMPAT_FIXTURE=1",
    );
    test.setTimeout(240_000);

    const channelId = getTestChannelId();
    if (!channelId) { testInfo.skip(true, "No channelId configured"); return; }

    await connectRedditForFeedTests(page);
    const { name, url } = uniquePlatformSubreddit();
    await searchDiscoveryFor(page, url);
    const addButton = page.getByRole("button", { name: `Add Reddit r/${name} posts feed` });
    await expect(addButton).toBeVisible({ timeout: 30000 });
    await addButton.click();
    await expect(page.getByRole("heading", { name: /1 feed added!/ })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /View your feeds/ }).click();
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });
    await page.getByRole("link", { name: `Reddit r/${name} posts`, exact: true }).click();
    const feedId = page.url().match(/\/feeds\/([^/?]+)/)?.[1];
    expect(feedId, `feed id from ${page.url()}`).toBeTruthy();

    const connection = await createConnection(page, feedId as string, channelId);
    await updateConnection(page, feedId as string, connection.id, {
      content: "**{{title}}**\n{{description}}\nImage: {{image__url}}\nAnchor: {{extracted::description::anchor2}}",
      embeds: [{
        title: "{{title}}",
        url: "{{link}}",
        description: "{{description}}",
        image: { url: "{{image__url}}" },
        footer: { text: "u/{{author}}" },
      }],
      componentRows: [{
        id: "compat-actions",
        components: [{ id: "compat-link", type: 2, style: 5, label: "Open on Reddit", url: "{{link}}" }],
      }],
    });
    await page.goto(`/feeds/${feedId}/discord-channel-connections/${connection.id}/message-builder`);
    const welcomeDialog = page.getByRole("dialog", { name: "Welcome to your Message Builder!" });
    await expect(welcomeDialog).toBeVisible({ timeout: 10000 });
    await welcomeDialog.getByRole("button", { name: "Skip the message builder tour and start using the feature" }).click();
    await expect(welcomeDialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Previewing Article", { exact: true })).toBeVisible({ timeout: 15000 });

    const expectArticlePreview = async (title: string, author: string, image: boolean) => {
      await expect(page.getByText(`Previewing article: ${title}`, { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(new RegExp(`/?u/${author}`)).first()).toBeVisible();
      if (image) {
        await expect(page.getByRole("button", { name: "Open on Reddit" })).toBeVisible();
      }
      if (image) {
        await expect(page.locator('img[src*="redd.it/"]').first()).toHaveAttribute(
          "src",
          /redd\.it\//,
        );
      }
    };

    const previewAnotherArticle = async (title: string) => {
      await page.getByRole("button", { name: "Change Article" }).click();
      const select = page.getByRole("dialog", { name: "Select Article" });
      await select.getByText(title, { exact: true }).click();
      await expect(select).not.toBeVisible();
    };

    await previewAnotherArticle("Recent deal post");
    await expectArticlePreview("Recent deal post", "deal_finder", false);

    await previewAnotherArticle("Recent image post");
    await expectArticlePreview("Recent image post", "image_poster", true);

    await previewAnotherArticle("Recent gallery post");
    await expectArticlePreview("Recent gallery post", "gallery_poster", true);

    await previewAnotherArticle("Recent video post");
    await expectArticlePreview("Recent video post", "video_poster", true);

    await page.getByRole("button", { name: "Templates" }).click();
    const templateDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Browse Templates" }),
    });
    await expect(templateDialog).toBeVisible({ timeout: 15000 });
    await templateDialog.getByRole("radio", { name: /Rich Embed/ }).check({ force: true });
    const templatePreview = templateDialog.getByRole("region", { name: "Template preview" });
    await expect(templatePreview).toBeVisible();
    await templatePreview.getByRole("combobox", { name: "Preview article" }).selectOption({
      label: "Recent video post",
    });
    await expect(templatePreview.getByRole("link", { name: "View", exact: true })).toBeVisible({
      timeout: 30000,
    });
    const templateMessage = templatePreview
      .getByText("Template Preview", { exact: true })
      .locator("xpath=following-sibling::*[1]");
    await expect(templateMessage.getByText("Recent video post", { exact: true })).toBeVisible();
    await expect(templateMessage.getByRole("link", { name: "/u/video_poster" })).toBeVisible();
    await templateDialog.getByRole("button", { name: "Use this template" }).click();
    await expect(templateDialog).not.toBeVisible();

    await page.getByRole("button", { name: /Send to Discord/i }).click();
    await expect(
      page.getByRole("alert").getByText("Successfully sent article to Discord."),
    ).toBeVisible({ timeout: 30000 });

    await deleteFeed(page, feedId as string);
  });
});

test.describe("Platform reddit feed pipeline", () => {
  test("adds a subreddit feed with a connected Reddit grant and delivers the post once", async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      process.env.E2E_PLATFORM !== "1",
      "Opt-in platform run: set E2E_PLATFORM=1 with the private package installed (NPM_TOKEN build)",
    );
    test.setTimeout(600_000);

    const channelId = getTestChannelId();
    if (!channelId) {
      testInfo.skip(true, "No channelId configured");
      return;
    }

    const discordUserId = await getDiscordUserIdFromPage(page);

    // A non-supporter's article daily limit is 0, so nothing ever delivers;
    // grant supporter status before the feed is created and clean up after.
    await setSupporterStatusInDb(discordUserId);

    try {
      await connectRedditForFeedTests(page);

      const { name, url, title } = uniquePlatformSubreddit();
      const articleTitle = `${name} post two`;

      await searchDiscoveryFor(page, url);

      // Validation resolves through the provider with the connected grant.
      const addButton = page.getByRole("button", { name: `Add ${title} feed` });
      await expect(addButton).toBeVisible({ timeout: 30000 });
      await addButton.click();

      await expect(
        page.getByRole("heading", { name: /1 feed added!/ }),
      ).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: /View your feeds/ }).click();
      await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });

      // Fixture setup via API: the connection must exist before the first
      // scheduled tick, or the article gets recorded as seen with nowhere to go.
      await page.getByRole("link", { name: title, exact: true }).click();
      const feedId = page.url().match(/\/feeds\/([^/?]+)/)?.[1];
      expect(feedId, `feed id from ${page.url()}`).toBeTruthy();
      await createConnection(page, feedId as string, channelId);

      await page.getByRole("tab", { name: "Logs" }).click();
      const deliveryTable = page.locator(
        'table[aria-labelledby="delivery-history-table-title"]',
      );

      // The pipeline's FIRST fetch of a feed stores its articles without
      // delivering them (getArticlesToDeliver's first-run behavior), so
      // delivering anything requires a post that appears AFTER that first
      // fetch. Wait past the first scheduler tick (the emitter fires 1-minute
      // feeds every 30-90s), then flip the vendor double to also serve a
      // second post with its own canonical id.
      await page.waitForTimeout(120_000);
      await page.request.post(vendorMockExtendUrl("subreddit", name));

      // The new post is delivered to the mocked Discord channel, surfaced
      // through the feed's delivery history. The delivery-history table
      // fetches once on mount, so poll with reloads until the delivered row
      // renders.
      await expect(async () => {
        await page.reload();
        await expect(
          deliveryTable
            .getByRole("row")
            .filter({ hasText: articleTitle })
            .filter({ hasText: "Delivered" }),
        ).toBeVisible({ timeout: 15000 });
      }).toPass({ timeout: TICK_TIMEOUT });

      // Two more scheduler ticks must not re-deliver the same post: dedup keys
      // on the provider's canonical <guid>, which stays stable across fetches.
      // The first post is never delivered at all (stored by the first run).
      // The double's extend adds TWO posts (a gallery and a video), so this
      // feed's delivered rows are exactly those two, each once.
      await page.waitForTimeout(240_000);
      await page.reload();
      await expect(
        deliveryTable.getByRole("row").filter({ hasText: articleTitle }),
      ).toHaveCount(1);
      await expect(
        deliveryTable
          .getByRole("row")
          .filter({ hasText: "Delivered" })
          .filter({ hasText: name }),
      ).toHaveCount(2);

      await deleteFeed(page, feedId as string);
    } finally {
      await clearSupporterStatusInDb(discordUserId);
    }
  });

  test("a non-existent subreddit surfaces the not-found validation error", async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      process.env.E2E_PLATFORM !== "1",
      "Opt-in platform run: set E2E_PLATFORM=1 with the private package installed (NPM_TOKEN build)",
    );
    test.setTimeout(120_000);

    const { url } = uniquePlatformSubreddit();
    const missingUrl = url.replace("/r/e2e", "/r/missing-e2e");

    await searchDiscoveryFor(page, missingUrl);

    // The provider 404s -> BAD_STATUS_CODE(404) row -> FEED_NOT_FOUND through
    // the existing validation error path.
    await expect(page.getByText("Failed to validate feed")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByText(/Feed does not exist or is not accessible/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Add .+ feed$/i }),
    ).toHaveCount(0);
  });
});
