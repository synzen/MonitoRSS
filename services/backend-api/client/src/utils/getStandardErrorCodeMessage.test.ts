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

  it.each([
    ApiErrorCode.WORKSPACE_PERSONAL_FEED_MOVE_CAPACITY_CHANGED,
    ApiErrorCode.WORKSPACE_PERSONAL_FEED_MOVE_FEED_MISSING,
    ApiErrorCode.WORKSPACE_PERSONAL_FEED_MOVE_MEMBERSHIP_CHANGED,
    ApiErrorCode.WORKSPACE_PERSONAL_FEED_MOVE_OWNERSHIP_CHANGED,
  ])("explains the atomic personal-feed move conflict %s", (code) => {
    const message = getStandardErrorCodeMessage(code);

    expect(message).toContain("No feeds were moved");
    expect(message).not.toContain(GENERIC_FALLBACK_FRAGMENT);
  });
});
