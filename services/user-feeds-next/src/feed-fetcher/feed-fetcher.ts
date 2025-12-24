import pRetry from "p-retry";
import {
  FeedRequestBadStatusCodeException,
  FeedRequestFetchException,
  FeedRequestInternalException,
  FeedRequestInvalidSslCertificateException,
  FeedRequestNetworkException,
  FeedRequestParseException,
  FeedRequestServerStatusException,
  FeedRequestTimedOutException,
} from "./exceptions";
import {
  type FeedRequestLookupDetails,
  type FeedResponse,
  FeedResponseRequestStatus,
  type FetchFeedResult,
} from "./types";

const API_KEY = process.env.USER_FEEDS_FEED_REQUESTS_API_KEY || "";

export async function fetchFeed(
  url: string,
  options: {
    executeFetch?: boolean;
    executeFetchIfNotInCache?: boolean;
    executeFetchIfStale?: boolean;
    stalenessThresholdSeconds?: number;
    retries?: number;
    hashToCompare?: string;
    lookupDetails?: FeedRequestLookupDetails | null;
    serviceHost: string;
  }
): Promise<FetchFeedResult> {
  const serviceHost = options.serviceHost;
  let response: Response;

  try {
    const requestBody = {
      url,
      executeFetchIfNotExists: options?.executeFetchIfNotInCache ?? false,
      executeFetch: options?.executeFetch ?? false,
      executeFetchIfStale: options?.executeFetchIfStale ?? false,
      stalenessThresholdSeconds: options?.stalenessThresholdSeconds,
      hashToCompare: options?.hashToCompare || undefined,
      lookupDetails: options?.lookupDetails,
    };
    response = await pRetry(
      async () =>
        fetch(serviceHost, {
          method: "POST",
          body: JSON.stringify(requestBody),
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            "api-key": API_KEY,
          },
        }),
      {
        retries: options?.retries ?? 2,
        randomize: true,
      }
    );
  } catch (err) {
    throw new FeedRequestNetworkException(
      `Failed to execute request to feed requests API: ${(err as Error).message}`
    );
  }

  return handleFetchResponse({
    statusCode: response.status,
    json: response.json.bind(response),
  });
}

async function handleFetchResponse({
  statusCode,
  json,
}: {
  statusCode: number;
  json: () => Promise<unknown>;
}): Promise<FetchFeedResult> {
  if (statusCode < 200 || statusCode >= 300) {
    let bodyJson: unknown = {};

    try {
      bodyJson = await json();
    } catch (err) {
      // Ignore JSON parse errors for error responses
    }

    throw new FeedRequestServerStatusException(
      `Bad status code for feed requests API (${statusCode}) (${JSON.stringify(bodyJson)}).`
    );
  }

  const response = (await json()) as FeedResponse;
  const { requestStatus } = response;

  if (requestStatus === FeedResponseRequestStatus.InternalError) {
    throw new FeedRequestInternalException(
      `Feed requests service encountered internal error while fetching feed`
    );
  }

  if (requestStatus === FeedResponseRequestStatus.ParseError) {
    throw new FeedRequestParseException(`Invalid feed`);
  }

  if (requestStatus === FeedResponseRequestStatus.FetchError) {
    throw new FeedRequestFetchException(
      "Fetch on user feeds service failed, likely a network error"
    );
  }

  if (requestStatus === FeedResponseRequestStatus.BadStatusCode) {
    throw new FeedRequestBadStatusCodeException(
      `Bad status code received for feed request (${response.response.statusCode})`,
      response.response.statusCode
    );
  }

  if (requestStatus === FeedResponseRequestStatus.InvalidSslCertificate) {
    throw new FeedRequestInvalidSslCertificateException(
      "Feed server has an invalid SSL certificate"
    );
  }

  if (
    requestStatus === FeedResponseRequestStatus.MatchedHash
  ) {
    return { requestStatus };
  }

  if (requestStatus === FeedResponseRequestStatus.Success) {
    return {
      requestStatus,
      body: response.response.body,
      bodyHash: response.response.hash,
    };
  }

  if (requestStatus === FeedResponseRequestStatus.FetchTimeout) {
    throw new FeedRequestTimedOutException(`Feed request timed out`);
  }

  throw new Error(
    `Unexpected feed request status in response: ${requestStatus}`
  );
}

/**
 * Fetch feed for delivery preview using the dedicated endpoint.
 * This endpoint checks staleness based on ANY request status (including errors),
 * preventing duplicate fetches when only error records exist.
 *
 * Compatible with fetchFeed signature so it can be passed to fetchAndParseFeed.
 */
export async function fetchFeedForDeliveryPreview(
  url: string,
  options: {
    serviceHost: string;
    stalenessThresholdSeconds?: number;
    lookupDetails?: FeedRequestLookupDetails | null;
    // These are accepted for compatibility but not used by this endpoint
    executeFetch?: boolean;
    executeFetchIfNotInCache?: boolean;
    executeFetchIfStale?: boolean;
    retries?: number;
    hashToCompare?: string;
  }
): Promise<FetchFeedResult> {
  const serviceHost = options.serviceHost;
  let response: Response;

  try {
    const requestBody = {
      url,
      lookupKey: options.lookupDetails?.key,
      stalenessThresholdSeconds: options.stalenessThresholdSeconds,
    };

    const endpointUrl = serviceHost.endsWith("/")
      ? `${serviceHost}delivery-preview`
      : `${serviceHost}/delivery-preview`;

    response = await pRetry(
      async () =>
        fetch(endpointUrl, {
          method: "POST",
          body: JSON.stringify(requestBody),
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            "api-key": API_KEY,
          },
        }),
      {
        retries: 2,
        randomize: true,
      }
    );
  } catch (err) {
    throw new FeedRequestNetworkException(
      `Failed to execute request to feed requests API: ${(err as Error).message}`
    );
  }

  return handleFetchResponse({
    statusCode: response.status,
    json: response.json.bind(response),
  });
}
