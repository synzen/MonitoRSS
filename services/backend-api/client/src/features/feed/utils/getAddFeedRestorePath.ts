import { pages } from "../../../constants";

/**
 * Deep link back into the add-feed modal on the feeds page. `?addFeed=` re-opens the
 * modal with the URL re-validated; `autoAdd` additionally attempts the add once
 * validation succeeds — used when the user had already clicked Add before being
 * gated on the Reddit connection.
 */
export const getAddFeedRestorePath = (
  url: string,
  workspaceSlug?: string,
  opts?: { autoAdd?: boolean },
): string => {
  const params = new URLSearchParams({ addFeed: url });

  if (opts?.autoAdd) {
    params.set("addFeedAuto", "1");
  }

  return `${pages.userFeeds(workspaceSlug ? { workspaceSlug } : undefined)}?${params.toString()}`;
};
