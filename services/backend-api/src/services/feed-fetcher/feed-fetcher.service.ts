import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import FeedParser from "feedparser";
import { FeedData } from "./types/FeedData.type";
// @ts-ignore
import ArticleIDResolver from "./utils/ArticleIDResolver";
// @ts-ignore
import Article from "./utils/Article";
import {
  InvalidFeedException,
  FeedParseException,
  FeedParseTimeoutException,
  FeedRequestException,
  FeedTooManyRequestsException,
  FeedUnauthorizedException,
  FeedForbiddenException,
  FeedInternalErrorException,
  FeedNotFoundException,
  FeedFetchTimeoutException,
  FeedInvalidSslCertException,
} from "./exceptions";
import { FeedFetcherApiService } from "./feed-fetcher-api.service";
import { Readable } from "stream";
import { FeedFetcherFetchStatus } from "./types/feed-fetcher-fetch-feed-response.type";
import { FeedTooLargeException } from "./exceptions/FeedTooLargeException";
import { FeedRequestLookupDetails } from "../../common/types/feed-request-lookup-details.type";

interface FetchFeedOptions {
  formatTables?: boolean;
  imgLinksExistence?: boolean;
  imgPreviews?: boolean;
  fetchOptions: {
    useServiceApi: boolean;
    useServiceApiCache: boolean;
    debug?: boolean;
  };
}

interface FeedFetchResult {
  articles: Article[];
  idType?: string;
}

@Injectable()
export class FeedFetcherService {
  constructor(
    private readonly configService: ConfigService,
    private feedFetcherApiService: FeedFetcherApiService
  ) {}

  async fetchFeed(
    url: string,
    lookupDetails: FeedRequestLookupDetails | null,
    options: FetchFeedOptions
  ): Promise<FeedFetchResult> {
    let inputStream: NodeJS.ReadableStream;

    if (!options.fetchOptions.useServiceApi) {
      throw new Error("Non-service api fetches are not supported");
    } else {
      inputStream = await this.fetchFeedStreamFromApiService(
        url,
        lookupDetails,
        {
          getCachedResponse: options.fetchOptions.useServiceApiCache,
          debug: options.fetchOptions.debug,
        }
      );
    }

    const { articleList, idType } = await this.parseFeed(inputStream);

    const articles = this.convertRawObjectsToArticles(articleList, options);

    return {
      articles,
      idType,
    };
  }

  async fetchFeedStream(url: string): Promise<NodeJS.ReadableStream> {
    const userAgent = this.configService.get<string>(
      "BACKEND_API_FEED_USER_AGENT"
    );
    const controller = new AbortController();
    const signal = controller.signal;

    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    const res = await fetch(url, {
      signal,
      headers: {
        "user-agent": userAgent || "",
      },
    });

    clearTimeout(timeout);

    this.handleStatusCode(res.status);

    if (!res.body) {
      throw new Error(`Non-200 status code (${res.status})`);
    }

    return res.body as never;
  }

  async fetchFeedStreamFromApiService(
    url: string,
    lookupDetails: FeedRequestLookupDetails | null,
    options?: {
      getCachedResponse?: boolean;
      debug?: boolean;
    }
  ): Promise<NodeJS.ReadableStream> {
    const result = await this.feedFetcherApiService.fetchAndSave(
      url,
      lookupDetails,
      options
    );

    if (result.requestStatus === FeedFetcherFetchStatus.BadStatusCode) {
      if (result.response?.statusCode) {
        this.handleStatusCode(result.response.statusCode);
      }

      throw new Error("Prior feed requests have failed");
    }

    if (result.requestStatus === FeedFetcherFetchStatus.ParseError) {
      throw new FeedParseException(
        `Feed host failed to return a valid, parseable feed`
      );
    }

    if (result.requestStatus === FeedFetcherFetchStatus.FetchTimeout) {
      throw new FeedFetchTimeoutException(`Feed fetch timed out`);
    }

    if (result.requestStatus === FeedFetcherFetchStatus.RefusedLargeFeed) {
      throw new FeedTooLargeException(`Feed is too large to be processed`);
    }

    if (result.requestStatus === FeedFetcherFetchStatus.InvalidSslCertificate) {
      throw new FeedInvalidSslCertException(
        `Feed host has an invalid SSL certificate`
      );
    }

    if (result.requestStatus === FeedFetcherFetchStatus.Success) {
      this.handleStatusCode(result.response.statusCode);
      const readable = new Readable();
      readable.push(result.response.body);
      readable.push(null);

      return readable;
    }

    if (result.requestStatus === FeedFetcherFetchStatus.Pending) {
      const readable = new Readable();
      readable.push(null);

      return readable;
    }

    throw new Error(`Unhandled request status: ${result["requestStatus"]}`);
  }

  async parseFeed(inputStream: NodeJS.ReadableStream): Promise<FeedData> {
    const feedparser = new FeedParser({});
    const idResolver = new ArticleIDResolver();
    const articleList: FeedParser.Item[] = [];

    return new Promise<FeedData>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new FeedParseTimeoutException());
      }, 10000);

      inputStream.on("error", (err: Error) => {
        // feedparser may not handle all errors such as incorrect headers. (feedparser v2.2.9)
        reject(new FeedParseException(err.message));
      });

      feedparser.on("error", (err: Error) => {
        if (err.message === "Not a feed") {
          reject(
            new InvalidFeedException(
              "That is a not a valid feed. Note that you cannot add just any link. " +
                "You may check if it is a valid feed by using online RSS feed validators"
            )
          );
        } else {
          reject(new FeedParseException(err.message));
        }
      });

      feedparser.on("readable", function (this: FeedParser) {
        let item;

        do {
          item = this.read();

          if (item) {
            idResolver.recordArticle(item);
            articleList.push(item);
          }
        } while (item);
      });

      feedparser.on("end", () => {
        clearTimeout(timeout);

        if (articleList.length === 0) {
          return resolve({ articleList });
        }

        clearTimeout(timeout);
        const idType = idResolver.getIDType();

        for (const article of articleList) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          article._id = ArticleIDResolver.getIDTypeValue(article, idType);
        }

        resolve({ articleList, idType });
      });

      inputStream.pipe(feedparser);
    });
  }

  handleStatusCode(code: number) {
    if (code === HttpStatus.OK) {
      return;
    }

    if (code === HttpStatus.TOO_MANY_REQUESTS) {
      throw new FeedTooManyRequestsException();
    } else if (code === HttpStatus.UNAUTHORIZED) {
      throw new FeedUnauthorizedException();
    } else if (code === HttpStatus.FORBIDDEN) {
      throw new FeedForbiddenException();
    } else if (code === HttpStatus.NOT_FOUND) {
      throw new FeedNotFoundException();
    } else if (code >= HttpStatus.INTERNAL_SERVER_ERROR) {
      throw new FeedInternalErrorException();
    } else {
      throw new FeedRequestException(`Non-200 status code (${code})`);
    }
  }

  private convertRawObjectsToArticles(
    feedparserItems: FeedParser.Item[],
    feedOptions?: FetchFeedOptions
  ): Article[] {
    return feedparserItems.map(
      (item) =>
        new Article(
          item,
          {
            feed: feedOptions || {},
          },
          {
            dateFallback: false,
            timeFallback: false,
            dateFormat: "ddd, D MMMM YYYY, h:mm A z",
            formatTables: false,
            imgLinksExistence: true,
            imgPreviews: true,
            timezone: "UTC",
          }
        )
    );
  }
}
