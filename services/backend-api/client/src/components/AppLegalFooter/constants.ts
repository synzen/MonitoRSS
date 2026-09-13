const MONITORSS_DOMAIN = "monitorss.xyz";

export const isOfficialMonitoRSSHost = (hostname: string) =>
  hostname === MONITORSS_DOMAIN || hostname.endsWith(`.${MONITORSS_DOMAIN}`);

// Mirrors the effectiveAt of the 2026-10-19 notices in
// services/backend-api/src/features/legal-notices/legal-notices.data.ts.
// Relayvale LLC operates the service only from that date, so the footer must
// not claim the new owner earlier.
export const LEGAL_IDENTITY_EFFECTIVE_AT = new Date("2026-10-19T00:00:00-04:00");
