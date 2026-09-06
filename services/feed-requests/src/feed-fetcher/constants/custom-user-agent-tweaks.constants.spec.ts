import {
  CUSTOM_USER_AGENT_TWEAKS_BY_HOST,
  resolveUserAgentForUrl,
} from './custom-user-agent-tweaks.constants';

describe('resolveUserAgentForUrl', () => {
  const defaultUserAgent = 'MonitoRSS [Self-Hosted]/1.0 hello@xyz.com';

  it('returns the default user agent for hosts without a tweak', () => {
    expect(
      resolveUserAgentForUrl('https://example.com/feed.xml', defaultUserAgent),
    ).toBe(defaultUserAgent);
  });

  it('adds a space after @ for www.cbc.ca while keeping the env UA as base', () => {
    expect(
      resolveUserAgentForUrl(
        'https://www.cbc.ca/webfeed/rss/rss-world',
        defaultUserAgent,
      ),
    ).toBe('MonitoRSS [Self-Hosted]/1.0 hello@ xyz.com');
  });

  it('matches the host case-insensitively', () => {
    expect(
      resolveUserAgentForUrl(
        'https://WWW.CBC.CA/webfeed/rss/rss-world',
        defaultUserAgent,
      ),
    ).toBe('MonitoRSS [Self-Hosted]/1.0 hello@ xyz.com');
  });

  it('does not match subdomains or apex outside the exact host entry', () => {
    expect(
      resolveUserAgentForUrl('https://cbc.ca/feed', defaultUserAgent),
    ).toBe(defaultUserAgent);
    expect(
      resolveUserAgentForUrl('https://sub.www.cbc.ca/feed', defaultUserAgent),
    ).toBe(defaultUserAgent);
  });

  it('does not double-space an already-spaced user agent', () => {
    const alreadySpaced = 'MonitoRSS [Self-Hosted]/1.0 hello@ xyz.com';

    expect(
      resolveUserAgentForUrl('https://www.cbc.ca/feed', alreadySpaced),
    ).toBe(alreadySpaced);
  });

  it('leaves user agents without @ untouched', () => {
    const withoutEmail = 'MonitoRSS [Self-Hosted]/1.0';

    expect(
      resolveUserAgentForUrl('https://www.cbc.ca/feed', withoutEmail),
    ).toBe(withoutEmail);
  });

  it('returns the default user agent for invalid urls', () => {
    expect(resolveUserAgentForUrl('not-a-url', defaultUserAgent)).toBe(
      defaultUserAgent,
    );
  });

  it('tracks tweaks per exact host', () => {
    expect(CUSTOM_USER_AGENT_TWEAKS_BY_HOST.has('www.cbc.ca')).toBe(true);
  });
});
