const FALLBACK_VALUE = {
  original: 0,
  capped: 0,
};

const capFreshnessLifetime = (ms: number) => {
  // If freshness lifetime is >= 1 hour, cap it to once per hour
  if (ms >= 60 * 60 * 1000) {
    return 60 * 60 * 1000;
  }

  return ms;
};

/**
 * Calculate the freshness lifetime of a response based on headers
 *
 * https://httpwg.org/specs/rfc9111.html#calculating.freshness.lifetime
 *
 * @returns {number} Freshness lifetime in milliseconds
 */
const calculateResponseFreshnessLifetime = ({
  headers,
}: {
  headers: Record<string, string>;
}): {
  original: number;
  capped: number;
} => {
  const cacheControl = headers['cache-control'];

  if (!cacheControl) {
    // Check Expires and Date headers
    const latestOkRequestDateTime = new Date(headers.date || '').getTime();
    const latestOkRequestExpiresTime = new Date(
      headers.expires || '',
    ).getTime();

    if (isNaN(latestOkRequestDateTime) || isNaN(latestOkRequestExpiresTime)) {
      return FALLBACK_VALUE;
    } else {
      const remainingTime =
        latestOkRequestExpiresTime - latestOkRequestDateTime;

      return remainingTime > 0
        ? {
            original: remainingTime,
            capped: capFreshnessLifetime(remainingTime),
          }
        : FALLBACK_VALUE;
    }
  }

  const directives = cacheControl.split(',').map((d) => d.trim());
  const maxAgeDirective = directives.find((d) => d.startsWith('max-age='));
  const publicDirective = directives.includes('public');

  if (!maxAgeDirective || !publicDirective) {
    return FALLBACK_VALUE;
  }

  const maxAge = parseInt(maxAgeDirective.split('=')[1]);

  if (Number.isNaN(maxAge)) {
    return FALLBACK_VALUE;
  }

  const toReturn = maxAge * 1000;

  return {
    original: toReturn,
    capped: capFreshnessLifetime(toReturn),
  };
};

export default calculateResponseFreshnessLifetime;
