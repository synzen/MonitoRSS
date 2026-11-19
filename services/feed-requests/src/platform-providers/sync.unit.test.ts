import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createPlatformProviderSyncService } from './sync';
import type {
  PlatformFeedIdentity,
  PlatformHttpGet,
  PlatformProviderRegistry,
  PlatformProviderStateStore,
} from './types';

const TWITTER_IDENTITY: PlatformFeedIdentity = {
  platform: 'twitter',
  kind: 'user',
  value: 'jack',
};

interface StubRegistryOptions {
  releaseCalls?: PlatformFeedIdentity[];
  failFirstRelease?: boolean;
}

const createStubRegistry = (
  options: StubRegistryOptions = {},
): PlatformProviderRegistry => ({
  findMatchingPlatform: (url) =>
    url.startsWith('https://x.com/')
      ? {
          platform: 'twitter',
          kind: 'user',
          value: url.slice('https://x.com/'.length),
        }
      : null,
  identityFromStateKey: (key) =>
    key.startsWith('stub:twitter:user:')
      ? {
          platform: 'twitter',
          kind: 'user',
          value: key.slice('stub:twitter:user:'.length),
        }
      : null,
  adapters: {
    twitter: {
      'tw-default': () => ({
        fetchFeedDocument: async () => '<rss/>',
        releaseFeedDocument: async (identity) => {
          if (options.failFirstRelease && options.releaseCalls?.length === 0) {
            options.releaseCalls.push(identity);
            throw new Error('vendor unavailable');
          }

          options.releaseCalls?.push(identity);
        },
      }),
    },
  },
  defaults: { twitter: 'tw-default' },
});

const createMemoryStore = (
  keys: string[] = [],
): PlatformProviderStateStore & { listCalls: number } => {
  let listCalls = 0;
  const values = new Map<string, string>();

  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async setIfAbsent(key, value) {
      if (values.has(key)) {
        return false;
      }
      values.set(key, value);

      return true;
    },
    async setIfValueIs(key, expectedValue, nextValue) {
      if (values.get(key) !== expectedValue) {
        return false;
      }
      values.set(key, nextValue);

      return true;
    },
    async delete(key) {
      values.delete(key);
    },
    async listKeys() {
      listCalls++;

      return keys;
    },
    get listCalls() {
      return listCalls;
    },
  };
};

const httpGet: PlatformHttpGet = async () => ({
  ok: true,
  status: 200,
  headers: new Map(),
  text: async () => '',
});

// Release pacing is injectable (releaseIntervalMs): drain tests run against a
// few milliseconds and the unref'd timers still drop out of the process when
// the test file finishes.
describe('createPlatformProviderSyncService', () => {
  it('queues releases for stored keys absent from the referenced set', async () => {
    const releaseCalls: PlatformFeedIdentity[] = [];
    const registry = createStubRegistry({ releaseCalls });
    const store = createMemoryStore([
      'stub:twitter:user:jack',
      'stub:twitter:user:gone',
    ]);
    const sync = createPlatformProviderSyncService({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      stateStore: store,
      httpGet,
    });

    const { queued } = await sync.syncActiveUrls(['https://x.com/jack']);

    assert.strictEqual(queued, 1);
    assert.strictEqual(store.listCalls, 1);
  });

  it('queues everything when the referenced set is empty', async () => {
    const registry = createStubRegistry();
    const store = createMemoryStore(['stub:twitter:user:jack']);
    const sync = createPlatformProviderSyncService({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      stateStore: store,
      httpGet,
    });

    const { queued } = await sync.syncActiveUrls([]);

    assert.strictEqual(queued, 1);
  });

  it('ignores non-platform urls and foreign keys', async () => {
    const registry = createStubRegistry();
    const store = createMemoryStore(['not-a-platform-key']);
    const sync = createPlatformProviderSyncService({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      stateStore: store,
      httpGet,
    });

    const { queued } = await sync.syncActiveUrls([
      'https://www.example.com/feed.xml',
      'https://x.com/jack',
    ]);

    assert.strictEqual(queued, 0);
  });

  it('dedupes repeat sweeps of the same unreferenced key', async () => {
    const registry = createStubRegistry();
    const store = createMemoryStore(['stub:twitter:user:gone']);
    const sync = createPlatformProviderSyncService({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      stateStore: store,
      httpGet,
    });

    const first = await sync.syncActiveUrls([]);
    const second = await sync.syncActiveUrls([]);

    assert.strictEqual(first.queued, 1);
    assert.strictEqual(second.queued, 0);
  });

  it('drains queued releases through the adapter after the interval', async () => {
    const releaseCalls: PlatformFeedIdentity[] = [];
    const registry = createStubRegistry({ releaseCalls });
    const store = createMemoryStore(['stub:twitter:user:gone']);
    const sync = createPlatformProviderSyncService({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      stateStore: store,
      httpGet,
      releaseIntervalMs: 10,
    });

    await sync.syncActiveUrls([]);
    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.deepStrictEqual(releaseCalls, [
      { platform: 'twitter', kind: 'user', value: 'gone' },
    ]);
  });

  it('a failed release does not block the next queued one', async () => {
    const releaseCalls: PlatformFeedIdentity[] = [];
    const registry = createStubRegistry({
      releaseCalls,
      failFirstRelease: true,
    });
    const store = createMemoryStore([
      'stub:twitter:user:first',
      'stub:twitter:user:second',
    ]);
    const sync = createPlatformProviderSyncService({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      stateStore: store,
      httpGet,
      releaseIntervalMs: 10,
    });

    await sync.syncActiveUrls([]);
    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.deepStrictEqual(releaseCalls, [
      { platform: 'twitter', kind: 'user', value: 'first' },
      { platform: 'twitter', kind: 'user', value: 'second' },
    ]);
  });

  it('releases at most one identity per slot window across processes', async () => {
    const releaseCalls: PlatformFeedIdentity[] = [];
    const registry = createStubRegistry({ releaseCalls });
    const store = createMemoryStore(['stub:twitter:user:gone']);
    const createService = () =>
      createPlatformProviderSyncService({
        matchPlatform: (url) => registry.findMatchingPlatform(url),
        platformProviderRegistry: registry,
        stateStore: store,
        httpGet,
        releaseIntervalMs: 10,
        releaseSlotTtlMs: 5000,
      });
    const first = createService();
    const second = createService();

    await first.syncActiveUrls([]);
    await second.syncActiveUrls([]);
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Both processes queue the same identity, but the shared Postgres slot
    // only lets one of them release per window (in production the window is
    // the release interval, so the aggregate release rate is 1 per interval
    // regardless of pod count).
    assert.strictEqual(releaseCalls.length, 1);
  });

  it('refuses a stale queued release once the latest sweep references the identity', async () => {
    const releaseCalls: PlatformFeedIdentity[] = [];
    const registry = createStubRegistry({ releaseCalls });
    const store = createMemoryStore(['stub:twitter:user:gone']);
    const sync = createPlatformProviderSyncService({
      matchPlatform: (url) => registry.findMatchingPlatform(url),
      platformProviderRegistry: registry,
      stateStore: store,
      httpGet,
      releaseIntervalMs: 10,
    });

    await sync.syncActiveUrls([]);
    // A later sweep (a user re-created the handle) refreshes the referenced
    // set while the entry from the first sweep is still pending.
    await sync.syncActiveUrls(['https://x.com/gone']);
    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.strictEqual(releaseCalls.length, 0);

    // The dropped entry is re-discovered by the next unreferenced sweep.
    const next = await sync.syncActiveUrls([]);
    assert.strictEqual(next.queued, 1);
  });

  it('no-ops without a registry (OSS builds)', async () => {
    const store = createMemoryStore(['stub:twitter:user:gone']);
    const sync = createPlatformProviderSyncService({
      matchPlatform: () => null,
      platformProviderRegistry: undefined,
      stateStore: store,
      httpGet,
    });

    const { queued } = await sync.syncActiveUrls([]);

    assert.strictEqual(queued, 0);
    assert.strictEqual(store.listCalls, 0);
  });
});
