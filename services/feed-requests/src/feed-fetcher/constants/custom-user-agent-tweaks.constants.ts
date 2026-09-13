export const CUSTOM_USER_AGENT_TWEAKS_BY_HOST = new Map<
  string,
  (userAgent: string) => string
>([['www.cbc.ca', (userAgent) => userAgent.replace(/@(?! )/g, '@ ')]]);

export function resolveUserAgentForUrl(
  url: string,
  defaultUserAgent: string,
): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const tweak = CUSTOM_USER_AGENT_TWEAKS_BY_HOST.get(hostname);

    if (!tweak) {
      return defaultUserAgent;
    }

    return tweak(defaultUserAgent);
  } catch {
    return defaultUserAgent;
  }
}
