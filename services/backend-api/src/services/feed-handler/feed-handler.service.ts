import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { validate } from "class-validator";
import fetch, { Response } from "node-fetch";
import { UnexpectedApiResponseException } from "../../common/exceptions";
import logger from "../../utils/logger";
import { FeedFetcherStatusException } from "../feed-fetcher/exceptions";
import { SendTestArticleInput, SendTestArticleResult } from "./types";

export interface FeedHandlerRateLimitsResponse {
  results: {
    limits: Array<{
      progress: number;
      max: number;
      remaining: number;
      windowSeconds: number;
    }>;
  };
}

interface InitializeFeedInput {
  maxDailyArticles: number;
}

@Injectable()
export class FeedHandlerService {
  host: string;
  apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.host = this.configService.getOrThrow<string>(
      "BACKEND_API_USER_FEEDS_API_HOST"
    ) as string;
    this.apiKey = this.configService.getOrThrow<string>(
      "BACKEND_API_USER_FEEDS_API_KEY"
    );
  }

  async initializeFeed(
    feedId: string,
    { maxDailyArticles }: InitializeFeedInput
  ) {
    const res = await fetch(`${this.host}/v1/user-feeds/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
      body: JSON.stringify({
        feed: {
          id: feedId,
        },
        articleDailyLimit: maxDailyArticles,
      }),
    });

    if (res.status >= 500) {
      throw new FeedFetcherStatusException(
        `Failed to initialize feed: >= 500 status code (${res.status}) from User feeds api`
      );
    }

    if (!res.ok) {
      const body = await res.json();

      throw new FeedFetcherStatusException(
        `Failed to initialize feed: non-ok status code (${
          res.status
        }) from User feeds api, response: ${JSON.stringify(body)}`
      );
    }
  }

  async getRateLimits(feedId: string): Promise<FeedHandlerRateLimitsResponse> {
    try {
      const response = await fetch(
        `${this.host}/v1/user-feeds/${feedId}/rate-limits`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "api-key": this.apiKey,
          },
        }
      );

      if (response.status >= 500) {
        throw new Error(
          `User feeds api responded with >= 500 status: ${response.status})`
        );
      }

      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(
          `User feeds api responded with non-ok status: ${
            response.status
          }, response: ${JSON.stringify(responseBody)}`
        );
      }

      return responseBody;
    } catch (error) {
      logger.error(
        `Failed to execute fetch with User feeds api (${error.message})`,
        {
          stack: error.stack,
        }
      );

      throw error;
    }
  }

  async sendTestArticle({
    details,
  }: SendTestArticleInput): Promise<SendTestArticleResult> {
    let res: Response;

    try {
      res = await fetch(`${this.host}/v1/user-feeds/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
        body: JSON.stringify(details),
      });
    } catch (err) {
      // Fetch may have some obscure errors
      throw new Error(
        `Failed to send test article request through user feeds API: ${
          err.constructor.name
        }: ${(err as Error).message}`
      );
    }

    if (!res.ok) {
      let json: Record<string, unknown> | null = null;

      try {
        json = await res.json();
      } catch (err) {}

      throw new FeedFetcherStatusException(
        `Non-ok status code from user feeds API: ${
          res.status
        }. Response: ${JSON.stringify(json, null, 2)}`
      );
    }

    const json = await res.json();

    const result = new SendTestArticleResult();
    result.status = json.status;
    result.apiResponse = json.apiResponse;

    const validationErrors = await validate(result);

    if (validationErrors.length > 0) {
      throw new UnexpectedApiResponseException(
        `Unexpected response from user feeds API: ${JSON.stringify(
          validationErrors
        )} Received body: ${JSON.stringify(result, null, 2)}`
      );
    }

    return result;
  }
}
