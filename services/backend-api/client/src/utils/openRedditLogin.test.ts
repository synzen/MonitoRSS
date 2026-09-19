import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const replaceMock = vi.fn();

describe("openRedditLogin", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    vi.resetModules();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        pathname: "/feeds",
        search: "?sort=asc",
        replace: replaceMock,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const loadUtil = async () => (await import("./openRedditLogin")).openRedditLogin;

  it("navigates the current tab to the login URL with the current location as returnTo", async () => {
    const openRedditLogin = await loadUtil();

    openRedditLogin();

    expect(replaceMock).toHaveBeenCalledTimes(1);
    const [url] = replaceMock.mock.calls[0] as [string];
    expect(url.startsWith("/api/v1/reddit/login?")).toBe(true);
    const params = new URL(url, "https://example.com").searchParams;
    expect(params.get("returnTo")).toBe("/feeds?sort=asc");
    expect(params.has("workspaceId")).toBe(false);
  });

  it("includes the workspaceId when scoping the grant to a workspace", async () => {
    const openRedditLogin = await loadUtil();

    openRedditLogin("workspace-1");

    const [url] = replaceMock.mock.calls[0] as [string];
    const params = new URL(url, "https://example.com").searchParams;
    expect(params.get("workspaceId")).toBe("workspace-1");
    expect(params.get("returnTo")).toBe("/feeds?sort=asc");
  });

  it("prefers an explicit returnTo over the current location", async () => {
    const openRedditLogin = await loadUtil();

    openRedditLogin(undefined, "/workspaces/w/feeds?addFeed=https://reddit.com/r/news");

    const [url] = replaceMock.mock.calls[0] as [string];
    const params = new URL(url, "https://example.com").searchParams;
    expect(params.get("returnTo")).toBe("/workspaces/w/feeds?addFeed=https://reddit.com/r/news");
  });
});
