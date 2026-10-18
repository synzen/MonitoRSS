import { describe, it } from 'node:test';
import assert from 'node:assert';
import calculateResponseFreshnessLifetime from './calculate-response-freshness-lifetime';

describe('calculateResponseFreshnessLifetime', () => {
  it('calculates freshness lifetime correctly', () => {
    const headers = {
      'last-modified': 'Thu, 19 Dec 2024 23:20:30 GMT',
      'cache-control': 'public, max-age=3600',
      date: 'Tue, 07 Jan 2025 17:43:29 GMT',
    };
    const freshnessLifetime = calculateResponseFreshnessLifetime({
      headers,
    });

    assert.ok(freshnessLifetime.original > 0);
    assert.ok(freshnessLifetime.capped > 0);
  });

  it('caps freshness lifetime at one hour', () => {
    const headers = {
      'cache-control': 'public, max-age=7200',
    };
    const freshnessLifetime = calculateResponseFreshnessLifetime({
      headers,
    });

    assert.strictEqual(freshnessLifetime.original, 7200 * 1000);
    assert.strictEqual(freshnessLifetime.capped, 60 * 60 * 1000);
  });
});
