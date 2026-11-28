import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createPlatformProviderRouter } from './router';
import {
  NoProviderAvailableError,
  PlatformProviderFetchError,
  UnknownPlatformProviderError,
  type PlatformFeedIdentity,
  type PlatformHttpGet,
  type PlatformProviderAdapterFactoryDeps,
  type PlatformProviderRegistry,
  type PlatformProviderStateStore,
} from './types';
import { RequestStatus } from '../feed-fetcher/types';

const httpGet: PlatformHttpGet = async () => ({
  ok: true,
  status: 200,
  headers: new Map(),
  text: async () => '<rss/>',
});

// The registry owns matching wholesale, so its stub parses the platform
// URLs itself — mirroring how the private package declares its hosts.
const matchPlatformUrl = (url: string): PlatformFeedIdentity | null => {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // Legacy platform RSS URLs fall through, like the real matcher.
  if (
    parsed.hostname.toLowerCase().startsWith('rss.') ||
    parsed.pathname.endsWith('.rss')
  ) {
    return null;
  }

  const segments = parsed.pathname.split('/').filter(Boolean);

  if (parsed.hostname === 'www.reddit.com' && segments.length === 2) {
    return {
      platform: 'reddit',
      kind: segments[0] === 'r' ? 'subreddit' : 'user',
      value: segments[1],
    };
  }

  if (parsed.hostname === 'x.com' && segments.length === 1) {
    return { platform: 'twitter', kind: 'user', value: segments[0] };
  }

  return null;
};

const stubVendorAdapter = () => ({
  async fetchFeedDocument() {
    return { document: '<rss/>' };
  },
});

const registryWithDefault = (): PlatformProviderRegistry => ({
  findMatchingPlatform: matchPlatformUrl,
  adapters: {
    reddit: {
      'private-default': stubVendorAdapter,
    },
  },
  defaults: {
    reddit: 'private-default',
  },
});

describe('createPlatformProviderRouter', () => {
  it('routes a matched URL to the package-declared default provider', () => {
    const registry = registryWithDefault();
    const router = createPlatformProviderRouter({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      httpGet,
    });

    const route = router.route('https://www.reddit.com/r/javascript');

    assert.ok(route);
    assert.deepEqual(route.identity, {
      platform: 'reddit',
      kind: 'subreddit',
      value: 'javascript',
    });
    assert.ok(route.adapter);
  });

  it('returns null for URLs the matcher does not claim', () => {
    const registry = registryWithDefault();
    const router = createPlatformProviderRouter({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      httpGet,
    });

    assert.strictEqual(router.route('https://www.example.com/feed.xml'), null);
    assert.strictEqual(
      router.route('https://www.reddit.com/r/javascript.rss'),
      null,
    );
    assert.strictEqual(router.route('not a url'), null);
  });

  it('resolves a twitter identity to the twitter default provider', () => {
    const registry: PlatformProviderRegistry = {
      findMatchingPlatform: matchPlatformUrl,
      adapters: { twitter: { 'tw-default': stubVendorAdapter } },
      defaults: { twitter: 'tw-default' },
    };
    const router = createPlatformProviderRouter({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      httpGet,
    });

    const route = router.route('https://x.com/jack');

    assert.ok(route);
    assert.deepEqual(route.identity, {
      platform: 'twitter',
      kind: 'user',
      value: 'jack',
    });
  });

  it('passes the durable state store to the adapter factory', () => {
    const stateStore: PlatformProviderStateStore = {
      get: async () => null,
      set: async () => undefined,
      setIfAbsent: async () => true,
      setIfValueIs: async () => false,
      delete: async () => undefined,
      listKeys: async () => [],
    };
    let received: PlatformProviderAdapterFactoryDeps | undefined;
    const registry: PlatformProviderRegistry = {
      findMatchingPlatform: matchPlatformUrl,
      adapters: {
        twitter: {
          'tw-default': (deps) => {
            received = deps;

            return stubVendorAdapter();
          },
        },
      },
      defaults: { twitter: 'tw-default' },
    };
    const router = createPlatformProviderRouter({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      httpGet,
      platformProviderStateStore: stateStore,
    });

    router.route('https://x.com/jack');

    assert.ok(received);
    assert.strictEqual(received.stateStore, stateStore);
  });

  it('throws typed when the package declares no default for the platform', () => {
    const registry: PlatformProviderRegistry = {
      findMatchingPlatform: matchPlatformUrl,
      adapters: { reddit: {} },
      defaults: {},
    };
    const router = createPlatformProviderRouter({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      httpGet,
    });

    assert.throws(
      () => router.route('https://www.reddit.com/r/javascript'),
      (err: NoProviderAvailableError) => {
        assert.ok(err instanceof NoProviderAvailableError);
        assert.match(err.message, /No provider available in this deployment/);

        return true;
      },
    );
  });

  it('treats an empty-string default as unset', () => {
    const registry: PlatformProviderRegistry = {
      findMatchingPlatform: matchPlatformUrl,
      adapters: { reddit: { 'private-default': stubVendorAdapter } },
      defaults: { reddit: '' },
    };
    const router = createPlatformProviderRouter({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      httpGet,
    });

    assert.throws(
      () => router.route('https://www.reddit.com/r/javascript'),
      NoProviderAvailableError,
    );
  });

  it('throws typed for a default name absent from the registry', () => {
    const registry: PlatformProviderRegistry = {
      findMatchingPlatform: matchPlatformUrl,
      adapters: { reddit: {} },
      defaults: { reddit: 'vendor-x' },
    };
    const router = createPlatformProviderRouter({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      httpGet,
    });

    assert.throws(
      () => router.route('https://www.reddit.com/r/javascript'),
      (err: UnknownPlatformProviderError) => {
        assert.ok(err instanceof UnknownPlatformProviderError);
        assert.match(err.message, /"vendor-x"/);

        return true;
      },
    );
  });

  it('rewraps vendor adapter failures into the local error type', async () => {
    const registry: PlatformProviderRegistry = {
      findMatchingPlatform: matchPlatformUrl,
      adapters: {
        reddit: {
          'private-default': () => ({
            async fetchFeedDocument() {
              throw Object.assign(
                new Error('Provider responded with status 401'),
                { requestStatus: 'BAD_STATUS_CODE', statusCode: 401 },
              );
            },
          }),
        },
      },
      defaults: { reddit: 'private-default' },
    };

    const router = createPlatformProviderRouter({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      httpGet,
    });
    const route = router.route('https://www.reddit.com/r/javascript');

    await assert.rejects(
      route!.adapter.fetchFeedDocument(route!.identity),
      (err: PlatformProviderFetchError) => {
        assert.ok(err instanceof PlatformProviderFetchError);
        assert.strictEqual(err.requestStatus, RequestStatus.BAD_STATUS_CODE);
        assert.strictEqual(err.statusCode, 401);

        return true;
      },
    );
  });

  it('maps vendor failures without a known status into FETCH_ERROR', async () => {
    const registry: PlatformProviderRegistry = {
      findMatchingPlatform: matchPlatformUrl,
      adapters: {
        reddit: {
          'private-default': () => ({
            async fetchFeedDocument() {
              throw Object.assign(new Error('vendor blew up'), {
                requestStatus: 'TOTALLY_MADE_UP',
              });
            },
          }),
        },
      },
      defaults: { reddit: 'private-default' },
    };

    const router = createPlatformProviderRouter({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      httpGet,
    });
    const route = router.route('https://www.reddit.com/r/javascript');

    await assert.rejects(
      route!.adapter.fetchFeedDocument(route!.identity),
      (err: PlatformProviderFetchError) => {
        assert.ok(err instanceof PlatformProviderFetchError);
        assert.strictEqual(err.requestStatus, RequestStatus.FETCH_ERROR);

        return true;
      },
    );
  });
});
