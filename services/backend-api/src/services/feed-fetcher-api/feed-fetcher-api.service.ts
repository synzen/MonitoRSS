import type { Config } from "../../config";
import type { FeedRequestLookupDetails } from "../../shared/types/feed-request-lookup-details.type";
import { UnexpectedApiResponseException } from "../../shared/exceptions/feed-fetcher.exceptions";
import logger from "../../infra/logger";
import type { FeedFetchOptions, FeedFetcherFetchFeedResponse } from "./types";
import {
  ClassifyUrlsResponseSchema,
  FeedFetcherFetchFeedResponseSchema,
  ResolveUrlsResponseSchema,
} from "./schemas";

// Matches the classify endpoint's per-request cap (MAX_CLASSIFY_URLS).
const CLASSIFY_URLS_BATCH_SIZE = 500;

export class FeedFetcherApiService {
  private readonly host: string;
  private readonly apiKey: string;

  constructor(private readonly config: Config) {
    this.host = config.BACKEND_API_FEED_REQUESTS_API_HOST;
    this.apiKey = config.BACKEND_API_FEED_REQUESTS_API_KEY;
  }

  async fetchAndSave(
    url: string,
    lookupDetails: FeedRequestLookupDetails | null,
    options?: FeedFetchOptions,
  ): Promise<FeedFetcherFetchFeedResponse> {
    if (!this.host) {
      throw new Error(
        "BACKEND_API_FEED_REQUESTS_API_HOST config variable must be defined" +
          " for use before executing a request",
      );
    }

    try {
      const response = await fetch(`${this.host}/v1/feed-requests`, {
        method: "POST",
        body: JSON.stringify({
          url,
          executeFetch: options?.getCachedResponse ? false : true,
          debug: options?.debug,
          usePlatformProvider: options?.usePlatformProvider,
          lookupDetails,
        }),
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
      });

      if (response.status >= 500) {
        throw new Error(
          `Feed fetcher api responded with >= 500 status: ${response.status})`,
        );
      }

      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(
          `Feed fetcher api responded with non-ok status: ${
            response.status
          }, response: ${JSON.stringify(responseBody)}`,
        );
      }

      return this.validateResponse(
        FeedFetcherFetchFeedResponseSchema,
        responseBody,
      );
    } catch (error) {
      logger.error(
        `Failed to execute fetch with feed fetcher api (${(error as Error).message})`,
        {
          stack: (error as Error).stack,
        },
      );

      throw error;
    }
  }

  /**
   * Whether feed-requests classifies each URL as a platform (premium)
   * destination URL — the single source of truth shared with the fetch
   * path's routing. Results align by index with the input URLs.
   */
  async classifyUrls(urls: string[]): Promise<boolean[]> {
    return this.postPlatformUrlBatch({
      endpoint: "/v1/platform/classify-urls",
      urls,
      logContext: "classify urls",
      parseResponse: (body) =>
        this.validateResponse(ClassifyUrlsResponseSchema, body).results,
    });
  }

  /**
   * The canonical destination URL feed-requests derives from each URL, or
   * null when it is non-platform or has no provider equivalent. Feed
   * creation stores the canonical form so identical sources dedupe into one
   * provider fetch. Results align by index with the input URLs.
   */
  async resolvePlatformUrls(urls: string[]): Promise<Array<string | null>> {
    return this.postPlatformUrlBatch({
      endpoint: "/v1/platform/resolve-urls",
      urls,
      logContext: "resolve platform urls",
      parseResponse: (body) =>
        this.validateResponse(ResolveUrlsResponseSchema, body).results,
    });
  }

  private async postPlatformUrlBatch<A>(input: {
    endpoint: string;
    urls: string[];
    logContext: string;
    parseResponse: (body: unknown) => A[];
  }): Promise<A[]> {
    if (!this.host) {
      throw new Error(
        "BACKEND_API_FEED_REQUESTS_API_HOST config variable must be defined" +
          " for use before executing a request",
      );
    }

    if (input.urls.length === 0) {
      return [];
    }

    const results: A[] = [];

    for (let i = 0; i < input.urls.length; i += CLASSIFY_URLS_BATCH_SIZE) {
      const batch = input.urls.slice(i, i + CLASSIFY_URLS_BATCH_SIZE);

      try {
        const response = await fetch(`${this.host}${input.endpoint}`, {
          method: "POST",
          body: JSON.stringify({ urls: batch }),
          headers: {
            "Content-Type": "application/json",
            "api-key": this.apiKey,
          },
        });

        if (response.status >= 500) {
          throw new Error(
            `Feed fetcher api responded with >= 500 status: ${response.status})`,
          );
        }

        const responseBody = await response.json();

        if (!response.ok) {
          throw new Error(
            `Feed fetcher api responded with non-ok status: ${
              response.status
            }, response: ${JSON.stringify(responseBody)}`,
          );
        }

        const parsed = input.parseResponse(responseBody);

        if (parsed.length !== batch.length) {
          throw new UnexpectedApiResponseException(
            `Result count (${parsed.length}) does not match input count (${batch.length})`,
          );
        }

        results.push(...parsed);
      } catch (error) {
        logger.error(
          `Failed to ${input.logContext} with feed fetcher api (${(error as Error).message})`,
          {
            stack: (error as Error).stack,
          },
        );

        throw error;
      }
    }

    return results;
  }

  /**
   * GC sweep: posts every active feed URL; feed-requests resolves each
   * through the platform matcher and releases the vendor resources of
   * identities no feed references anymore. Always called, even with an empty
   * list, so a deployment with zero active feeds releases everything.
   */
  async syncActiveFeedUrls(urls: string[]): Promise<void> {
    if (!this.host) {
      throw new Error(
        "BACKEND_API_FEED_REQUESTS_API_HOST config variable must be defined" +
          " for use before executing a request",
      );
    }

    const response = await fetch(`${this.host}/v1/platform/sync-active-urls`, {
      method: "POST",
      body: JSON.stringify({ urls }),
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
    });

    if (response.status >= 500) {
      throw new Error(
        `Feed fetcher api responded with >= 500 status: ${response.status})`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `Feed fetcher api responded with non-ok status: ${response.status}`,
      );
    }
  }

  async getRequests(payload: {
    query: Record<string, string>;
    url: string;
    requestLookupKey?: string;
  }): Promise<unknown> {
    const urlParams = new URLSearchParams({
      ...payload.query,
      url: payload.url,
      lookupKey: payload.requestLookupKey || "",
    });

    const response = await fetch(
      `${this.host}/v1/feed-requests?${urlParams.toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
      },
    );

    await this.validateResponseStatus(response);

    return response.json();
  }

  private async validateResponseStatus(res: Response) {
    if (res.status >= 500) {
      throw new Error(
        `>= 500 status code (${res.status}) from feed fetcher api`,
      );
    }

    if (!res.ok) {
      let body: Record<string, unknown> | null = null;

      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch (err) {
        // Ignore JSON parse errors
      }

      throw new Error(
        `Bad status code (${
          res.status
        }) from feed fetcher api, response: ${JSON.stringify(body)}`,
      );
    }
  }

  private validateResponse<T>(
    schema: { parse: (data: unknown) => T },
    json: unknown,
  ): T {
    try {
      return schema.parse(json);
    } catch (error) {
      throw new UnexpectedApiResponseException(
        `Unexpected response from feed fetcher api: ${(error as Error).message}. Response: ${JSON.stringify(json)}`,
      );
    }
  }
}
