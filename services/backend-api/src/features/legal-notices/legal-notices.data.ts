import { LegalNoticesSchema, type LegalNotices } from "./legal-notices.schemas";

// Scheduled through the schema at import so an invalid entry fails fast at
// boot. Exposure is gated by canExposeLegalNotices in the handlers: production
// serves these only on the hosted dashboard hostname, so self-hosted instances
// never render them regardless of this array.
export const LEGAL_NOTICES: LegalNotices = LegalNoticesSchema.parse([
  {
    version: "2026-10-19",
    displayAt: "2026-09-18T00:00:00-04:00",
    effectiveAt: "2026-10-19T00:00:00-04:00",
    summary:
      "We've updated our Terms and Conditions and Privacy Policy, effective October 19, 2026. The updated documents reflect that Relayvale LLC operates MonitoRSS, and clarify how your data is handled, your privacy rights, subscriptions and payments, and how disputes are resolved. Continued use of MonitoRSS on or after October 19, 2026 means you accept the updated documents.",
    documents: [
      { type: "terms", url: "https://monitorss.xyz/legal/terms" },
      { type: "privacy-policy", url: "https://monitorss.xyz/legal/privacy" },
    ],
  },
]);
