const MONITORSS_DOMAIN = "monitorss.xyz";

export const isOfficialMonitoRSSHost = (hostname: string) =>
  hostname === MONITORSS_DOMAIN || hostname.endsWith(`.${MONITORSS_DOMAIN}`);
