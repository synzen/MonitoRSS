import calculateCurrentResponseAge from './calculate-current-response-age';

describe('calculateCurrentResponseAge', () => {
  it('calculates age correctly', () => {
    const headers = {
      'last-modified': 'Thu, 19 Dec 2024 23:20:30 GMT',
      'cache-control': 'public, max-age=3600',
      date: 'Tue, 07 Jan 2025 17:43:29 GMT',
    };
    const requestTime = new Date('2025-01-07 17:43:29.181+00');
    const responseTime = new Date('2025-01-07 17:43:29.181+00');

    const age = calculateCurrentResponseAge({
      headers,
      requestTime,
      responseTime,
    });

    expect(age).toBeGreaterThan(0);
  });
});
