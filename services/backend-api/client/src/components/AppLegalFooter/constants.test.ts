import { describe, expect, it } from "vitest";
import { isOfficialMonitoRSSHost, LEGAL_IDENTITY_EFFECTIVE_AT } from "./constants";

describe("isOfficialMonitoRSSHost", () => {
  it.each(["monitorss.xyz", "my.monitorss.xyz", "staging.monitorss.xyz"])(
    "accepts the official host %s",
    (hostname) => {
      expect(isOfficialMonitoRSSHost(hostname)).toBe(true);
    },
  );

  it.each(["localhost", "monitorss.xyz.example.com", "monitorss.example"])(
    "rejects the self-hosted or lookalike host %s",
    (hostname) => {
      expect(isOfficialMonitoRSSHost(hostname)).toBe(false);
    },
  );
});

describe("LEGAL_IDENTITY_EFFECTIVE_AT", () => {
  // Must stay identical to LEGAL_NOTICES[0].effectiveAt, pinned in
  // test/features/legal-notices/legal-notices.data.test.ts. The client bundle
  // cannot import server sources, so the two literals are kept in sync by
  // review with these paired assertions as the tripwire.
  it("matches the scheduled notice effectiveAt", () => {
    expect(LEGAL_IDENTITY_EFFECTIVE_AT.toISOString()).toBe("2026-10-19T04:00:00.000Z");
  });
});
