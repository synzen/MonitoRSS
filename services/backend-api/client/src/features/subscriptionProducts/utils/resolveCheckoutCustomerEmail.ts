// Decides which email a Paddle checkout is billed to, and whether it can
// proceed at all. A workspace checkout (custom data carries a workspaceId) is
// billed to the owner's verified email, never the Discord email; a personal
// checkout is billed to the Discord email. Either is blocked when its required
// address is missing, so the caller can route the user to set it.
export type CheckoutCustomerResolution =
  | { email: string }
  | { blocked: "verifiedEmailRequired" | "discordEmailRequired" };

export const resolveCheckoutCustomerEmail = ({
  customData,
  discordEmail,
  verifiedEmail,
}: {
  customData?: Record<string, string>;
  discordEmail?: string;
  verifiedEmail?: string;
}): CheckoutCustomerResolution => {
  if (customData?.workspaceId) {
    if (!verifiedEmail) {
      return { blocked: "verifiedEmailRequired" };
    }

    return { email: verifiedEmail };
  }

  if (!discordEmail) {
    return { blocked: "discordEmailRequired" };
  }

  return { email: discordEmail };
};
