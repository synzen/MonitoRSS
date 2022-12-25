import { FeedFetcherApiService } from "./feed-fetcher-api.service";
import nock from "nock";
import { FeedFetcherFetchFeedResponse } from "./types/feed-fetcher-fetch-feed-response.type";
import { ConfigService } from "@nestjs/config";
import logger from "../../utils/logger";

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
        requestStatus: "success",
        response: {
          body: "",
          statusCode: 200,
        },
      };
      nock(host)
        .post("/api/v1/requests", expectedRequestBody)
        .matchHeader("Content-Type", "application/json")
        .matchHeader("api-key", apiKey)
        .reply(200, mockResponse);

      const response = await service.fetchAndSave(expectedRequestBody.url, {
        getCachedResponse: false,
      });
      expect(response).toEqual(mockResponse);
    });

    it("throws if the status code is >= 500", async () => {
      nock(host).post("/api/v1/requests").reply(500, {});

      await expect(service.fetchAndSave("url")).rejects.toThrow();
    });

    it("throws if the status code is not ok, and logs the response json", async () => {
      const loggerErrorSpy = jest.spyOn(logger, "error");
      const mockResponse = { message: "An error occurred!" };
      nock(host).post("/api/v1/requests").reply(400, mockResponse);

      await expect(service.fetchAndSave("url")).rejects.toThrow();

      expect(loggerErrorSpy.mock.calls[0][0]).toEqual(
        expect.stringContaining(JSON.stringify(mockResponse))
      );
    });
  });
});
