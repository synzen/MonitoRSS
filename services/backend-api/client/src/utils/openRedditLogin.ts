import { pages } from "../constants";

/**
 * Navigates the current tab through the Reddit OAuth round trip. The callback
 * redirects back to `returnTo` (defaults to the current location), so any
 * in-app page the flow was started from is restored as a fresh load.
 */
export const openRedditLogin = (workspaceId?: string, returnTo?: string) => {
  const params = new URLSearchParams();

  if (workspaceId) {
    params.set("workspaceId", workspaceId);
  }

  params.set("returnTo", returnTo ?? `${window.location.pathname}${window.location.search}`);

  window.location.replace(`${pages.loginReddit()}?${params.toString()}`);
};
