import { describe, expect, it } from "vitest";
import { LegalNoticeSchema } from "./types";

describe("LegalNoticeSchema", () => {
  it("accepts the no-applicable-notice response", async () => {
    await expect(
      LegalNoticeSchema.validate(
        {
          result: null,
          serverTime: "2026-09-01T00:00:00.000Z",
          nextTransitionAt: "2026-09-15T00:00:00.000Z",
        },
        { strict: true },
      ),
    ).resolves.toEqual({
      result: null,
      serverTime: "2026-09-01T00:00:00.000Z",
      nextTransitionAt: "2026-09-15T00:00:00.000Z",
    });
  });
});
