import { describe, it, expect } from "vitest";
import { ApiErrorCode, getStandardErrorCodeMessage } from "./getStandardErrorCodeMessage";

const GENERIC_FALLBACK_FRAGMENT = "contact support@monitorss.xyz";

describe("getStandardErrorCodeMessage", () => {
  // The workspace billing endpoints return these codes; the user must see a
  // specific explanation, not the generic fallback.
  it.each([
    ["WORKSPACE_BILLING_NOT_CONFIGURED", ApiErrorCode.WORKSPACE_BILLING_NOT_CONFIGURED],
    ["WORKSPACE_INVALID_TIER", ApiErrorCode.WORKSPACE_INVALID_TIER],
  ])("returns a specific message for %s", (codeString, code) => {
    expect(code).toBe(codeString);

    const message = getStandardErrorCodeMessage(code);

    expect(message).toBeTruthy();
    expect(message).not.toContain(GENERIC_FALLBACK_FRAGMENT);
  });
});
