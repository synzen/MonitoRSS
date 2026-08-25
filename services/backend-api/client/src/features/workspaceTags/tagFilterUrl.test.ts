import { describe, expect, it } from "vitest";
import {
  filterWorkspaceTagIdsByCatalog,
  readWorkspaceTagFilter,
  writeWorkspaceTagFilter,
} from "./tagFilterUrl";

describe("workspace tag filter URL state", () => {
  it("serializes selected stable IDs without disturbing other view state", () => {
    const params = writeWorkspaceTagFilter(new URLSearchParams("search=release&tags=old"), [
      "tag-a",
      "tag-b",
      "tag-a",
    ]);

    expect(params.get("search")).toBe("release");
    expect(params.get("tags")).toBe("tag-a,tag-b");
  });

  it("restores IDs from canonical and repeated parameters and clears them", () => {
    const params = new URLSearchParams("tags=tag-a,tag-b&tags=tag-c");

    expect(readWorkspaceTagFilter(params)).toEqual(["tag-a", "tag-b", "tag-c"]);
    expect(writeWorkspaceTagFilter(params, [])).toEqual(new URLSearchParams());
  });

  it("drops deleted catalog IDs while retaining valid bookmarked selections", () => {
    expect(
      filterWorkspaceTagIdsByCatalog(["tag-a", "deleted-tag"], [{ id: "tag-a" }, { id: "tag-b" }]),
    ).toEqual(["tag-a"]);
  });
});
