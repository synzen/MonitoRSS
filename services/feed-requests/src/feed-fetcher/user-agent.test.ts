import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  CUSTOM_USER_AGENT_TWEAKS_BY_HOST,
  resolveUserAgentForUrl,
} from './user-agent';

describe('resolveUserAgentForUrl', () => {
  const defaultUserAgent = 'MonitoRSS [Self-Hosted]/1.0 hello@xyz.com';

  it('returns the default user agent for hosts without a tweak', () => {
    assert.strictEqual(
      resolveUserAgentForUrl('https://example.com/feed.xml', defaultUserAgent),
      defaultUserAgent,
    );
  });

  it('adds a space after @ for www.cbc.ca while keeping the env UA as base', () => {
    assert.strictEqual(
      resolveUserAgentForUrl(
        'https://www.cbc.ca/webfeed/rss/rss-world',
        defaultUserAgent,
      ),
      'MonitoRSS [Self-Hosted]/1.0 hello@ xyz.com',
    );
  });

  it('matches the host case-insensitively', () => {
    assert.strictEqual(
      resolveUserAgentForUrl(
        'https://WWW.CBC.CA/webfeed/rss/rss-world',
        defaultUserAgent,
      ),
      'MonitoRSS [Self-Hosted]/1.0 hello@ xyz.com',
    );
  });

  it('does not match subdomains or apex outside the exact host entry', () => {
    assert.strictEqual(
      resolveUserAgentForUrl('https://cbc.ca/feed', defaultUserAgent),
      defaultUserAgent,
    );
    assert.strictEqual(
      resolveUserAgentForUrl('https://sub.www.cbc.ca/feed', defaultUserAgent),
      defaultUserAgent,
    );
  });

  it('does not double-space an already-spaced user agent', () => {
    const alreadySpaced = 'MonitoRSS [Self-Hosted]/1.0 hello@ xyz.com';

    assert.strictEqual(
      resolveUserAgentForUrl('https://www.cbc.ca/feed', alreadySpaced),
      alreadySpaced,
    );
  });

  it('leaves user agents without @ untouched', () => {
    const withoutEmail = 'MonitoRSS [Self-Hosted]/1.0';

    assert.strictEqual(
      resolveUserAgentForUrl('https://www.cbc.ca/feed', withoutEmail),
      withoutEmail,
    );
  });

  it('returns the default user agent for invalid urls', () => {
    assert.strictEqual(
      resolveUserAgentForUrl('not-a-url', defaultUserAgent),
      defaultUserAgent,
    );
  });

  it('tracks tweaks per exact host', () => {
    assert.strictEqual(
      CUSTOM_USER_AGENT_TWEAKS_BY_HOST.has('www.cbc.ca'),
      true,
    );
  });
});
