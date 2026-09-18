const MONITORSS_DOMAIN = "monitorss.xyz";

export const isOfficialMonitoRSSHost = (hostname: string) =>
  hostname === MONITORSS_DOMAIN || hostname.endsWith(`.${MONITORSS_DOMAIN}`);

// Must match LEGAL_NOTICES[0].effectiveAt in
// services/backend-api/src/features/legal-notices/legal-notices.data.ts.
// The client bundle cannot import server sources, so update both together.
// Relayvale LLC operates the service only from that date.
export const LEGAL_IDENTITY_EFFECTIVE_AT = new Date("2026-10-19T00:00:00-04:00");
