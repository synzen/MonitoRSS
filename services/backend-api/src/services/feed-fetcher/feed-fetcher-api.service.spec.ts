import { FeedFetcherApiService } from "./feed-fetcher-api.service";
import nock from "nock";
import {
  FeedFetcherFetchFeedResponse,
  FeedFetcherFetchStatus,
} from "./types/feed-fetcher-fetch-feed-response.type";
import { ConfigService } from "@nestjs/config";
import logger from "../../utils/logger";
import { FeedFetcherGetRequestsResponse } from "./types/feed-fetcher-get-requests-response.type";
import { URLSearchParams } from "url";
import { UnexpectedApiResponseException } from "../../common/exceptions";

jest.mock("../../utils/logger");

describe("FeedFetcherApiService", () => {
  let service: FeedFetcherApiService;
  const configService: ConfigService = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  } as never;
  const host = "http://localhost:1234";
  const apiKey = "apiKey";

  beforeEach(() => {
    jest.resetAllMocks();
    service = new FeedFetcherApiService(configService);
    service.host = host;
    service.apiKey = apiKey;
  });

  describe("fetchAndSave", () => {
    const urlToRequest = "https://example.com/feed.xml";

    it("throws if host is not defined", async () => {
      service.host = undefined as never;

      await expect(service.fetchAndSave(urlToRequest)).rejects.toThrow();
    });

    it("returns the response", async () => {
      const expectedRequestBody = {
        url: urlToRequest,
        executeFetch: true,
      };
      const mockResponse: FeedFetcherFetchFeedResponse = {
        requestStatus: FeedFetcherFetchStatus.Success,
        response: {
          body: "",
          statusCode: 200,
        },
      };
      nock(host)
        .post("/v1/feed-requests", expectedRequestBody)
        .matchHeader("Content-Type", "application/json")
        .matchHeader("api-key", apiKey)
        .reply(200, mockResponse);

      const response = await service.fetchAndSave(expectedRequestBody.url, {
        getCachedResponse: false,
      });
      expect(response).toEqual(mockResponse);
    });

    it("throws if the status code is >= 500", async () => {
      nock(host).post("/v1/feed-requests").reply(500, {});

      await expect(service.fetchAndSave("url")).rejects.toThrow();
    });

    it("throws if the status code is not ok, and logs the response json", async () => {
      const loggerErrorSpy = jest.spyOn(logger, "error");
      const mockResponse = { message: "An error occurred!" };
      nock(host).post("/v1/feed-requests").reply(400, mockResponse);

      await expect(service.fetchAndSave("url")).rejects.toThrow();

      expect(loggerErrorSpy.mock.calls[0][0]).toEqual(
        expect.stringContaining(JSON.stringify(mockResponse))
      );
    });
  });

  describe("getRequests", () => {
    const validPayload = {
      limit: 10,
      skip: 0,
      url: "https://example.com/feed.xml",
    };
    const endpoint = `/v1/feed-requests`;
    const expectedQuery = new URLSearchParams({
      limit: validPayload.limit.toString(),
      skip: validPayload.skip.toString(),
      url: validPayload.url,
    });

    it("returns the result on success", async () => {
      const mockResponse: FeedFetcherGetRequestsResponse = {
        result: {
          nextRetryTimestamp: 123,
          requests: [],
        },
      };

      nock(host)
        .get(endpoint)
        .query(expectedQuery)
        .matchHeader("Content-Type", "application/json")
        .matchHeader("api-key", apiKey)
        .reply(200, mockResponse);

      const result = await service.getRequests(validPayload);

      expect(result).toEqual(mockResponse);
    });

    it("throws if status code is not ok", async () => {
      nock(host).get(endpoint).query(expectedQuery).reply(400, {});

      await expect(service.getRequests(validPayload)).rejects.toThrow(Error);
    });

    it("throws if the response payload is unexpected", async () => {
      nock(host)
        .get(endpoint)
        .query(expectedQuery)
        .reply(200, { status: "unexpected" });

      await expect(service.getRequests(validPayload)).rejects.toThrow(
        UnexpectedApiResponseException
      );
    });
  });
});
