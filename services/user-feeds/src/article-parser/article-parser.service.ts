import { Injectable } from "@nestjs/common";
import dayjs from "dayjs";
import { flatten } from "flat";
import { ARTICLE_FIELD_DELIMITER } from "../articles/constants";
import {
  Article,
  FeedResponseRequestStatus,
  INJECTED_ARTICLE_PLACEHOLDER_PREFIX,
  MAX_ARTICLE_INJECTION_ARTICLE_COUNT,
  UserFeedFormatOptions,
} from "../shared";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { HTMLElement, parse, valid } from "node-html-parser";
import { convert, SelectorDefinition } from "html-to-text";
import advancedFormat from "dayjs/plugin/advancedFormat";
import { ExternalFeedProperty, PostProcessParserRule } from "./constants";
import "dayjs/locale/af";
import "dayjs/locale/am";
import "dayjs/locale/ar-dz";
import "dayjs/locale/ar-iq";
import "dayjs/locale/ar-kw";
import "dayjs/locale/ar-ly";
import "dayjs/locale/ar-ma";
import "dayjs/locale/ar-sa";
import "dayjs/locale/ar-tn";
import "dayjs/locale/ar";
import "dayjs/locale/az";
import "dayjs/locale/be";
import "dayjs/locale/bg";
import "dayjs/locale/bi";
import "dayjs/locale/bm";
import "dayjs/locale/bn-bd";
import "dayjs/locale/bn";
import "dayjs/locale/bo";
import "dayjs/locale/br";
import "dayjs/locale/bs";
import "dayjs/locale/ca";
import "dayjs/locale/cs";
import "dayjs/locale/cv";
import "dayjs/locale/cy";
import "dayjs/locale/da";
import "dayjs/locale/de-at";
import "dayjs/locale/de-ch";
import "dayjs/locale/de";
import "dayjs/locale/dv";
import "dayjs/locale/el";
import "dayjs/locale/en-au";
import "dayjs/locale/en-ca";
import "dayjs/locale/en-gb";
import "dayjs/locale/en-ie";
import "dayjs/locale/en-il";
import "dayjs/locale/en-in";
import "dayjs/locale/en-nz";
import "dayjs/locale/en-sg";
import "dayjs/locale/en-tt";
import "dayjs/locale/en";
import "dayjs/locale/eo";
import "dayjs/locale/es-do";
import "dayjs/locale/es-mx";
import "dayjs/locale/es-pr";
import "dayjs/locale/es-us";
import "dayjs/locale/es";
import "dayjs/locale/et";
import "dayjs/locale/eu";
import "dayjs/locale/fa";
import "dayjs/locale/fi";
import "dayjs/locale/fo";
import "dayjs/locale/fr-ca";
import "dayjs/locale/fr-ch";
import "dayjs/locale/fr";
import "dayjs/locale/fy";
import "dayjs/locale/ga";
import "dayjs/locale/gd";
import "dayjs/locale/gl";
import "dayjs/locale/gom-latn";
import "dayjs/locale/gu";
import "dayjs/locale/hi";
import "dayjs/locale/he";
import "dayjs/locale/hr";
import "dayjs/locale/ht";
import "dayjs/locale/hu";
import "dayjs/locale/hy-am";
import "dayjs/locale/id";
import "dayjs/locale/is";
import "dayjs/locale/it-ch";
import "dayjs/locale/it";
import "dayjs/locale/ja";
import "dayjs/locale/jv";
import "dayjs/locale/ka";
import "dayjs/locale/kk";
import "dayjs/locale/km";
import "dayjs/locale/kn";
import "dayjs/locale/ko";
import "dayjs/locale/ku";
import "dayjs/locale/ky";
import "dayjs/locale/lb";
import "dayjs/locale/lo";
import "dayjs/locale/lt";
import "dayjs/locale/lv";
import "dayjs/locale/me";
import "dayjs/locale/mi";
import "dayjs/locale/mk";
import "dayjs/locale/ml";
import "dayjs/locale/mn";
import "dayjs/locale/mr";
import "dayjs/locale/ms-my";
import "dayjs/locale/ms";
import "dayjs/locale/mt";
import "dayjs/locale/my";
import "dayjs/locale/nb";
import "dayjs/locale/ne";
import "dayjs/locale/nl-be";
import "dayjs/locale/nl";
import "dayjs/locale/nn";
import "dayjs/locale/oc-lnc";
import "dayjs/locale/pa-in";
import "dayjs/locale/pl";
import "dayjs/locale/pt-br";
import "dayjs/locale/pt";
import "dayjs/locale/rn";
import "dayjs/locale/ro";
import "dayjs/locale/sd";
import "dayjs/locale/si";
import "dayjs/locale/se";
import "dayjs/locale/sk";
import "dayjs/locale/sl";
import "dayjs/locale/sq";
import "dayjs/locale/sr-cyrl";
import "dayjs/locale/sr";
import "dayjs/locale/ss";
import "dayjs/locale/sv-fi";
import "dayjs/locale/sv";
import "dayjs/locale/sw";
import "dayjs/locale/ta";
import "dayjs/locale/te";
import "dayjs/locale/tg";
import "dayjs/locale/tet";
import "dayjs/locale/th";
import "dayjs/locale/tk";
import "dayjs/locale/tl-ph";
import "dayjs/locale/tlh";
import "dayjs/locale/tr";
import "dayjs/locale/tzl";
import "dayjs/locale/tzm-latn";
import "dayjs/locale/ug-cn";
import "dayjs/locale/tzm";
import "dayjs/locale/uk";
import "dayjs/locale/ur";
import "dayjs/locale/uz-latn";
import "dayjs/locale/vi";
import "dayjs/locale/uz";
import "dayjs/locale/yo";
import "dayjs/locale/x-pseudo";
import "dayjs/locale/zh-cn";
import "dayjs/locale/zh-hk";
import "dayjs/locale/zh-tw";
import "dayjs/locale/zh";
import "dayjs/locale/rw";
import "dayjs/locale/ru";
import { FeedFetcherService } from "../feed-fetcher/feed-fetcher.service";
import logger from "../shared/utils/logger";
import FeedParser from "feedparser";
import { ArticleIDResolver } from "../articles/utils";
import {
  FeedParseTimeoutException,
  InvalidFeedException,
} from "../articles/exceptions";
import { createHash } from "crypto";
import { chunkArray } from "../shared/utils/chunk-array";

dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.extend(advancedFormat);
const sha1 = createHash("sha1");

type FlattenedArticleWithoutId = Omit<Article["flattened"], "id" | "idHash">;

export type XmlParsedArticlesOutput = {
  articles: Article[];
};

@Injectable()
export class ArticleParserService {
  constructor(private readonly feedFetcherService: FeedFetcherService) {}

  async getArticlesFromXml(
    xml: string,
    options: {
      timeout?: number;
      formatOptions: UserFeedFormatOptions;
      useParserRules: PostProcessParserRule[] | undefined;
      externalFeedProperties?: Array<ExternalFeedProperty>;
    }
  ): Promise<XmlParsedArticlesOutput> {
    const feedparser = new FeedParser({});
    const idResolver = new ArticleIDResolver();
    const rawArticles: FeedParser.Item[] = [];

    const promise = new Promise<{
      articles: Article[];
    }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new FeedParseTimeoutException());
      }, options?.timeout || 10000);

      feedparser.on("error", (err: Error) => {
        if (
          err.message === "Not a feed" ||
          err.message.startsWith("Unexpected end")
        ) {
          reject(new InvalidFeedException("Invalid feed"));
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
          return resolve({ articles: [] });
        }

        clearTimeout(timeout);
        const idType = idResolver.getIDType();

        if (!idType) {
          return reject(
            new Error("No ID type found when parsing articles for feed")
          );
        }

        try {
          const mappedArticles = await Promise.all(
            rawArticles.map(async (rawArticle) => {
              const id = ArticleIDResolver.getIDTypeValue(
                rawArticle as never,
                idType
              );

              const {
                flattened,
                injectArticleContent,
                hasArticleContentInjection,
              } = await this.flatten(rawArticle as never, {
                formatOptions: options.formatOptions,
                useParserRules: options.useParserRules,
                externalFeedProperties: options.externalFeedProperties,
              });

              return {
                flattened: {
                  ...flattened,
                  id,
                  idHash: sha1.copy().update(id).digest("hex"),
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
                injectArticleContent,
                hasArticleContentInjection,
              };
            })
          );

          // check for duplicate id hashes
          const idHashes = new Set<string>();

          for (const article of mappedArticles) {
            const idHash = article.flattened.idHash;

            if (!idHash) {
              return reject(new Error("Some articles are missing id hash"));
            }

            if (idHashes.has(article.flattened.idHash)) {
              logger.warn(
                `Feed has duplicate article id hash: ${article.flattened.idHash}`,
                {
                  id: article.flattened.id,
                  idHash,
                }
              );
            }

            idHashes.add(article.flattened.idHash);
          }

          if (
            mappedArticles.length <= MAX_ARTICLE_INJECTION_ARTICLE_COUNT &&
            mappedArticles.some((a) => a.hasArticleContentInjection)
          ) {
            const chunked = chunkArray(mappedArticles, 25);

            for (const chunk of chunked) {
              await Promise.all(
                chunk.map((a) => a.injectArticleContent(a.flattened))
              );

              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }

          resolve({
            articles: mappedArticles.map((a) => ({
              flattened: a.flattened,
              raw: a.raw,
            })),
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

  async flatten(
    input: Record<string, unknown>,
    {
      useParserRules,
      formatOptions,
      externalFeedProperties,
    }: {
      formatOptions?: UserFeedFormatOptions;
      useParserRules: PostProcessParserRule[] | undefined;
      externalFeedProperties?: ExternalFeedProperty[];
    }
  ): Promise<{
    flattened: FlattenedArticleWithoutId;
    hasArticleContentInjection: boolean;
    injectArticleContent: (
      targetRecord: Record<string, string>
    ) => Promise<void>;
  }> {
    const flattened = flatten(input, {
      delimiter: ARTICLE_FIELD_DELIMITER,
    }) as Record<string, unknown>;

    const newRecord: FlattenedArticleWithoutId = this.runPreProcessRules(input);

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
        const useTimezone = formatOptions?.dateTimezone || "UTC";
        const dateVal = dayjs(value)
          .tz(useTimezone)
          .locale(formatOptions?.dateLocale || "en");
        let stringDate = dateVal.format();

        try {
          if (formatOptions?.dateFormat) {
            stringDate = dateVal.format(formatOptions.dateFormat);
          }
        } catch (err) {}

        newRecord[key] = stringDate;

        return;
      }

      if ({}.constructor === value.constructor) {
        if (Object.keys(value).length) {
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

    const entries = Object.entries(newRecord);

    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];

      const { images: imageList, anchors: anchorList } =
        this.extractExtraInfo(value);

      if (imageList.length) {
        for (let i = 0; i < imageList.length; i++) {
          const image = imageList[i];

          newRecord[`extracted::${key}::image${i + 1}`] = image;
        }
      }

      if (anchorList.length) {
        for (let i = 0; i < anchorList.length; i++) {
          const anchor = anchorList[i];

          newRecord[`extracted::${key}::anchor${i + 1}`] = anchor;
        }
      }
    }

    const postProcessed = this.runPostProcessRules(newRecord, useParserRules);

    return {
      flattened: postProcessed,
      hasArticleContentInjection: !!externalFeedProperties?.length,
      injectArticleContent: async (targetRecord: Record<string, string>) => {
        if (!externalFeedProperties?.length) {
          return;
        }

        const parsedBodiesBySourceField: Record<string, HTMLElement | null> =
          {};

        await Promise.allSettled(
          (externalFeedProperties || [])?.map(
            async ({ cssSelector, label, sourceField }) => {
              const sourceFieldValue = targetRecord[sourceField];

              if (!sourceFieldValue) {
                return;
              }

              let parsedBody = parsedBodiesBySourceField[sourceField];

              if (parsedBody === null) {
                return;
              }

              if (!parsedBody) {
                const res = await this.feedFetcherService.fetch(
                  sourceFieldValue,
                  {
                    executeFetchIfNotInCache: true,
                    retries: 3,
                    lookupDetails: undefined,
                  }
                );

                if (res.requestStatus !== FeedResponseRequestStatus.Success) {
                  logger.error(`Failed to fetch article injection`, {
                    sourceField,
                    sourceFieldValue,
                    res,
                  });

                  parsedBodiesBySourceField[sourceField] = null;

                  return;
                }

                const body = res.body;

                if (!valid(body)) {
                  parsedBodiesBySourceField[sourceField] = null;

                  return;
                }

                parsedBody = parse(body);
              }

              parsedBody
                .querySelectorAll(cssSelector)
                .slice(0, 10)
                .forEach((e, index) => {
                  const outerHtmlOfElement = e?.outerHTML || "";

                  const key =
                    `${INJECTED_ARTICLE_PLACEHOLDER_PREFIX}${sourceField}::${label}` +
                    `${index}`;

                  targetRecord[key] = outerHtmlOfElement;

                  const { images: imageList, anchors: anchorList } =
                    this.extractExtraInfo(outerHtmlOfElement);

                  if (imageList.length) {
                    for (let i = 0; i < imageList.length; i++) {
                      const image = imageList[i];

                      const imageKey = `${key}::image${i}`;
                      targetRecord[imageKey] = image;
                    }
                  }

                  if (anchorList.length) {
                    for (let i = 0; i < anchorList.length; i++) {
                      const anchor = anchorList[i];

                      const anchorKey = `${key}::anchor${i}`;
                      targetRecord[anchorKey] = anchor;
                    }
                  }
                });
            }
          )
        );
      },
    };
  }

  extractExtraInfo(inputString: string): {
    images: string[];
    anchors: string[];
  } {
    const isValid = valid(inputString);

    let images: string[] = [];
    let anchors: string[] = [];

    if (!isValid) {
      // fallback to using the slower html-to-text

      const imageSelector: SelectorDefinition = {
        selector: "img",
        format: "images",
      };

      const anchorSelector: SelectorDefinition = {
        selector: "a",
        format: "anchors",
      };

      convert(inputString, {
        formatters: {
          images: (elem) => {
            const attribs = elem.attribs || {};

            const src = (attribs.src || "").trim();

            if (src) {
              images.push(src);
            }
          },
          anchors: (elem) => {
            const href = elem.attribs.href;

            if (href) {
              anchors.push(href);
            }
          },
        },
        selectors: [imageSelector, anchorSelector],
      });

      return {
        images,
        anchors,
      };
    }

    const root = parse(inputString);

    images = root
      .getElementsByTagName("img")
      .map((e) => e.getAttribute("src"))
      .filter((e): e is string => !!e);

    anchors = root
      .querySelectorAll("a")
      .map((e) => e.getAttribute("href"))
      .filter((e): e is string => !!e);

    return {
      images,
      anchors,
    };
  }

  runPreProcessRules<T>(
    rawArticle: T extends Record<string, unknown> ? T : Record<string, unknown>
  ) {
    const flattenedArticle: FlattenedArticleWithoutId = {};

    const categories = rawArticle.categories;

    if (
      Array.isArray(categories) &&
      categories.every((item) => typeof item === "string")
    ) {
      flattenedArticle["processed::categories"] = categories.join(",");
    }

    return flattenedArticle;
  }

  runPostProcessRules(
    flattenedArticle: FlattenedArticleWithoutId,
    rules?: PostProcessParserRule[]
  ): FlattenedArticleWithoutId {
    if (!rules?.length) {
      return flattenedArticle;
    }

    const stripRedditCommentLink = rules.includes(
      PostProcessParserRule.RedditCommentLink
    );

    const article = { ...flattenedArticle };

    if (stripRedditCommentLink && typeof article.description === "string") {
      article["processed::description::reddit1"] = article.description
        .replace("[link]", "")
        .replace("[comments]", "");
    }

    return article;
  }
}
