import { describe, expect, it } from "vitest";
import { isOfficialMonitoRSSHost } from "./constants";

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
