import { Test, TestingModule } from "@nestjs/testing";
import { FeedFetcherService } from "./feed-fetcher.service";
import { Interceptable, MockAgent, setGlobalDispatcher } from "undici";
import { ConfigService } from "@nestjs/config";
import {
  FeedArticleNotFoundException,
  FeedRequestBadStatusCodeException,
  FeedRequestFetchException,
  FeedRequestInternalException,
  FeedRequestNetworkException,
  FeedRequestParseException,
  FeedRequestServerStatusException,
} from "./exceptions";
import { ArticlesService } from "../articles/articles.service";
import { FeedResponseRequestStatus } from "../shared";

const serviceHost = "https://request-service.com";

describe("FeedFetcherService", () => {
  const articlesService = {
    getArticlesFromXml: jest.fn(),
  };
  let service: FeedFetcherService;
  let client: Interceptable;
  const interceptPath = "/";

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
        {
          provide: ArticlesService,
          useValue: articlesService,
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

      await expect(service.fetch("url")).rejects.toThrowError(
        FeedRequestNetworkException
      );
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

    it("throws the correct error if request status in body is internal error", async () => {
      client
        .intercept({
          path: interceptPath,
          method: "POST",
        })
        .reply(200, {
          requestStatus: FeedResponseRequestStatus.InternalError,
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
          requestStatus: FeedResponseRequestStatus.ParseError,
        });

      await expect(service.fetch("url")).rejects.toThrowError(
        FeedRequestParseException
      );
    });

    it("throws the correct error if request status in body is bad status code", async () => {
      client
        .intercept({
          path: interceptPath,
          method: "POST",
        })
        .reply(200, {
          requestStatus: FeedResponseRequestStatus.BadStatusCode,
          response: {
            statusCode: 403,
          },
        });

      await expect(service.fetch("url")).rejects.toThrowError(
        FeedRequestBadStatusCodeException
      );
    });

    it("throws the correct error if request status in body is a fetch network error", async () => {
      client
        .intercept({
          path: interceptPath,
          method: "POST",
        })
        .reply(200, {
          requestStatus: FeedResponseRequestStatus.FetchError,
        });

      await expect(service.fetch("url")).rejects.toThrowError(
        FeedRequestFetchException
      );
    });

    it("returns null if request status is pending", async () => {
      client
        .intercept({
          path: interceptPath,
          method: "POST",
        })
        .reply(200, {
          requestStatus: FeedResponseRequestStatus.Pending,
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

  describe("fetchFeedArticles", () => {
    it("returns null if request is pending", async () => {
      jest.spyOn(service, "fetch").mockResolvedValue(null);

      await expect(service.fetchFeedArticles("url")).resolves.toEqual(null);
    });

    it("returns the result", async () => {
      const feedText = "feed-text";
      jest.spyOn(service, "fetch").mockResolvedValue(feedText);

      articlesService.getArticlesFromXml.mockReturnValue({
        articles: [],
      });

      await expect(service.fetchFeedArticles("url")).resolves.toEqual({
        articles: [],
      });
    });
  });

  describe("fetchFeedArticle", () => {
    it("throws if request is still pending", async () => {
      jest.spyOn(service, "fetchFeedArticles").mockResolvedValue(null);

      await expect(
        service.fetchFeedArticle("url", "id")
      ).rejects.toThrowError();
    });

    it("returns null if there are 0 articles", async () => {
      jest.spyOn(service, "fetchFeedArticles").mockResolvedValue({
        articles: [],
      });

      await expect(service.fetchFeedArticle("url", "id")).resolves.toEqual(
        null
      );
    });

    it("throws if article ID was not found", async () => {
      jest.spyOn(service, "fetchFeedArticles").mockResolvedValue({
        articles: [
          {
            id: "2",
          },
        ],
      });

      await expect(service.fetchFeedArticle("url", "1")).rejects.toThrowError(
        FeedArticleNotFoundException
      );
    });

    it("returns the article with the correct id", async () => {
      const article1 = { id: "1", title: "title", link: "link" };
      const article2 = { id: "2", title: "title", link: "link" };
      jest.spyOn(service, "fetchFeedArticles").mockResolvedValue({
        articles: [article1, article2],
      });

      await expect(service.fetchFeedArticle("url", "2")).resolves.toEqual(
        article2
      );
    });
  });

  describe("fetchRandomFeedArticle", () => {
    it("throws if request is still pending", async () => {
      jest.spyOn(service, "fetchFeedArticles").mockResolvedValue(null);

      await expect(
        service.fetchRandomFeedArticle("url")
      ).rejects.toThrowError();
    });

    it("returns null if there are 0 articles", async () => {
      jest.spyOn(service, "fetchFeedArticles").mockResolvedValue({
        articles: [],
      });

      await expect(service.fetchRandomFeedArticle("url")).resolves.toEqual(
        null
      );
    });

    it("returns the first article if there is only 1 article", async () => {
      const article = { id: "1", title: "title", link: "link" };
      jest.spyOn(service, "fetchFeedArticles").mockResolvedValue({
        articles: [article],
      });

      await expect(service.fetchRandomFeedArticle("url")).resolves.toEqual(
        article
      );
    });

    it("returns a random article if there are more than 1 article", async () => {
      const article1 = { id: "1", title: "title", link: "link" };
      const article2 = { id: "2", title: "title", link: "link" };
      jest.spyOn(service, "fetchFeedArticles").mockResolvedValue({
        articles: [article1, article2],
      });

      await expect(service.fetchRandomFeedArticle("url")).resolves.toEqual(
        expect.objectContaining({
          id: expect.any(String),
        })
      );
    });
  });
});
