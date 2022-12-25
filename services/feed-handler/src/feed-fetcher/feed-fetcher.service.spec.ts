import { Test, TestingModule } from "@nestjs/testing";
import { FeedFetcherService } from "./feed-fetcher.service";
import { Interceptable, MockAgent, setGlobalDispatcher } from "undici";
import { ConfigService } from "@nestjs/config";
import {
  FeedRequestInternalException,
  FeedRequestParseException,
  FeedRequestServerStatusException,
} from "./exceptions";

const serviceHost = "https://request-service.com";

describe("FeedFetcherService", () => {
  let service: FeedFetcherService;
  let client: Interceptable;
  const interceptPath = "/api/v1/feed-requests";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedFetcherService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FeedFetcherService>(FeedFetcherService);
    service.SERVICE_HOST = serviceHost;

    const agent = new MockAgent();
    agent.disableNetConnect();
    client = agent.get(serviceHost);

    setGlobalDispatcher(agent);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("fetch", () => {
    it("throws if the request failed", async () => {
      const thrownError = new Error("Internal error occurred");
      client
        .intercept({
          path: interceptPath,
          method: "POST",
        })
        .replyWithError(thrownError);

      await expect(service.fetch("url")).rejects.toThrowError(thrownError);
    });

    it("throws the correct error if status code is not ok", async () => {
      client
        .intercept({
          path: interceptPath,
          method: "POST",
        })
        .reply(400, {});

      await expect(service.fetch("url")).rejects.toThrowError(
        FeedRequestServerStatusException
      );
    });

    it("throws the correct error if request status in body is error", async () => {
      client
        .intercept({
          path: interceptPath,
          method: "POST",
        })
        .reply(200, {
          requestStatus: "error",
        });

      await expect(service.fetch("url")).rejects.toThrowError(
        FeedRequestInternalException
      );
    });

    it("throws the correct error if request status in body is parse error", async () => {
      client
        .intercept({
          path: interceptPath,
          method: "POST",
        })
        .reply(200, {
          requestStatus: "parse_error",
        });

      await expect(service.fetch("url")).rejects.toThrowError(
        FeedRequestParseException
      );
    });

    it("returns null if request status is pending", async () => {
      client
        .intercept({
          path: interceptPath,
          method: "POST",
        })
        .reply(200, {
          requestStatus: "pending",
        });

      await expect(service.fetch("url")).resolves.toEqual(null);
    });

    it("returns the response body if request status is success", async () => {
      const feedText = "feed-text";
      client
        .intercept({
          path: interceptPath,
          method: "POST",
        })
        .reply(200, {
          requestStatus: "success",
          response: {
            body: feedText,
          },
        });

      await expect(service.fetch("url")).resolves.toEqual(feedText);
    });

    it("throws an error if feed status is unrecognized", async () => {
      client
        .intercept({
          path: interceptPath,
          method: "POST",
        })
        .reply(200, {
          requestStatus: "unknown",
        });

      await expect(service.fetch("url")).rejects.toThrowError();
    });
  });
});
