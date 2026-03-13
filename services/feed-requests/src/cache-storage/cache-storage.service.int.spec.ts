// Polyfill for Jest VM environment (redis v4 depends on undici which needs these)
import { ReadableStream, WritableStream, TransformStream } from 'stream/web';

Object.assign(globalThis, {
  ReadableStream,
  WritableStream,
  TransformStream,
});

import { createClient, RedisClientType } from 'redis';
import { CacheStorageService } from './cache-storage.service';

jest.mock('../utils/logger');

describe('CacheStorageService (Integration)', () => {
  let redisClient: RedisClientType;
  let service: CacheStorageService;
  const testKeyPrefix = 'test-cache-storage-int';

  beforeAll(async () => {
    redisClient = createClient({
      url: 'redis://localhost:6379',
    });

    await redisClient.connect();

    service = new CacheStorageService(redisClient as never);
  });

  afterEach(async () => {
    const keys = await redisClient.keys(
      service.generateKey(`${testKeyPrefix}*`),
    );

    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  });

  afterAll(async () => {
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

      expect(result).toBe(true);

      const value = await redisClient.get(service.generateKey(key));
      expect(value).toBe('1');
    });

    it('returns false and does not overwrite when key already exists', async () => {
      await service.setNX({ key, body: 'original', expSeconds: 60 });

      const result = await service.setNX({
        key,
        body: 'overwrite',
        expSeconds: 60,
      });

      expect(result).toBe(false);

      const value = await redisClient.get(service.generateKey(key));
      expect(value).toBe('original');
    });

    it('does not refresh TTL when key already exists', async () => {
      await service.setNX({ key, body: '1', expSeconds: 60 });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      await service.setNX({ key, body: '1', expSeconds: 60 });

      const ttl = await redisClient.ttl(service.generateKey(key));
      expect(ttl).toBeLessThanOrEqual(58);
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
      expect(ttl).toBeGreaterThan(58);
    });
  });
});
