import { ProductKey } from "./productKey";

/**
 * The user-facing plan names. The Paddle product keys (ProductKey) and the
 * billing logic keyed off them are unchanged; this is the display layer that
 * stops calling products "Tier 1/2/3". Free and Personal are the two personal
 * plans; the tier2/tier3/t3feed products are presented as one "Team" plan
 * family driven by a capacity slider. You buy a Team plan; you work in a
 * Workspace (the in-app container the plan unlocks).
 */
export enum PlanDisplayName {
  Free = "Free",
  Personal = "Personal",
  Team = "Team",
}

export const PLAN_DISPLAY_NAMES: Record<ProductKey, PlanDisplayName> = {
  [ProductKey.Free]: PlanDisplayName.Free,
  [ProductKey.Tier1]: PlanDisplayName.Personal,
  [ProductKey.Tier2]: PlanDisplayName.Team,
  [ProductKey.Tier3]: PlanDisplayName.Team,
  [ProductKey.Tier3Feed]: PlanDisplayName.Team,
};

export const getPlanDisplayName = (productKey: ProductKey): PlanDisplayName =>
  PLAN_DISPLAY_NAMES[productKey];

/**
 * The legacy "Tier N" label a product's Paddle invoices still literally show,
 * for the repackaged team products only. The display layer renamed these to
 * "Team", but historical receipts read "Tier 2"/"Tier 3"; this maps a product
 * key to that old label so the UI can reassure subscribers their invoices match.
 *
 * Only the repackaged team products carry a legacy label. Free and Personal
 * (Tier 1) never showed a "Tier N" invoice under a different name, so they have
 * none. The per-feed add-on (Tier3Feed) bills under the Tier 3 plan, so it maps
 * to the Tier 3 label.
 */
const LEGACY_INVOICE_LABELS: Partial<Record<ProductKey, string>> = {
  [ProductKey.Tier2]: "Tier 2",
  [ProductKey.Tier3]: "Tier 3",
  [ProductKey.Tier3Feed]: "Tier 3",
};

export const getLegacyInvoiceLabel = (productKey: ProductKey): string | undefined =>
  LEGACY_INVOICE_LABELS[productKey];
