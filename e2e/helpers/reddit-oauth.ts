import type { Locator, Page } from "@playwright/test";

let subredditCounter = 0;

/**
 * A unique subreddit per call so parallel tests never collide on feed URLs. The mock reddit
 * server serves RSS for ANY /r/<name>/.rss path with the channel title "r/<name>", so the
 * created feed's title is predictable for table assertions.
 */
export function uniqueSubreddit(): { url: string; title: string } {
  const name = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${subredditCounter++}`;
  return { url: `https://www.reddit.com/r/${name}/.rss`, title: `r/${name}` };
}

/**
 * Complete the Reddit OAuth round trip as a real user, in the SAME tab: the click
 * navigates /api/v1/reddit/login -> the mock reddit authorize endpoint (no consent
 * screen) -> the backend callback (state validation + token exchange) -> a redirect back
 * into the app. The whole chain is server-side redirects behind one navigation, which
 * Playwright's click awaits; the load-state wait is belt-and-braces for slow CI.
 */
export async function connectReddit(page: Page, connectButton: Locator): Promise<void> {
  await connectButton.click({ timeout: 45000 });
  await page.waitForLoadState("load", { timeout: 45000 });
}
