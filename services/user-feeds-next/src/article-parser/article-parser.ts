import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import advancedFormat from "dayjs/plugin/advancedFormat";
import { flatten } from "flat";
import { createHash } from "crypto";
import FeedParser from "feedparser";
import { ArticleIDResolver } from "./article-id-resolver";
import {
  extractExtraInfo,
  runPreProcessRules,
  runPostProcessRules,
} from "./utils";
import {
  type Article,
  type FlattenedArticleWithoutId,
  type UserFeedFormatOptions,
  type ParseArticlesResult,
  type PostProcessParserRule,
  ARTICLE_FIELD_DELIMITER,
} from "./types";

// Setup dayjs plugins
dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.extend(advancedFormat);

const sha1Base = createHash("sha1");

export class FeedParseTimeoutException extends Error {
  constructor() {
    super("Feed parse timed out");
    this.name = "FeedParseTimeoutException";
  }
}

export class InvalidFeedException extends Error {
  constructor(
    message: string,
    readonly feedText: string
  ) {
    super(message);
    this.name = "InvalidFeedException";
  }
}

/**
 * Flatten a raw feedparser item into a flat key-value record.
 */
export function flattenArticle(
  input: Record<string, unknown>,
  options: {
    formatOptions?: UserFeedFormatOptions;
    useParserRules?: PostProcessParserRule[];
  }
): FlattenedArticleWithoutId {
  const flattened = flatten(input, {
    delimiter: ARTICLE_FIELD_DELIMITER,
  }) as Record<string, unknown>;

  const newRecord: FlattenedArticleWithoutId = runPreProcessRules(input);

  Object.entries(flattened).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (trimmed.length) {
        newRecord[key] = trimmed;
      }

      return;
    }

    if (value instanceof Date) {
      const useTimezone = options.formatOptions?.dateTimezone || "UTC";
      const dateVal = dayjs(value)
        .tz(useTimezone)
        .locale(options.formatOptions?.dateLocale || "en");
      let stringDate = dateVal.format();

      try {
        if (options.formatOptions?.dateFormat) {
          stringDate = dateVal.format(options.formatOptions.dateFormat);
        }
      } catch {
        // Ignore format errors
      }

      newRecord[key] = stringDate;

      return;
    }

    if ({}.constructor === value.constructor) {
      if (Object.keys(value as object).length) {
        throw new Error(
          "Non-empty object found in flattened record. " +
            'Check that "flatten" is working as intended'
        );
      }

      return;
    }

    if (Array.isArray(value)) {
      if (value.length) {
        throw new Error(
          "Non-empty array found in flattened record. " +
            'Check that "flatten" is working as intended'
        );
      }

      return;
    }

    newRecord[key] = String(value);
  });

  // Extract images and anchors from HTML content
  const entries = Object.entries(newRecord);

  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i]!;

    const { images: imageList, anchors: anchorList } = extractExtraInfo(value);

    if (imageList.length) {
      for (let j = 0; j < imageList.length; j++) {
        const image = imageList[j];
        newRecord[`extracted::${key}::image${j + 1}`] = image!;
      }
    }

    if (anchorList.length) {
      for (let j = 0; j < anchorList.length; j++) {
        const anchor = anchorList[j];
        newRecord[`extracted::${key}::anchor${j + 1}`] = anchor!;
      }
    }
  }

  return runPostProcessRules(newRecord, options.useParserRules);
}

/**
 * Parse RSS/Atom XML into articles.
 */
export async function parseArticlesFromXml(
  xml: string,
  options: {
    timeout?: number;
    formatOptions?: UserFeedFormatOptions;
    useParserRules?: PostProcessParserRule[];
  } = {}
): Promise<ParseArticlesResult> {
  const feedparser = new FeedParser({});
  const idResolver = new ArticleIDResolver();
  const rawArticles: FeedParser.Item[] = [];

  const promise = new Promise<ParseArticlesResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new FeedParseTimeoutException());
    }, options?.timeout || 10000);

    feedparser.on("error", (err: Error) => {
      clearTimeout(timeout);

      if (
        err.message === "Not a feed" ||
        err.message.startsWith("Unexpected end")
      ) {
        reject(new InvalidFeedException("Invalid feed", xml));
      } else {
        reject(err);
      }
    });

    feedparser.on("readable", function (this: FeedParser) {
      let item;

      do {
        item = this.read();

        if (item) {
          idResolver.recordArticle(item as never);
          rawArticles.push(item);
        }
      } while (item);
    });

    feedparser.on("end", async () => {
      clearTimeout(timeout);

      if (rawArticles.length === 0) {
        return resolve({
          articles: [],
          feed: {
            title: feedparser.meta?.title,
          },
        });
      }

      const idType = idResolver.getIDType();

      if (!idType) {
        return reject(
          new Error("No ID type found when parsing articles for feed")
        );
      }

      try {
        const mappedArticles: Article[] = rawArticles.map((rawArticle) => {
          const id = ArticleIDResolver.getIDTypeValue(
            rawArticle as never,
            idType
          );

          const flattened = flattenArticle(rawArticle as never, {
            formatOptions: options.formatOptions,
            useParserRules: options.useParserRules,
          });

          return {
            flattened: {
              ...flattened,
              id,
              idHash: sha1Base.copy().update(id).digest("hex"),
            },
            raw: {
              date:
                !!rawArticle.date && dayjs(rawArticle.date).isValid()
                  ? rawArticle.date.toISOString()
                  : undefined,
              pubdate:
                !!rawArticle.pubdate && dayjs(rawArticle.pubdate).isValid()
                  ? rawArticle.pubdate.toISOString()
                  : undefined,
            },
          };
        });

        // Check for duplicate id hashes
        const idHashes = new Set<string>();

        for (const article of mappedArticles) {
          const idHash = article.flattened.idHash;

          if (!idHash) {
            return reject(new Error("Some articles are missing id hash"));
          }

          if (idHashes.has(idHash)) {
            console.warn(`Feed has duplicate article id hash: ${idHash}`, {
              id: article.flattened.id,
            });
          }

          idHashes.add(idHash);
        }

        resolve({
          feed: {
            title: feedparser.meta?.title,
          },
          articles: mappedArticles,
        });
      } catch (err) {
        reject(err);
      }
    });
  });

  feedparser.write(xml);
  feedparser.end();

  return promise;
}
