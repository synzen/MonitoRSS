import {
  FeedHandlerRateLimitsResponse,
  FeedHandlerService,
} from "./feed-handler.service";
import nock from "nock";
import { ConfigService } from "@nestjs/config";
import logger from "../../utils/logger";
import {
  FeedArticleNotFoundException,
  FeedFetcherStatusException,
} from "../feed-fetcher/exceptions";
import { TestDeliveryStatus } from "./constants";
import { UnexpectedApiResponseException } from "../../common/exceptions";
import {
  CreateFilterValidationInput,
  CreateFilterValidationOutput,
  CreateFilterValidationResponse,
  CreatePreviewInput,
  GetArticlesInput,
  GetArticlesOutput,
  GetArticlesResponse,
  GetArticlesResponseRequestStatus,
} from "./types";

jest.mock("../../utils/logger");

nock.disableNetConnect();

describe("FeedHandlerService", () => {
  let service: FeedHandlerService;
  const configService: ConfigService = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  } as never;
  const host = "http://localhost:1234";
  const apiKey = "apiKey";

  beforeEach(() => {
    nock.cleanAll();
    jest.resetAllMocks();
    service = new FeedHandlerService(configService);
    service.host = host;
    service.apiKey = apiKey;
  });

  describe("getRateLimits", () => {
    const feedId = "feed-id";
    const endpoint = `/v1/user-feeds/${feedId}/rate-limits`;

    it("returns the response", async () => {
      const mockResponse: FeedHandlerRateLimitsResponse = {
        results: {
          limits: [
            {
              max: 100,
              progress: 1,
              remaining: 99,
              windowSeconds: 60,
            },
            {
              max: 100,
              progress: 1,
              remaining: 99,
              // seconds in a day
              windowSeconds: 86400,
            },
          ],
        },
      };
      nock(host)
        .get(endpoint)
        .matchHeader("Content-Type", "application/json")
        .matchHeader("api-key", apiKey)
        .reply(200, mockResponse);

      const response = await service.getRateLimits(feedId);
      expect(response).toEqual(mockResponse);
    });

    it("throws if the status code is >= 500", async () => {
      nock(host).get(endpoint).reply(500, {});

      await expect(service.getRateLimits(feedId)).rejects.toThrow();
    });

    it("throws if the status code is not ok, and logs the response json", async () => {
      const loggerErrorSpy = jest.spyOn(logger, "error");
      const mockResponse = { message: "An error occurred!" };
      nock(host).get(endpoint).reply(400, mockResponse);

      await expect(service.getRateLimits(feedId)).rejects.toThrow();

      expect(loggerErrorSpy.mock.calls[0][0]).toEqual(
        expect.stringContaining(JSON.stringify(mockResponse))
      );
    });
  });

  describe("sendTestArticle", () => {
    const endpoint = `/v1/user-feeds/test`;
    const validPayload = {
      details: {
        type: "discord" as const,
        feed: {
          url: "url",
          formatOptions: {
            dateFormat: 'yyyy-MM-dd "at" HH:mm:ss',
          },
        },
        mediumDetails: {
          channel: {
            id: "channel-id",
          },
          content: "content",
          embeds: [],
        },
      },
    };

    it("returns the result on success", async () => {
      const mockResponse = { status: TestDeliveryStatus.Success };
      nock(host)
        .post(endpoint)
        .matchHeader("Content-Type", "application/json")
        .matchHeader("api-key", apiKey)
        .reply(200, mockResponse);

      const result = await service.sendTestArticle(validPayload);

      expect(result).toEqual({
        status: TestDeliveryStatus.Success,
      });
    });

    it("throws a special exception on 404", async () => {
      nock(host).post(endpoint).reply(404, {});

      await expect(service.sendTestArticle(validPayload)).rejects.toThrow(
        FeedArticleNotFoundException
      );
    });

    it("throws if status code is 400", async () => {
      nock(host).post(endpoint).reply(400, {});

      await expect(service.sendTestArticle(validPayload)).rejects.toThrow(
        FeedFetcherStatusException
      );
    });

    it("throws if the status code is >= 500", async () => {
      nock(host).post(endpoint).reply(500, {});

      await expect(service.sendTestArticle(validPayload)).rejects.toThrow();
    });

    it("throws if the response payload is unexpected", async () => {
      nock(host).post(endpoint).reply(200, { status: "unexpected" });

      await expect(service.sendTestArticle(validPayload)).rejects.toThrow(
        UnexpectedApiResponseException
      );
    });
  });

  describe("createPreview", () => {
    const endpoint = `/v1/user-feeds/preview`;
    const validPayload: CreatePreviewInput = {
      details: {
        type: "discord" as const,
        feed: {
          url: "url",
          formatOptions: {
            dateFormat: 'yyyy-MM-dd "at" HH:mm:ss',
          },
        },
        mediumDetails: {
          channel: {
            id: "channel-id",
          },
          guildId: "",
          content: "content",
          embeds: [],
        },
      },
    };

    it("returns the result on success", async () => {
      const mockResponse = { status: TestDeliveryStatus.Success, messages: [] };
      nock(host)
        .post(endpoint)
        .matchHeader("Content-Type", "application/json")
        .matchHeader("api-key", apiKey)
        .reply(200, mockResponse);

      const result = await service.createPreview(validPayload);

      expect(result).toEqual({
        status: TestDeliveryStatus.Success,
        messages: [],
      });
    });

    it("throws a special exception on 404", async () => {
      nock(host).post(endpoint).reply(404, {});

      await expect(service.createPreview(validPayload)).rejects.toThrow(
        FeedArticleNotFoundException
      );
    });

    it("throws if status code is 400", async () => {
      nock(host).post(endpoint).reply(400, {});

      await expect(service.createPreview(validPayload)).rejects.toThrow(
        FeedFetcherStatusException
      );
    });

    it("throws if the status code is >= 500", async () => {
      nock(host).post(endpoint).reply(500, {});

      await expect(service.createPreview(validPayload)).rejects.toThrow();
    });

    it("throws if the response payload is unexpected", async () => {
      nock(host).post(endpoint).reply(200, { status: "unexpected" });

      await expect(service.createPreview(validPayload)).rejects.toThrow(
        UnexpectedApiResponseException
      );
    });
  });

  describe("getArticles", () => {
    const endpoint = `/v1/user-feeds/get-articles`;
    const validPayload: GetArticlesInput = {
      limit: 1,
      url: "https://www.get-articles-input.com",
      random: true,
      skip: 0,
      formatter: {
        options: {
          formatTables: false,
          stripImages: false,
          dateFormat: "yyyy-MM-dd",
          dateTimezone: undefined,
          disableImageLinkPreviews: false,
        },
      },
    };

    it("returns the result on success", async () => {
      const mockResponse: GetArticlesResponse = {
        result: {
          requestStatus: GetArticlesResponseRequestStatus.Success,
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
        },
      };

      nock(host)
        .post(endpoint)
        .matchHeader("Content-Type", "application/json")
        .matchHeader("api-key", apiKey)
        .reply(200, mockResponse);

      const result = await service.getArticles(validPayload);

      const expectedResult: GetArticlesOutput = {
        requestStatus: GetArticlesResponseRequestStatus.Success,
        articles: [],
        totalArticles: 0,
        selectedProperties: [],
      };

      expect(result).toEqual(expectedResult);
    });

    it("throws if status code is 400", async () => {
      nock(host).post(endpoint).reply(400, {});

      await expect(service.getArticles(validPayload)).rejects.toThrow(
        FeedFetcherStatusException
      );
    });

    it("throws if the status code is >= 500", async () => {
      nock(host).post(endpoint).reply(500, {});

      await expect(service.getArticles(validPayload)).rejects.toThrow();
    });

    it("throws if the response payload is unexpected", async () => {
      nock(host).post(endpoint).reply(200, { status: "unexpected" });

      await expect(service.getArticles(validPayload)).rejects.toThrow(
        UnexpectedApiResponseException
      );
    });
  });

  describe("validateFilters", () => {
    const validPayload: CreateFilterValidationInput = {
      expression: {
        foo: "bar",
      },
    };
    const endpoint = `/v1/user-feeds/filter-validation`;

    it("returns the result on success", async () => {
      const mockResponse: CreateFilterValidationResponse = {
        result: {
          errors: ["foo", "bar"],
        },
      };

      nock(host)
        .post(endpoint)
        .matchHeader("Content-Type", "application/json")
        .matchHeader("api-key", apiKey)
        .reply(200, mockResponse);

      const result = await service.validateFilters(validPayload);

      const expectedResult: CreateFilterValidationOutput = {
        errors: ["foo", "bar"],
      };

      expect(result).toEqual(expectedResult);
    });

    it("throws if status code is not ok", async () => {
      nock(host).post(endpoint).reply(400, {});

      await expect(service.validateFilters(validPayload)).rejects.toThrow(
        FeedFetcherStatusException
      );
    });

    it("throws if the response payload is unexpected", async () => {
      nock(host).post(endpoint).reply(200, { status: "unexpected" });

      await expect(service.validateFilters(validPayload)).rejects.toThrow(
        UnexpectedApiResponseException
      );
    });
  });
});
