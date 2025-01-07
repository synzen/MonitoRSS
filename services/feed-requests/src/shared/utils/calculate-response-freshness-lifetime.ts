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
}) => {
  const cacheControl = headers['cache-control'];

  if (!cacheControl) {
    // Check Expires and Date headers
    const latestOkRequestDateTime = new Date(headers.date || '').getTime();
    const latestOkRequestExpiresTime = new Date(
      headers.expires || '',
    ).getTime();

    if (isNaN(latestOkRequestDateTime) || isNaN(latestOkRequestExpiresTime)) {
      return 0;
    } else {
      const remainingTime =
        latestOkRequestExpiresTime - latestOkRequestDateTime;

      return remainingTime > 0 ? remainingTime : 0;
    }
  }

  const directives = cacheControl.split(',').map((d) => d.trim());
  const sMaxAgeDirective = directives.find((d) => d.startsWith('s-maxage='));
  const maxAgeDirective =
    sMaxAgeDirective || directives.find((d) => d.startsWith('max-age='));
  const publicDirective = directives.includes('public');

  if (!maxAgeDirective || !publicDirective) {
    return 0;
  }

  const maxAge = parseInt(maxAgeDirective.split('=')[1]);

  if (Number.isNaN(maxAge)) {
    return 0;
  }

  return maxAge * 1000;
};

export default calculateResponseFreshnessLifetime;
