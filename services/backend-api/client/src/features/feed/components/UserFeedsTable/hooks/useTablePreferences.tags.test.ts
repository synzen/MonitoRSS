import { describe, expect, it } from "vitest";
import { buildColumnOrder } from "./useTablePreferences";

describe("buildColumnOrder", () => {
  it("adds the default-visible tags column to a saved pre-tags order", () => {
    expect(
      buildColumnOrder([
        "computedStatus",
        "title",
        "url",
        "createdAt",
        "refreshRateSeconds",
        "ownedByUser",
      ]),
    ).toEqual([
      "select",
      "computedStatus",
      "title",
      "url",
      "tags",
      "createdAt",
      "refreshRateSeconds",
      "ownedByUser",
      "configure",
    ]);
  });
});
