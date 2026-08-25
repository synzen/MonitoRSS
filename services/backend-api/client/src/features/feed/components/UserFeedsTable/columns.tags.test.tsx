import { describe, expect, it } from "vitest";
import { createTableColumns } from "./columns";

function columnIds(options?: { excludeTags?: boolean }) {
  return createTableColumns("", undefined, options).map((column) => column.id);
}

describe("feed table tag column", () => {
  it("includes Tags in Team scope", () => {
    expect(columnIds()).toContain("tags");
  });

  it("omits Tags in personal scope", () => {
    expect(columnIds({ excludeTags: true })).not.toContain("tags");
  });
});
