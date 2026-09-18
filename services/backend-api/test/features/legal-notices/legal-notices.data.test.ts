import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LEGAL_NOTICES } from "../../../src/features/legal-notices/legal-notices.data";

describe("LEGAL_NOTICES", () => {
  it("ships the scheduled 2026-10-19 update with valid document links", () => {
    assert.equal(LEGAL_NOTICES.length, 1);

    const notice = LEGAL_NOTICES[0];
    assert.ok(notice);
    assert.equal(notice.version, "2026-10-19");
    assert.equal(notice.displayAt.toISOString(), "2026-09-18T04:00:00.000Z");
    assert.equal(notice.effectiveAt.toISOString(), "2026-10-19T04:00:00.000Z");
    assert.deepEqual(
      notice.documents.map((document) => document.url),
      ["https://monitorss.xyz/legal/terms", "https://monitorss.xyz/legal/privacy"],
    );
  });
});
