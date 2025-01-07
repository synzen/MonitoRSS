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

    expect(freshnessLifetime).toBeGreaterThan(0);
  });
});
