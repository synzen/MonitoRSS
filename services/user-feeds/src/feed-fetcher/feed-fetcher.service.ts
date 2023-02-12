import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Dispatcher, request } from "undici";
import BodyReadable from "undici/types/readable";
import { ArticlesService } from "../articles/articles.service";
import { FeedResponseRequestStatus, UserFeedFormatOptions } from "../shared";
import {
  FeedArticleNotFoundException,
  FeedRequestBadStatusCodeException,
  FeedRequestFetchException,
  FeedRequestInternalException,
  FeedRequestNetworkException,
  FeedRequestParseException,
  FeedRequestServerStatusException,
} from "./exceptions";
import { FeedResponse } from "./types";

interface FetchFeedArticleOptions {
  formatOptions: UserFeedFormatOptions;
}

@Injectable()
export class FeedFetcherService {
  SERVICE_HOST: string;
  API_KEY: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly articlesService: ArticlesService
  ) {
    this.SERVICE_HOST = configService.getOrThrow(
      "USER_FEEDS_FEED_REQUESTS_API_URL"
    );
    this.API_KEY = configService.getOrThrow("USER_FEEDS_FEED_REQUESTS_API_KEY");
  }

  async fetch(
    url: string,
    options?: {
      executeFetchIfNotInCache?: boolean;
    }
  ) {
    const serviceUrl = this.SERVICE_HOST;
    let statusCode: number;
    let body: BodyReadable & Dispatcher.BodyMixin;

    try {
      ({ statusCode, body } = await request(serviceUrl, {
        method: "POST",
        body: JSON.stringify({
          url,
          executeFetchIfNotInCache: options?.executeFetchIfNotInCache ?? false,
        }),
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "api-key": this.API_KEY,
        },
      }));
    } catch (err) {
      throw new FeedRequestNetworkException(
        `Failed to execute request to feed requests API: ${
          (err as Error).message
        }`
      );
    }

    if (statusCode < 200 || statusCode >= 300) {
      let bodyJson: Record<string, unknown> = {};

      try {
        bodyJson = await body.json();
      } catch (err) {}

      throw new FeedRequestServerStatusException(
        `Bad status code for ${serviceUrl} (${statusCode}) (${JSON.stringify(
          bodyJson
        )}).`
      );
    }

    const response: FeedResponse = await body.json();

    const { requestStatus } = response;

    if (requestStatus === FeedResponseRequestStatus.InternalError) {
      throw new FeedRequestInternalException(
        `Feed requests service encountered internal error while fetching feed`
      );
    }

    if (requestStatus === FeedResponseRequestStatus.ParseError) {
      throw new FeedRequestParseException(`Invalid feed`);
    }

    if (requestStatus === FeedResponseRequestStatus.FetchError) {
      throw new FeedRequestFetchException(
        "Fetch on user feeds service failed, likely a network error"
      );
    }

    if (requestStatus === FeedResponseRequestStatus.BadStatusCode) {
      throw new FeedRequestBadStatusCodeException(
        `Bad status code received for feed request (${response.response.statusCode})`,
        response.response.statusCode
      );
    }

    if (requestStatus === FeedResponseRequestStatus.Pending) {
      return null;
    }

    if (requestStatus === FeedResponseRequestStatus.Success) {
      return response.response.body;
    }

    throw new Error(
      `Unexpected feed request status in response: ${requestStatus}`
    );
  }

  async fetchFeedArticles(
    url: string,
    { formatOptions }: FetchFeedArticleOptions
  ) {
    const feedXml = await this.fetch(url, {
      executeFetchIfNotInCache: true,
    });

    if (!feedXml) {
      return null;
    }

    return this.articlesService.getArticlesFromXml(feedXml, {
      formatOptions: {
        dateFormat: formatOptions.dateFormat,
      },
    });
  }

  async fetchFeedArticle(
    url: string,
    id: string,
    { formatOptions }: FetchFeedArticleOptions
  ) {
    const result = await this.fetchFeedArticles(url, {
      formatOptions: {
        dateFormat: formatOptions.dateFormat,
      },
    });

    if (!result) {
      throw new Error(`Request for ${url} is still pending`);
    }

    const { articles } = result;

    if (!articles.length) {
      return null;
    }

    const article = articles.find((article) => article.id === id);

    if (!article) {
      throw new FeedArticleNotFoundException(
        `Article with id ${id} for url ${url} not found`
      );
    }

    return article;
  }

  async fetchRandomFeedArticle(
    url: string,
    { formatOptions }: FetchFeedArticleOptions
  ) {
    const result = await this.fetchFeedArticles(url, {
      formatOptions: {
        dateFormat: formatOptions.dateFormat,
      },
    });

    if (!result) {
      throw new Error(`Request for ${url} is still pending`);
    }

    if (!result.articles.length) {
      return null;
    }

    const { articles } = result;

    return articles[Math.floor(Math.random() * articles.length)];
  }
}
