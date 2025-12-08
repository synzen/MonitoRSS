import { request } from "undici";
import pRetry from "p-retry";
import {
  FeedRequestBadStatusCodeException,
  FeedRequestFetchException,
  FeedRequestInternalException,
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

// Use getter functions to read env vars dynamically (for test mocking)
function getDefaultServiceHost() {
  return process.env.USER_FEEDS_FEED_REQUESTS_API_URL || "http://feed-requests:5000";
}

function getApiKey() {
  return process.env.USER_FEEDS_FEED_REQUESTS_API_KEY || "";
}

export async function fetchFeed(
  url: string,
  options?: {
    executeFetch?: boolean;
    executeFetchIfNotInCache?: boolean;
    executeFetchIfStale?: boolean;
    retries?: number;
    hashToCompare?: string;
    lookupDetails?: FeedRequestLookupDetails | null;
    serviceHost?: string;
  }
): Promise<FetchFeedResult> {
  const serviceHost = options?.serviceHost ?? getDefaultServiceHost();
  let statusCode: number;
  let body: { json: () => Promise<unknown> };

  try {
    const response = await pRetry(
      async () =>
        request(serviceHost, {
          method: "POST",
          body: JSON.stringify({
            url,
            executeFetchIfNotExists: options?.executeFetchIfNotInCache ?? false,
            executeFetch: options?.executeFetch ?? false,
            executeFetchIfStale: options?.executeFetchIfStale ?? false,
            hashToCompare: options?.hashToCompare || undefined,
            lookupDetails: options?.lookupDetails,
          }),
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            "api-key": getApiKey(),
          },
        }),
      {
        retries: options?.retries ?? 2,
        randomize: true,
      }
    );

    statusCode = response.statusCode;
    body = response.body;
  } catch (err) {
    throw new FeedRequestNetworkException(
      `Failed to execute request to feed requests API: ${(err as Error).message}`
    );
  }

  return handleFetchResponse({
    statusCode,
    json: body.json.bind(body),
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

  if (
    requestStatus === FeedResponseRequestStatus.Pending ||
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
