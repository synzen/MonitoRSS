import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateBackoffIntervalMs,
  createScheduledFetchPolicies,
  createScheduledFetchProcessor,
  type BackoffConfig,
} from './scheduled-fetch';
import { RequestStatus } from './types';

const config: BackoffConfig = {
  suspensionBaseMs: 4 * 60 * 60 * 1000,
  suspensionRateMultiplier: 2,
  tier1BoundaryMs: 24 * 60 * 60 * 1000,
  tier2BoundaryMs: 72 * 60 * 60 * 1000,
  expiryMs: 14 * 24 * 60 * 60 * 1000,
  rateLimitFloorMs: 60 * 60 * 1000,
  retryAfterClampMs: 24 * 60 * 60 * 1000,
};

const RATE = 20 * 60; // 20 minutes, the production YouTube-feed cadence
const HOUR = 60 * 60 * 1000;

describe('calculateBackoffIntervalMs', () => {
  it('keeps the feed cadence in the active phase', () => {
    assert.strictEqual(
      calculateBackoffIntervalMs({ elapsedMs: 0, rateSeconds: RATE, config }),
      RATE * 1000,
    );
    assert.strictEqual(
      calculateBackoffIntervalMs({
        elapsedMs: 3 * HOUR,
        rateSeconds: RATE,
        config,
      }),
      RATE * 1000,
    );
  });

  it('suspends only after max(base, multiplier * rate) without a success', () => {
    // A 20-minute feed suspends after 4h; a 6-hourly feed only after 12h.
    assert.strictEqual(
      calculateBackoffIntervalMs({
        elapsedMs: 4 * HOUR,
        rateSeconds: RATE,
        config,
      }),
      HOUR,
    );
    assert.strictEqual(
      calculateBackoffIntervalMs({
        elapsedMs: 4 * HOUR,
        rateSeconds: 6 * 60 * 60,
        config,
      }),
      6 * HOUR,
    );
    assert.strictEqual(
      calculateBackoffIntervalMs({
        elapsedMs: 12 * HOUR,
        rateSeconds: 6 * 60 * 60,
        config,
      }),
      6 * HOUR,
    );
  });

  it('steps probe tiers at 24h and 72h, never probing faster than the feed pays for', () => {
    assert.strictEqual(
      calculateBackoffIntervalMs({
        elapsedMs: 24 * HOUR,
        rateSeconds: RATE,
        config,
      }),
      6 * HOUR,
    );
    assert.strictEqual(
      calculateBackoffIntervalMs({
        elapsedMs: 72 * HOUR,
        rateSeconds: RATE,
        config,
      }),
      24 * HOUR,
    );
    assert.strictEqual(
      calculateBackoffIntervalMs({
        elapsedMs: 72 * HOUR,
        rateSeconds: 6 * 60 * 60,
        config,
      }),
      24 * HOUR,
    );
  });

  it('floors 429s at the Retry-After header when present', () => {
    assert.strictEqual(
      calculateBackoffIntervalMs({
        elapsedMs: 0,
        rateSeconds: RATE,
        lastAttempt: { statusCode: 429, headers: { 'retry-after': '7200' } },
        config,
      }),
      2 * HOUR,
    );
  });

  it('floors headerless 429s at the rate-limit floor', () => {
    assert.strictEqual(
      calculateBackoffIntervalMs({
        elapsedMs: 0,
        rateSeconds: RATE,
        lastAttempt: { statusCode: 429, headers: null },
        config,
      }),
      HOUR,
    );
  });

  it('supports HTTP-date Retry-After values', () => {
    const nowMs = Date.parse('2026-11-07T12:00:00Z');

    assert.strictEqual(
      calculateBackoffIntervalMs({
        elapsedMs: 0,
        rateSeconds: RATE,
        lastAttempt: {
          statusCode: 429,
          headers: { 'retry-after': new Date(nowMs + 2 * HOUR).toUTCString() },
        },
        config,
        nowMs,
      }),
      2 * HOUR,
    );
  });

  it('clamps Retry-After without shortening the backoff tier', () => {
    // Retry-After of 30 days clamps to 24h...
    assert.strictEqual(
      calculateBackoffIntervalMs({
        elapsedMs: 0,
        rateSeconds: RATE,
        lastAttempt: { statusCode: 429, headers: { 'retry-after': '2592000' } },
        config,
      }),
      24 * HOUR,
    );
    // ...but a 48-hourly feed's tier still dominates a short Retry-After.
    assert.strictEqual(
      calculateBackoffIntervalMs({
        elapsedMs: 72 * HOUR,
        rateSeconds: 48 * 60 * 60,
        lastAttempt: { statusCode: 429, headers: { 'retry-after': '300' } },
        config,
      }),
      48 * HOUR,
    );
  });

  it('treats 503 like 429 and ignores the floor for other failures', () => {
    assert.strictEqual(
      calculateBackoffIntervalMs({
        elapsedMs: 0,
        rateSeconds: RATE,
        lastAttempt: { statusCode: 503, headers: null },
        config,
      }),
      HOUR,
    );
    assert.strictEqual(
      calculateBackoffIntervalMs({
        elapsedMs: 0,
        rateSeconds: RATE,
        lastAttempt: { statusCode: 404, headers: { 'retry-after': '7200' } },
        config,
      }),
      RATE * 1000,
    );
  });

  it('never shortens a suspended tier because of a short Retry-After', () => {
    assert.strictEqual(
      calculateBackoffIntervalMs({
        elapsedMs: 48 * HOUR,
        rateSeconds: RATE,
        lastAttempt: { statusCode: 429, headers: { 'retry-after': '300' } },
        config,
      }),
      6 * HOUR,
    );
  });
});

describe('createScheduledFetchProcessor', () => {
  it('does not let a host cache that only nearly ties the cadence suppress a fetch', async () => {
    const policies = createScheduledFetchPolicies({
      backoffConfig: config,
      partitionedRequestsStore: {
        getLatestRequestWithOkStatus: async () => ({
          createdAt: new Date(Date.now() - 10 * 60 * 1000),
          requestInitiatedAt: new Date(Date.now() - 10 * 60 * 1000),
          responseHeaders: {
            'cache-control': 'public, max-age=120',
          },
        }),
        getLatestAttempt: async () => null,
        getEarliestRequestCreatedAt: async () => null,
      },
    });

    const result = await policies.isLatestResponseStillFreshInCache({
      lookupKey: 'https://example.com/feed.xml',
      rateSeconds: 140,
    });

    assert.strictEqual(result.isCacheStillActive, false);
  });

  it('preserves platform provider routing from the batch item to the fetch', async () => {
    const calls: Array<{ url: string; usePlatformProvider?: boolean }> = [];
    const processor = createScheduledFetchProcessor({
      backoffConfig: config,
      feedFetcher: {
        async fetchAndSaveResponse(url, options) {
          calls.push({
            url,
            usePlatformProvider: options?.usePlatformProvider,
          });

          return {
            request: {
              id: 'request-1',
              url,
              lookupKey: url,
              status: RequestStatus.OK,
              source: options?.source ?? null,
              fetchOptions: null,
              createdAt: new Date(),
              nextRetryDate: null,
              errorMessage: null,
              requestInitiatedAt: new Date(),
              response: null,
            },
          };
        },
      },
      partitionedRequestsStore: {
        flushInserts: async () => {},
        wasRequestedInPastSeconds: async () => false,
        getLatestRequestWithOkStatus: async () => null,
        getLatestAttempt: async () => null,
        getEarliestRequestCreatedAt: async () => null,
      },
      hostRateLimiter: {
        incrementUrlCount: async () => ({ isRateLimited: false }),
      },
      cacheStorage: {
        setNX: async () => true,
        del: async () => {},
      },
      onEvent: () => {},
    });

    await processor.processBatch({
      rateSeconds: RATE,
      timestamp: Date.now(),
      data: [
        {
          url: 'https://www.instagram.com/adrienbrody',
          usePlatformProvider: true,
        },
      ],
    });

    assert.deepStrictEqual(calls, [
      {
        url: 'https://www.instagram.com/adrienbrody',
        usePlatformProvider: true,
      },
    ]);
  });
});
