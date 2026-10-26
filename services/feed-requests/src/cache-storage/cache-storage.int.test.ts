import { createClient, RedisClientType } from 'redis';
import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert';
import { createCacheStorageService } from './cache-storage';
import { loadConfig } from '../config';
import { silenceLogger } from '../test/helpers/silence-logger';

silenceLogger();

describe('CacheStorageService (Integration)', () => {
  let redisClient: RedisClientType;
  let service: ReturnType<typeof createCacheStorageService>;
  const testKeyPrefix = 'test-cache-storage-int';

  before(async () => {
    redisClient = createClient({
      url: loadConfig().FEED_REQUESTS_REDIS_URI,
    });

    await redisClient.connect();

    service = createCacheStorageService(redisClient as never);
  });

  afterEach(async () => {
    const keys = await redisClient.keys(
      service.generateKey(`${testKeyPrefix}*`),
    );

    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  });

  after(async () => {
    await redisClient.disconnect();
  });

  describe('setNX', () => {
    const key = `${testKeyPrefix}-setnx`;

    it('returns true and sets the key when key does not exist', async () => {
      const result = await service.setNX({
        key,
        body: '1',
        expSeconds: 60,
      });

      assert.strictEqual(result, true);

      const value = await redisClient.get(service.generateKey(key));
      assert.strictEqual(value, '1');
    });

    it('returns false and does not overwrite when key already exists', async () => {
      await service.setNX({ key, body: 'original', expSeconds: 60 });

      const result = await service.setNX({
        key,
        body: 'overwrite',
        expSeconds: 60,
      });

      assert.strictEqual(result, false);

      const value = await redisClient.get(service.generateKey(key));
      assert.strictEqual(value, 'original');
    });

    it('does not refresh TTL when key already exists', async () => {
      await service.setNX({ key, body: '1', expSeconds: 60 });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      await service.setNX({ key, body: '1', expSeconds: 60 });

      const ttl = await redisClient.ttl(service.generateKey(key));
      assert.ok(ttl <= 58);
    });
  });

  describe('set with getOldValue (old behavior regression check)', () => {
    const key = `${testKeyPrefix}-set-get`;

    it('refreshes TTL even when key already exists', async () => {
      await redisClient.set(service.generateKey(key), '1', { EX: 60 });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      await service.set({
        key,
        body: '1',
        expSeconds: 60,
        getOldValue: true,
      });

      const ttl = await redisClient.ttl(service.generateKey(key));
      // The old SET+GET behavior resets the TTL back to 60
      assert.ok(ttl > 58);
    });
  });
});
