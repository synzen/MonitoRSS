import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserFeeds } from "./getUserFeeds";

const fetchRestMock = vi.hoisted(() => vi.fn());

vi.mock("../../../utils/fetchRest", () => ({
  default: fetchRestMock,
}));

describe("getUserFeeds tag filters", () => {
  beforeEach(() => {
    fetchRestMock.mockResolvedValue({
      results: [],
      total: 0,
      feedsWithoutConnections: 0,
    });
  });

  it("serializes tag IDs as a server filter while preserving title/URL search", async () => {
    await getUserFeeds({
      search: "release",
      workspaceId: "workspace-a",
      filters: { tagIds: ["tag-a", "tag-b"] },
    });

    const [path] = fetchRestMock.mock.calls[0] as [string];
    const params = new URLSearchParams(path.split("?")[1]);

    expect(params.get("search")).toBe("release");
    expect(params.get("filters[tagIds]")).toBe("tag-a,tag-b");
    expect(params.get("workspaceId")).toBe("workspace-a");
    expect(params.get("filters[computedStatuses]")).toBe("");
  });
});
