import ArticleIDResolver from './ArticleIDResolver';
import FeedParserError from './errors/FeedParserError';
import RequestError from './errors/RequestError';
import DecodedFeedParser from './DecodedFeedParser';
import { Dispatcher, request } from 'undici';

type UndiciRequestOptions = {
  dispatcher?: Dispatcher | undefined;
} & Omit<Dispatcher.RequestOptions, 'origin' | 'path'>;

interface FeedFetcherOptions {
  feedParseTimeoutMs?: number;
  feedRequestTimeoutMs?: number;
  defaultUserAgent?: string;
}

class FeedFetcher {
  constructor(private readonly options?: FeedFetcherOptions) {}


  static resolveUserAgent(url: string, userAgent: string) {
    if (url.includes('.tumblr.com')) {
      // tumblr only allows GoogleBot to automatically view NSFW feeds
      const tempParts = userAgent.split(' ');
      tempParts.splice(1, 0, 'GoogleBot');
      return tempParts.join(' ');
    } else {
      return userAgent;
    }
  }

  createFetchOptions(url: string, initialOptions: UndiciRequestOptions): {
    options: UndiciRequestOptions,
    timeout: NodeJS.Timeout,
  } {
    const options: UndiciRequestOptions = {
      maxRedirections: 5,
      ...initialOptions,
      headers: {
        'user-agent': FeedFetcher.resolveUserAgent(url, this.options?.defaultUserAgent || ''),
      },
    };

    if (initialOptions.headers) {
      options.headers = {
        ...options.headers,
        ...initialOptions.headers,
      };
    }

    const controller = new AbortController();
    const timeoutMs = this.options?.feedRequestTimeoutMs ?? 10000;
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    options.signal = controller.signal;

    return {
      options,
      timeout,
    };
  }

  /**
   * Fetch a URL
   * 
   * @param url URL to fetch
   * @param requestOptions Options to directly pass to fetch
   * @param retried If true, recursive retries will not be made
   */
  async fetchURL(url: string, requestOptions: UndiciRequestOptions = {
    method: 'GET',
  }, retried = false): Promise<{
      stream: NodeJS.ReadableStream | null,
      response: {
        statusCode: number,
        headers: Dispatcher.ResponseData['headers'],
      },
    }> {
    if (!url) {
      throw new Error('No url defined');
    }


    const { options, timeout } = this.createFetchOptions(url, requestOptions);
    let endStatus;
    let res: Dispatcher.ResponseData;

    try {
      res = await request(url, options);
    } catch (err) {
      if ((err as Error).message === 'The user aborted a request.') {
        throw RequestError.TimedOut();
      }

      throw new RequestError(null, (err as Error).message);
    } finally {
      clearTimeout(timeout);
    }

    endStatus = res.statusCode;

    /**
     * Fetch returns a 304 if the two properties below were passed in by the calling function to
     * check if there are new feeds
     */
    if (res.statusCode === 200 || (
      options.headers &&
      res.statusCode === 304 &&
      'If-Modified-Since' in options.headers &&
      'If-None-Match' in options.headers)
    ) {
      return {
        stream: res.body,
        response: res,
      };
    }

    if (!retried && (res.statusCode === 403 || res.statusCode === 400)) {
      const res2 = await this.fetchURL(url, {
        ...options,
        headers: {
          ...options.headers,
          'user-agent': '',
        },
      }, true);
      endStatus = res2.response.statusCode;

      if (endStatus === 200) {
        return res2;
      }
    }

    const serverHeaders = res.headers.server;

    if (!serverHeaders?.includes('cloudflare')) {
      throw RequestError.BadStatusCode(`Bad status code (${endStatus})`);
    }

    // Cloudflare errors
    throw RequestError.Cloudflare();
  }
  /**
   * @typedef {Object} CSResults
   * @property {import('stream').Readable} stream
   * @property {Object<string, any>} response
   */

  /**
 * @typedef {object} FeedData
 * @property {object[]} articleList - Array of articles
 * @property {string} idType - The ID type used for the article ._id property
 */

  /**
   * Parse a stream and return the article list, and the article ID type used
   * @param stream
   * @param url - The fetched URL of this stream
   * @param charset Response charset
   * @returns The article list and the id type used
   */
  async parseStream(
    stream: NodeJS.ReadableStream | null,
    url: string,
    charset: string,
  ): Promise<{
      articleList: Record<string, any>[],
      idType: string,
    }> {
    if (!stream) {
      throw new Error('No stream is available');
    }
    

    const feedparser = new DecodedFeedParser({}, url, charset);
    const idResolver = new ArticleIDResolver();
    const articleList: Record<string, any>[] = [];

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new FeedParserError('Feed parsing took too long'));
      }, this.options?.feedRequestTimeoutMs || 10000);

      stream.on('error', (err: Error) => {
        // feedparser may not handle all errors such as incorrect headers. (feedparser v2.2.9)
        reject(new FeedParserError(err.message));
      });

      feedparser.on('error', (err: Error) => {
        if (err.message === 'Not a feed') {
          reject(FeedParserError.InvalidFeed());
        } else {
          reject(new FeedParserError(err.message));
        }
      });

      feedparser.on('readable', function (this: DecodedFeedParser) {
        let item;

        do {
          item = this.read();

          if (item) {
            idResolver.recordArticle(item);
            articleList.push(item);
          }
        } while (item);
      });

      feedparser.on('end', () => {
        if (articleList.length === 0) {
          return resolve({ articleList, idType: '' });
        }

        const idType = idResolver.getIDType();

        for (const article of articleList) {
          article._id = ArticleIDResolver.getIDTypeValue(article, idType);
        }

        resolve({ articleList, idType });
      });

      stream.pipe(feedparser);
    });
  }

  /**
   * Fetch and parse results, and result the article list and id type
   * @param {string} url - The URL to fetch
   * @param {object} options - The options to pass to fetch
   * @returns {FeedData} - The article list and the id type used
   */
  async fetchFeed(url: string, options?: UndiciRequestOptions, charset?: string) {
    const { stream, response } = await this.fetchURL(url, options);
    const charsetInHeaders = this.getCharsetFromHeaders(response.headers);
    const { articleList, idType } = await this.parseStream(
      stream,
      url,
      charset || charsetInHeaders,
    );
    return { articleList, idType };
  }

  getCharsetFromHeaders(headers: Dispatcher.ResponseData['headers']) {
    const contentType = headers['content-type'];

    if (!contentType) {
      return '';
    }

    const match = /charset(?:=?)(.*)(?:$|\s)/ig.exec(contentType);

    if (match && match[1]) {
      return match[1];
    }

    return '';
  }
}

export default FeedFetcher;
