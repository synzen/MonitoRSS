import type { Config } from "../../config";
import type { FeedRequestLookupDetails } from "../../shared/types/feed-request-lookup-details.type";
import { UnexpectedApiResponseException } from "../../shared/exceptions/feed-fetcher.exceptions";
import logger from "../../infra/logger";
import type { FeedFetchOptions, FeedFetcherFetchFeedResponse } from "./types";
import { FeedFetcherFetchFeedResponseSchema } from "./schemas";

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
