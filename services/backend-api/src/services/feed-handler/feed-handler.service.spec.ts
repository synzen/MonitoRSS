import {
  FeedHandlerRateLimitsResponse,
  FeedHandlerService,
} from "./feed-handler.service";
import nock from "nock";
import { ConfigService } from "@nestjs/config";
import logger from "../../utils/logger";
import { FeedFetcherStatusException } from "../feed-fetcher/exceptions";

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
    const endpoint = `/api/v1/user-feeds/${feedId}/rate-limits`;

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

  describe("initializeFeed", () => {
    const feedId = "feed-id";
    const endpoint = `/v1/user-feeds/initialize`;

    it("resolves on success", async () => {
      nock(host)
        .post(endpoint)
        .matchHeader("Content-Type", "application/json")
        .matchHeader("api-key", apiKey)
        .reply(200, {});

      await service.initializeFeed(feedId, {
        maxDailyArticles: 100,
      });
    });

    it("throws if the status code is >= 500", async () => {
      nock(host).post(endpoint).reply(500, {});

      await expect(
        service.initializeFeed(feedId, {
          maxDailyArticles: 100,
        })
      ).rejects.toThrow(FeedFetcherStatusException);
    });

    it("throws if the status code is not ok, and logs the response json", async () => {
      const mockResponse = { message: "An error occurred!" };
      nock(host).post(endpoint).reply(400, mockResponse);

      await expect(
        service.initializeFeed(feedId, {
          maxDailyArticles: 100,
        })
      ).rejects.toThrow(FeedFetcherStatusException);
    });
  });
});
