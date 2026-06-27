import { describe, it, expect } from "vitest";
import { resolveCheckoutCustomerEmail } from "./resolveCheckoutCustomerEmail";

describe("resolveCheckoutCustomerEmail", () => {
  it("bills a personal checkout to the Discord email", () => {
    const result = resolveCheckoutCustomerEmail({
      customData: { userId: "user-1" },
      discordEmail: "discord@example.com",
      verifiedEmail: "verified@example.com",
    });

    expect(result).toEqual({ email: "discord@example.com" });
  });

  it("bills a workspace checkout to the verified email", () => {
    const result = resolveCheckoutCustomerEmail({
      customData: { workspaceId: "workspace-1" },
      discordEmail: "discord@example.com",
      verifiedEmail: "verified@example.com",
    });

    expect(result).toEqual({ email: "verified@example.com" });
  });

  it("blocks a workspace checkout with no verified email", () => {
    const result = resolveCheckoutCustomerEmail({
      customData: { workspaceId: "workspace-1" },
      discordEmail: "discord@example.com",
      verifiedEmail: undefined,
    });

    expect(result).toEqual({ blocked: "verifiedEmailRequired" });
  });

  it("blocks a personal checkout with no Discord email", () => {
    const result = resolveCheckoutCustomerEmail({
      customData: { userId: "user-1" },
      discordEmail: undefined,
      verifiedEmail: "verified@example.com",
    });

    expect(result).toEqual({ blocked: "discordEmailRequired" });
  });
});
