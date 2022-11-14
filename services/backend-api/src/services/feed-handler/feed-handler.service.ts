import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import fetch from "node-fetch";
import logger from "../../utils/logger";

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

@Injectable()
export class FeedHandlerService {
  host: string;
  apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.host = this.configService.getOrThrow<string>(
      "FEED_HANDLER_API_HOST"
    ) as string;
    this.apiKey = this.configService.getOrThrow<string>("FEED_HANDLER_API_KEY");
  }

  async getRateLimits(feedId: string): Promise<FeedHandlerRateLimitsResponse> {
    try {
      const response = await fetch(`${this.host}/feeds/${feedId}/rate-limits`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
      });

      if (response.status >= 500) {
        throw new Error(
          `Feed handler api responded with >= 500 status: ${response.status})`
        );
      }

      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(
          `Feed handler api responded with non-ok status: ${
            response.status
          }, response: ${JSON.stringify(responseBody)}`
        );
      }

      return responseBody;
    } catch (error) {
      logger.error(
        `Failed to execute fetch with feed handler api (${error.message})`,
        {
          stack: error.stack,
        }
      );

      throw error;
    }
  }
}
