import { ConfigService } from "@nestjs/config";
import { FeedFetcherService } from "./feed-fetcher.service";
import nock from "nock";
import path from "path";
import { URL } from "url";
import { FeedFetcherApiService } from "./feed-fetcher-api.service";
import { FeedParseException } from "./exceptions";
import { Readable } from "stream";
import { readFileSync } from "fs";

describe("FeedFetcherService", () => {
  let service: FeedFetcherService;
  let configService: ConfigService;
  const feedUrl = "https://rss-feed.com/feed.xml";
  const url = new URL(feedUrl);
  const feedFilePath = path.join(
    __dirname,
    "..",
    "..",
    "test",
    "data",
    "feed.xml"
  );
  const feedFetcherApiService: FeedFetcherApiService = {
    fetchAndSave: jest.fn(),
  } as never;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as never;
    service = new FeedFetcherService(configService, feedFetcherApiService);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("fetchFeed", () => {
    it("returns the articles and id type", async () => {
      nock(url.origin).get(url.pathname).replyWithFile(200, feedFilePath, {
        "Content-Type": "application/xml",
      });

      const { articles, idType } = await service.fetchFeed(feedUrl, {
        fetchOptions: {
          useServiceApi: false,
          useServiceApiCache: false,
        },
      });
      expect(articles).toBeInstanceOf(Array);
      expect(typeof idType).toBe("string");
    });

    it("throws when status code is non-200", async () => {
      nock(url.origin).get(url.pathname).replyWithFile(401, feedFilePath, {
        "Content-Type": "application/xml",
      });

      await expect(
        service.fetchFeed(feedUrl, {
          fetchOptions: {
            useServiceApi: false,
            useServiceApiCache: false,
          },
        })
      ).rejects.toThrow();
    });

    it("attches id property to all the articles", async () => {
      nock(url.origin).get(url.pathname).replyWithFile(200, feedFilePath, {
        "Content-Type": "application/xml",
      });

      const { articles } = await service.fetchFeed(feedUrl, {
        fetchOptions: {
          useServiceApi: false,
          useServiceApiCache: false,
        },
      });
      const allArticleIds = articles.map((article) => article.id);
      expect(allArticleIds.every((id) => id)).toBeTruthy();
    });

    describe("with service api", () => {
      it("returns the articles and id type", async () => {
        jest.spyOn(feedFetcherApiService, "fetchAndSave").mockResolvedValue({
          requestStatus: "success",
          response: {
            statusCode: 200,
            body: readFileSync(feedFilePath, "utf8"),
          },
        });

        const { articles, idType } = await service.fetchFeed(feedUrl, {
          fetchOptions: {
            useServiceApi: true,
            useServiceApiCache: false,
          },
        });

        expect(articles).toBeInstanceOf(Array);
        expect(typeof idType).toBe("string");
      });
    });
  });

  describe("fetchFeedStreamFromApiService", () => {
    it("throws an error if request status is error", async () => {
      jest.spyOn(feedFetcherApiService, "fetchAndSave").mockResolvedValue({
        requestStatus: "error",
      });

      await expect(
        service.fetchFeedStreamFromApiService(feedUrl, {
          getCachedResponse: false,
        })
      ).rejects.toThrow(Error);
    });

    it("throws an feed parse exception if request status has parse error", async () => {
      jest.spyOn(feedFetcherApiService, "fetchAndSave").mockResolvedValue({
        requestStatus: "parse_error",
        response: {
          statusCode: 200,
        },
      });

      await expect(
        service.fetchFeedStreamFromApiService(feedUrl, {
          getCachedResponse: false,
        })
      ).rejects.toThrow(FeedParseException);
    });

    it("returns a readable if request status is pending", async () => {
      jest.spyOn(feedFetcherApiService, "fetchAndSave").mockResolvedValue({
        requestStatus: "pending",
      });

      const readable = await service.fetchFeedStreamFromApiService(feedUrl, {
        getCachedResponse: false,
      });
      expect(readable).toBeInstanceOf(Readable);
    });

    it("returns a readable if request status is success", async () => {
      jest.spyOn(feedFetcherApiService, "fetchAndSave").mockResolvedValue({
        requestStatus: "success",
        response: {
          body: "<xml></xml>",
          statusCode: 200,
        },
      });

      const readable = await service.fetchFeedStreamFromApiService(feedUrl, {
        getCachedResponse: false,
      });
      expect(readable).toBeInstanceOf(Readable);
    });

    it("throws for an unhandled request status", async () => {
      jest.spyOn(feedFetcherApiService, "fetchAndSave").mockResolvedValue({
        requestStatus: "unhandled" as never,
      });

      await expect(
        service.fetchFeedStreamFromApiService(feedUrl, {
          getCachedResponse: false,
        })
      ).rejects.toThrow(Error);
    });
  });
});
