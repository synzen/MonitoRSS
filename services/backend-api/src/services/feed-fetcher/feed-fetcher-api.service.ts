import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClassConstructor, plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { URLSearchParams } from "url";
import { UnexpectedApiResponseException } from "../../common/exceptions";
import logger from "../../utils/logger";
import { FeedFetcherFetchFeedResponse } from "./types/feed-fetcher-fetch-feed-response.type";
import { FeedFetcherGetRequestsResponse } from "./types/feed-fetcher-get-requests-response.type";

interface FeedFetchOptions {
  getCachedResponse?: boolean;
  debug?: boolean;
}

@Injectable()
export class FeedFetcherApiService {
  host: string;
  apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.host = this.configService.get<string>(
      "BACKEND_API_FEED_REQUESTS_API_HOST"
    ) as string;
    this.apiKey = this.configService.getOrThrow<string>(
      "BACKEND_API_FEED_REQUESTS_API_KEY"
    );
  }

  async fetchAndSave(
    url: string,
    options?: FeedFetchOptions
  ): Promise<FeedFetcherFetchFeedResponse> {
    if (!this.host) {
      throw new Error(
        "BACKEND_API_FEED_REQUESTS_API_HOST config variable must be defined" +
          " for use before executing a request"
      );
    }

    try {
      const response = await fetch(`${this.host}/v1/feed-requests`, {
        method: "POST",
        body: JSON.stringify({
          url,
          executeFetch: options?.getCachedResponse ? false : true,
          debug: options?.debug,
        }),
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
      });

      if (response.status >= 500) {
        throw new Error(
          `Feed fetcher api responded with >= 500 status: ${response.status})`
        );
      }

      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(
          `Feed fetcher api responded with non-ok status: ${
            response.status
          }, response: ${JSON.stringify(responseBody)}`
        );
      }

      return responseBody as FeedFetcherFetchFeedResponse;
    } catch (error) {
      logger.error(
        `Failed to execute fetch with feed fetcher api (${error.message})`,
        {
          stack: error.stack,
        }
      );

      throw error;
    }
  }

  async getRequests(payload: { limit: number; skip: number; url: string }) {
    const urlParams = new URLSearchParams({
      limit: payload.limit.toString(),
      skip: payload.skip.toString(),
      url: payload.url,
    });

    const response = await fetch(
      `${this.host}/v1/feed-requests?${urlParams.toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
      }
    );

    await this.validateResponseStatus(response);

    const responseBody = await response.json();

    const body = await this.validateResponseJson(
      FeedFetcherGetRequestsResponse,
      responseBody as Record<string, unknown>
    );

    return body;
  }

  private async validateResponseStatus(res: Response) {
    if (res.status >= 500) {
      throw new Error(`>= 500 status code (${res.status}) from User feeds api`);
    }

    if (!res.ok) {
      let body: Record<string, unknown> | null = null;

      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch (err) {}

      throw new Error(
        `Bad status code (${
          res.status
        }) from User feeds api, response: ${JSON.stringify(body)}`
      );
    }
  }
  private async validateResponseJson<T>(
    classConstructor: ClassConstructor<T>,
    json: Record<string, unknown>
  ) {
    const instance = plainToInstance(classConstructor, json);

    const validationErrors = await validate(instance as object);

    if (validationErrors.length > 0) {
      throw new UnexpectedApiResponseException(
        `Unexpected response from feed requests API: ${JSON.stringify(
          validationErrors
        )} Received body: ${JSON.stringify(json, null, 2)}`
      );
    }

    return instance;
  }
}
