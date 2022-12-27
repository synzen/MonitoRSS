import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Dispatcher, request } from "undici";
import BodyReadable from "undici/types/readable";
import { ArticlesService } from "../articles/articles.service";
import { FeedResponseRequestStatus } from "../shared";
import {
  FeedRequestInternalException,
  FeedRequestNetworkException,
  FeedRequestParseException,
  FeedRequestServerStatusException,
} from "./exceptions";
import { FeedResponse } from "./types";

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

  async fetch(url: string) {
    const serviceUrl = `${this.SERVICE_HOST}/v1/feed-requests`;
    let statusCode: number;
    let body: BodyReadable & Dispatcher.BodyMixin;

    try {
      ({ statusCode, body } = await request(serviceUrl, {
        method: "POST",
        body: JSON.stringify({
          url,
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
        )})`
      );
    }

    const response: FeedResponse = await body.json();

    const { requestStatus } = response;

    if (requestStatus === FeedResponseRequestStatus.Error) {
      throw new FeedRequestInternalException(
        `Feed requests service encountered error while fetching feed`
      );
    }

    if (requestStatus === FeedResponseRequestStatus.ParseError) {
      throw new FeedRequestParseException(`Invalid feed`);
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

  async fetchFeedArticles(url: string) {
    const feedXml = await this.fetch(url);

    if (!feedXml) {
      return null;
    }

    return this.articlesService.getArticlesFromXml(feedXml);
  }

  async fetchRandomFeedArticle(url: string) {
    const result = await this.fetchFeedArticles(url);

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
