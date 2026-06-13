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
 * Complete the Reddit OAuth popup as a real user: click the connect button, then let the
 * popup run /api/v1/reddit/login -> the mock reddit authorize endpoint (no consent screen)
 * -> the backend callback (state validation + token exchange). The callback posts back to
 * the opener and closes the popup, so the popup's self-close is the completion signal.
 */
export async function connectRedditViaPopup(page: Page, connectButton: Locator): Promise<void> {
  const popupPromise = page.waitForEvent("popup");
  await connectButton.click();
  const popup = await popupPromise;

  try {
    // Generous timeout: the redirect chain spans the backend container and the
    // host-side mock reddit server, which is slow under parallel-worker CI load.
    await popup.waitForEvent("close", { timeout: 45000 });
  } catch (err) {
    // The popup can finish its redirect chain and close before the listener attaches.
    if (!popup.isClosed()) {
      throw new Error(
        `Reddit OAuth popup never closed (stuck on ${popup.url()})`,
        { cause: err },
      );
    }
  }
}
