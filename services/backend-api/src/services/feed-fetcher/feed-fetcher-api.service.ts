import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import fetch from "node-fetch";
import logger from "../../utils/logger";
import { FeedFetcherFetchFeedResponse } from "./types/feed-fetcher-fetch-feed-response.type";

interface FeedFetchOptions {
  getCachedResponse?: boolean;
}

@Injectable()
export class FeedFetcherApiService {
  host: string;
  apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.host = this.configService.get<string>(
      "FEED_FETCHER_API_HOST"
    ) as string;
    this.apiKey = this.configService.getOrThrow<string>("FEED_FETCHER_API_KEY");
  }

  async fetchAndSave(
    url: string,
    options?: FeedFetchOptions
  ): Promise<FeedFetcherFetchFeedResponse> {
    if (!this.host) {
      throw new Error(
        "FEED_FETCHER_API_HOST config variable must be defined for use before executing a request"
      );
    }

    try {
      const response = await fetch(`${this.host}/requests`, {
        method: "POST",
        body: JSON.stringify({
          url,
          executeFetch: options?.getCachedResponse ? false : true,
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

      return responseBody;
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
}
