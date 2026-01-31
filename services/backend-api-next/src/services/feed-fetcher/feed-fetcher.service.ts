import type { FeedFetcherApiService } from "../feed-fetcher-api/feed-fetcher-api.service";
import type { FeedRequestLookupDetails } from "../../shared/types/feed-request-lookup-details.type";
import { FeedFetcherFetchStatus } from "../feed-fetcher-api/types";
import {
  FeedFetchTimeoutException,
  FeedParseException,
  FeedParseTimeoutException,
  FeedInvalidSslCertException,
  FeedRequestException,
  FeedTooManyRequestsException,
  FeedUnauthorizedException,
  FeedForbiddenException,
  FeedNotFoundException,
  FeedInternalErrorException,
  FeedTooLargeException,
  InvalidFeedException,
  FeedFetchErrorException,
} from "./exceptions";
import { Readable } from "node:stream";
import FeedParser from "feedparser";
import Article from "../../shared/utils/Article";
import ArticleIDResolver from "../../shared/utils/ArticleIDResolver";

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

export interface FeedFetcherServiceDeps {
  feedFetcherApiService: FeedFetcherApiService;
}

interface FeedData {
  articleList: FeedParser.Item[];
  idType?: string;
}

interface FeedFetchResult {
  articles: Article[];
  idType?: string;
}

export class FeedFetcherService {
  constructor(private readonly deps: FeedFetcherServiceDeps) {}

  async fetchFeed(
    url: string,
    lookupDetails: FeedRequestLookupDetails | null,
    options: FetchFeedOptions,
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
        },
      );
    }

    const { articleList, idType } = await this.parseFeed(inputStream);

    const articles = this.convertRawObjectsToArticles(articleList, options);

    return {
      articles,
      idType,
    };
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
        clearTimeout(timeout);
        reject(new FeedParseException(err.message));
      });

      feedparser.on("error", (err: Error) => {
        clearTimeout(timeout);
        if (err.message === "Not a feed") {
          reject(
            new InvalidFeedException(
              "That is a not a valid feed. Note that you cannot add just any link. " +
                "You may check if it is a valid feed by using online RSS feed validators",
            ),
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

  async fetchFeedStreamFromApiService(
    url: string,
    lookupDetails: FeedRequestLookupDetails | null,
    options?: {
      getCachedResponse?: boolean;
      debug?: boolean;
    },
  ): Promise<NodeJS.ReadableStream> {
    const result = await this.deps.feedFetcherApiService.fetchAndSave(
      url,
      lookupDetails,
      options,
    );

    if (result.requestStatus === FeedFetcherFetchStatus.BadStatusCode) {
      if (result.response?.statusCode) {
        this.handleStatusCode(result.response.statusCode);
      }

      throw new Error("Prior feed requests have failed");
    }

    if (result.requestStatus === FeedFetcherFetchStatus.ParseError) {
      throw new FeedParseException(
        `Feed host failed to return a valid, parseable feed`,
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
        `Feed host has an invalid SSL certificate`,
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

    if (result.requestStatus === FeedFetcherFetchStatus.FetchError) {
      throw new FeedFetchErrorException(`Failed to fetch feed`);
    }

    if (result.requestStatus === FeedFetcherFetchStatus.InteralError) {
      throw new FeedInternalErrorException(
        `Internal error while fetching feed`,
      );
    }

    throw new Error(`Unhandled request status: ${result["requestStatus"]}`);
  }

  handleStatusCode(code: number): void {
    if (code === 200) return;
    if (code === 429) throw new FeedTooManyRequestsException();
    if (code === 401) throw new FeedUnauthorizedException();
    if (code === 403) throw new FeedForbiddenException();
    if (code === 404) throw new FeedNotFoundException();
    if (code >= 500) throw new FeedInternalErrorException();
    throw new FeedRequestException(`Non-200 status code (${code})`);
  }

  private convertRawObjectsToArticles(
    feedparserItems: FeedParser.Item[],
    feedOptions?: FetchFeedOptions,
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
          },
        ),
    );
  }
}
