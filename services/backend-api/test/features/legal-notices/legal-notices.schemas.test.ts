import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LegalNoticeSchema } from "../../../src/features/legal-notices/legal-notices.schemas";

const validNotice = {
  version: "2026-09-01",
  displayAt: "2026-09-01T00:00:00.000Z",
  effectiveAt: "2026-09-15T00:00:00.000Z",
  summary: "We updated our legal documents.",
  documents: [{ type: "terms", url: "https://monitorss.xyz/terms" }],
};

describe("LegalNoticeSchema", () => {
  it("accepts a versioned notice with recognized HTTPS documents", () => {
    assert.equal(LegalNoticeSchema.safeParse(validNotice).success, true);
  });

  const invalidNotices = [
    [{ ...validNotice, version: "September 2026" }],
    [{ ...validNotice, displayAt: "not-a-timestamp" }],
    [{ ...validNotice, effectiveAt: "2026-09-15" }],
    [{ ...validNotice, displayAt: "2026-09-16T00:00:00.000Z" }],
    [{ ...validNotice, summary: "  " }],
    [{ ...validNotice, documents: [] }],
    [{ ...validNotice, documents: [{ type: "other", url: "https://example.com" }] }],
    [{ ...validNotice, documents: [{ type: "terms", url: "http://example.com" }] }],
    [{ ...validNotice, documents: [{ type: "terms", url: "https://example.com/a" }, { type: "terms", url: "https://example.com/b" }] }],
  ];

  for (const [notice] of invalidNotices) {
    it("rejects invalid notice configuration", () => {
      assert.equal(LegalNoticeSchema.safeParse(notice).success, false);
    });
  }
});
