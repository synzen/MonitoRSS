import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert';
import { createPlatformProviderStateStore } from './platform-provider-state-store';
import {
  getTestPool,
  setupPostgresTests,
  teardownPostgresTests,
} from './setup-postgres-tests';
import { silenceLogger } from '../../test/helpers/silence-logger';

silenceLogger();

describe('PlatformProviderStateStore (Integration)', () => {
  before(async () => {
    await setupPostgresTests();
  });

  afterEach(async () => {
    await getTestPool().query('TRUNCATE platform_provider_state');
  });

  after(async () => {
    await teardownPostgresTests();
  });

  it('returns null for a key that was never stored', async () => {
    const store = createPlatformProviderStateStore(getTestPool());

    assert.strictEqual(await store.get('twitter:user:jack'), null);
  });

  it('stores and overwrites values', async () => {
    const store = createPlatformProviderStateStore(getTestPool());

    await store.set('twitter:user:jack', 'feed-one');
    await store.set('twitter:user:jack', 'feed-two');

    assert.strictEqual(
      await store.get('twitter:user:jack'),
      'feed-two',
    );
  });

  it('setIfAbsent stores only the first writer and reports the race', async () => {
    const store = createPlatformProviderStateStore(getTestPool());

    assert.strictEqual(
      await store.setIfAbsent('twitter:user:jack', 'feed-one'),
      true,
    );
    assert.strictEqual(
      await store.setIfAbsent('twitter:user:jack', 'feed-two'),
      false,
    );
    assert.strictEqual(
      await store.get('twitter:user:jack'),
      'feed-one',
    );
  });

  it('setIfValueIs overwrites only the expected value and reports the race', async () => {
    const store = createPlatformProviderStateStore(getTestPool());

    await store.set('twitter:user:jack', 'feed-one');
    assert.strictEqual(
      await store.setIfValueIs('twitter:user:jack', 'feed-two', 'feed-three'),
      false,
    );
    assert.strictEqual(
      await store.get('twitter:user:jack'),
      'feed-one',
    );
    assert.strictEqual(
      await store.setIfValueIs('twitter:user:jack', 'feed-one', 'feed-two'),
      true,
    );
    assert.strictEqual(
      await store.get('twitter:user:jack'),
      'feed-two',
    );
    assert.strictEqual(
      await store.setIfValueIs('twitter:user:missing', 'feed-one', 'feed-two'),
      false,
    );
  });

  it('deletes stored values without failing on an absent key', async () => {
    const store = createPlatformProviderStateStore(getTestPool());

    await store.set('twitter:user:jack', 'feed-one');
    await store.delete('twitter:user:jack');
    await store.delete('twitter:user:jack');

    assert.strictEqual(await store.get('twitter:user:jack'), null);
  });
});
