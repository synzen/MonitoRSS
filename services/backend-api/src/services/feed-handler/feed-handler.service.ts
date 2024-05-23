import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClassConstructor, plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { URLSearchParams } from "url";
import {
  StandardException,
  UnexpectedApiResponseException,
} from "../../common/exceptions";
import logger from "../../utils/logger";
import {
  FeedArticleNotFoundException,
  FeedFetcherStatusException,
  InvalidFiltersRegexException,
  InvalidPreviewCustomPlaceholdersRegexException,
} from "../feed-fetcher/exceptions";
import {
  CreateFilterValidationInput,
  CreateFilterValidationOutput,
  CreateFilterValidationResponse,
  CreatePreviewInput,
  GetArticlesInput,
  GetArticlesResponse,
  GetDeliveryCountResult,
  SendTestArticleInput,
  SendTestArticleResult,
} from "./types";
import { CreatePreviewOutput } from "./types/create-preview-output.type";

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
      "BACKEND_API_USER_FEEDS_API_HOST"
    ) as string;
    this.apiKey = this.configService.getOrThrow<string>(
      "BACKEND_API_USER_FEEDS_API_KEY"
    );
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

      return responseBody as FeedHandlerRateLimitsResponse;
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

  async getDeliveryCount(data: {
    feedId: string;
    timeWindowSec: number;
  }): Promise<GetDeliveryCountResult> {
    try {
      const response = await fetch(
        `${this.host}/v1/user-feeds/${data.feedId}/delivery-count?feedId=${data.feedId}&timeWindowSec=${data.timeWindowSec}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "api-key": this.apiKey,
          },
        }
      );

      await this.validateResponseStatus(
        response,
        "Failed to get delivery count",
        {
          requestBody: data,
        }
      );
      const json = await response.json();

      const result = await this.validateResponseJson(
        GetDeliveryCountResult,
        json as Record<string, unknown>
      );

      return result;
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
    const body = JSON.stringify(details);

    try {
      res = await fetch(`${this.host}/v1/user-feeds/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
        body,
      });
    } catch (err) {
      throw new Error(
        `Failed to send test article request through user feeds API: ${
          err.constructor.name
        }: ${(err as Error).message}. Cause: ${
          // @ts-ignore
          (err as Error)["cause"]?.["message"]
        }. Body: ${body}`
      );
    }

    if (res.status === 404) {
      throw new FeedArticleNotFoundException("Feed article not found");
    }

    await this.validateResponseStatus(
      res,
      "Failed to send test article request",
      {
        requestBody: details,
      }
    );

    const json = await res.json();

    const result = await this.validateResponseJson(
      SendTestArticleResult,
      json as Record<string, unknown>
    );

    return result;
  }

  async createPreview({
    details,
  }: CreatePreviewInput): Promise<CreatePreviewOutput> {
    let res: Response;
    const body = JSON.stringify(details);

    try {
      res = await fetch(`${this.host}/v1/user-feeds/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
        body,
      });
    } catch (err) {
      // Fetch may have some obscure errors
      throw new Error(
        `Failed to create preview through user feeds API: ${
          err.constructor.name
        }: ${(err as Error).message}`
      );
    }

    if (res.status === 404) {
      throw new FeedArticleNotFoundException("Feed article not found");
    }

    await this.validateResponseStatus(res, "Failed to create preview", {
      requestBody: details,
    });

    const json = await res.json();

    const result = await this.validateResponseJson(
      CreatePreviewOutput,
      json as Record<string, unknown>
    );

    return result;
  }

  async getArticles({
    url,
    limit,
    random,
    skip,
    filters,
    selectProperties,
    selectPropertyTypes,
    formatter,
    findRssFromHtml,
  }: GetArticlesInput): Promise<GetArticlesResponse["result"]> {
    const body = {
      url,
      limit,
      random: random,
      skip,
      filters,
      selectProperties,
      selectPropertyTypes,
      formatter,
      findRssFromHtml,
    };

    const res = await fetch(`${this.host}/v1/user-feeds/get-articles`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
    });

    await this.validateResponseStatus(res, "Failed to get articles", {
      requestBody: body,
    });

    const json = await res.json();

    const result = await this.validateResponseJson(
      GetArticlesResponse,
      json as Record<string, unknown>
    );

    return result.result;
  }

  async validateFilters({
    expression,
  }: CreateFilterValidationInput): Promise<CreateFilterValidationOutput> {
    const res = await fetch(`${this.host}/v1/user-feeds/filter-validation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
      body: JSON.stringify({
        expression,
      }),
    });

    await this.validateResponseStatus(res, "Failed to validate filters", {
      requestBody: {
        expression,
      },
    });

    const json = await res.json();

    const result = await this.validateResponseJson(
      CreateFilterValidationResponse,
      json as Record<string, unknown>
    );

    return {
      errors: result.result.errors,
    };
  }

  async getDeliveryLogs(
    feedId: string,
    { limit, skip }: { limit: number; skip: number }
  ) {
    const urlParams = new URLSearchParams({
      limit: limit.toString(),
      skip: skip.toString(),
    });

    const response = await fetch(
      `${
        this.host
      }/v1/user-feeds/${feedId}/delivery-logs?${urlParams.toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
      }
    );

    await this.validateResponseStatus(response, "Failed to get delivery logs", {
      requestBody: {
        feedId,
        limit,
        skip,
      },
    });

    return response.json();
  }

  private async validateResponseStatus(
    res: Response,
    contextMessage: string,
    meta: {
      requestBody: Record<string, unknown>;
    }
  ) {
    if (res.status >= 500) {
      throw new FeedFetcherStatusException(
        `${contextMessage}: >= 500 status code (${
          res.status
        }) from User feeds api. Meta: ${JSON.stringify(meta)}`
      );
    }

    if (res.status === HttpStatus.UNPROCESSABLE_ENTITY) {
      const json = (await res.json()) as {
        code: string;
        errors: StandardException[];
      };
      const code = json.code;

      if (code === "CUSTOM_PLACEHOLDER_REGEX_EVAL") {
        throw new InvalidPreviewCustomPlaceholdersRegexException(
          "Invalid preview input",
          {
            subErrors: json.errors,
          }
        );
      } else if (code === "FILTERS_REGEX_EVAL") {
        throw new InvalidFiltersRegexException("Invalid preview input", {
          subErrors: json.errors,
        });
      } else {
        throw new Error(
          `${contextMessage}: Unprocessable entity status code from User feeds api. Meta: ${JSON.stringify(
            meta
          )}`
        );
      }
    }

    if (!res.ok) {
      let body: Record<string, unknown> | null = null;

      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch (err) {}

      throw new FeedFetcherStatusException(
        `${contextMessage}: non-ok status code (${
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
        `Unexpected response from user feeds API: ${JSON.stringify(
          validationErrors
        )} Received body: ${JSON.stringify(json, null, 2)}`
      );
    }

    return instance;
  }
}
