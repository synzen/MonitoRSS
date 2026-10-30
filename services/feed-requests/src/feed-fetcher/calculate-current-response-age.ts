/**
 * Calculate the age of a response based on headers
 *
 * https://httpwg.org/specs/rfc9111.html#age.calculations
 *
 * @returns {number} Age in milliseconds
 */
const calculateCurrentResponseAge = ({
  headers,
  requestTime,
  responseTime,
}: {
  headers: Record<string, string>;
  requestTime: Date | null;
  responseTime: Date | null;
}) => {
  const headerDate = headers['date'] ? new Date(headers['date']) : null;
  let apparentAgeMs = 0;

  if (responseTime && headerDate && !Number.isNaN(headerDate.getTime())) {
    apparentAgeMs = Math.max(responseTime?.getTime() - headerDate.getTime(), 0);
  }

  let correctedAgeValueMs = 0;
  const headerAge = headers['age'] ? parseInt(headers['age']) : null;

  if (responseTime && requestTime && headerAge && !Number.isNaN(headerAge)) {
    const responseDelay = responseTime.getTime() - requestTime.getTime();
    const headerAgeMs = headerAge * 1000;
    correctedAgeValueMs = Math.max(headerAgeMs + responseDelay, 0);
  }

  let correctedInitialAgeMs = 0;

  if (!Number.isNaN(apparentAgeMs) && !Number.isNaN(correctedAgeValueMs)) {
    correctedInitialAgeMs = Math.max(apparentAgeMs, correctedAgeValueMs);
  } else if (!Number.isNaN(apparentAgeMs)) {
    correctedInitialAgeMs = apparentAgeMs;
  } else if (!Number.isNaN(correctedAgeValueMs)) {
    correctedInitialAgeMs = correctedAgeValueMs;
  } else {
    correctedInitialAgeMs = 0;
  }

  const now = new Date().getTime();
  const responseReceivedTime = responseTime?.getTime();

  const residentTimeMs = !responseReceivedTime ? 0 : now - responseReceivedTime;

  return correctedInitialAgeMs + residentTimeMs;
};

export default calculateCurrentResponseAge;
