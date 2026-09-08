import { describe, expect, it } from "vitest";
import { LegalNoticeSchema } from "./types";

describe("LegalNoticeSchema", () => {
  it("accepts the no-applicable-notice response", async () => {
    await expect(LegalNoticeSchema.validate({ result: null }, { strict: true })).resolves.toEqual({
      result: null,
    });
  });
});
