/* eslint-disable max-len */
import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import { Injectable } from "@nestjs/common";
import { FeedArticleCustomComparison } from "./entities";
import { Item } from "feedparser";
import { InvalidFeedException } from "./exceptions";
import {
  EntityManager,
  MikroORM,
  UniqueConstraintViolationException,
} from "@mikro-orm/core";
import { Article, UserFeedFormatOptions } from "../shared/types";
import {
  ArticleParserService,
  XmlParsedArticlesOutput,
} from "../article-parser/article-parser.service";
import { UserFeedDateCheckOptions } from "../shared/types/user-feed-date-check-options.type";
import dayjs from "dayjs";
import logger from "../shared/utils/logger";
import {
  ExternalFeedProperty,
  PostProcessParserRule,
} from "../article-parser/constants";
import { createHash } from "crypto";
import { FeedFetcherService } from "../feed-fetcher/feed-fetcher.service";
import { getParserRules } from "../feed-event-handler/utils";
import { FeedArticleNotFoundException } from "../feed-fetcher/exceptions";
import { ExternalFeedPropertyDto } from "../article-formatter/types";
import { CacheStorageService } from "../cache-storage/cache-storage.service";
import { deflate, inflate } from "zlib";
import { promisify } from "util";
import { parse, valid } from "node-html-parser";
import { PartitionedFeedArticleFieldStoreService } from "./partitioned-feed-article-field-store.service";
import { ConfigService } from "@nestjs/config";
import PartitionedFeedArticleFieldInsert from "./types/pending-feed-article-field-insert.types";
import { FeedRequestLookupDetails } from "../shared/types/feed-request-lookup-details.type";
import { pool, Pool } from "workerpool";
import { join } from "path";
import { FeedResponseRequestStatus } from "../shared";

const deflatePromise = promisify(deflate);
const inflatePromise = promisify(inflate);
const sha1 = createHash("sha1");

interface FetchFeedArticleOptions {
  formatOptions: UserFeedFormatOptions;
  externalFeedProperties?: ExternalFeedPropertyDto[];
  findRssFromHtml?: boolean;
  requestLookupDetails: FeedRequestLookupDetails | undefined | null;
}

@Injectable()
export class ArticlesService {
  feedParserPool: Pool;

  constructor(
    @InjectRepository(FeedArticleCustomComparison)
    private readonly articleCustomComparisonRepo: EntityRepository<FeedArticleCustomComparison>,
    private readonly articleParserService: ArticleParserService,
    private readonly orm: MikroORM,
    private readonly feedFetcherService: FeedFetcherService,
    private readonly cacheStorageService: CacheStorageService,
    private readonly partitionedFieldStoreService: PartitionedFeedArticleFieldStoreService,
    private readonly configService: ConfigService
  ) {
    this.feedParserPool = pool(
      join(__dirname, "articles.feed-parser.worker.js"),
      {
        workerType: "thread",
      }
    );
  }

  async doFeedArticlesExistInCache(data: {
    url: string;
    options: FetchFeedArticleOptions;
  }) {
    const key = this.calculateCacheKeyForArticles(data);

    return !!(await this.cacheStorageService.exists(key));
  }

  async getFeedArticlesFromCache(data: {
    url: string;
    options: FetchFeedArticleOptions;
  }): Promise<XmlParsedArticlesOutput | null> {
    const compressedValue = await this.cacheStorageService.get({
      key: this.calculateCacheKeyForArticles(data),
    });

    if (!compressedValue) {
      return null;
    }

    const jsonText = await (
      await inflatePromise(Buffer.from(compressedValue, "base64"))
    ).toString();

    return JSON.parse(jsonText) as XmlParsedArticlesOutput;
  }

  async invalidateFeedArticlesCache(data: {
    url: string;
    options: FetchFeedArticleOptions;
  }) {
    return this.cacheStorageService.del(
      this.calculateCacheKeyForArticles(data)
    );
  }

  async setFeedArticlesInCache(
    data: {
      url: string;
      options: FetchFeedArticleOptions;
      data: XmlParsedArticlesOutput;
    },
    options?: { useOldTTL?: boolean }
  ) {
    const jsonBody = JSON.stringify(data.data);

    const compressed = await (
      await deflatePromise(jsonBody)
    ).toString("base64");

    await this.cacheStorageService.set({
      key: this.calculateCacheKeyForArticles(data),
      body: compressed,
      expSeconds: 60 * 5,
      useOldTTL: options?.useOldTTL,
    });
  }

  async refreshFeedArticlesCacheExpiration(data: {
    url: string;
    options: FetchFeedArticleOptions;
  }) {
    await this.cacheStorageService.setExpire(
      this.calculateCacheKeyForArticles(data),
      60 * 5
    );
  }

  async findOrFetchFeedArticles(
    originalUrl: string,
    options: FetchFeedArticleOptions & {
      findRssFromHtml?: boolean;
      executeFetch?: boolean;
    }
  ) {
    try {
      return await this.fetchFeedArticles(originalUrl, { ...options });
    } catch (err) {
      if (!(err instanceof InvalidFeedException)) {
        throw err;
      }

      const url = new URL(originalUrl);

      const base = (url.origin + url.pathname).endsWith("/")
        ? (url.origin + url.pathname).slice(0, -1)
        : url.origin + url.pathname;

      const newUrls = [`${base}/feed`, `${base}/rss`];

      for (const newUrl of newUrls) {
        try {
          return await this.fetchFeedArticles(newUrl, {
            ...options,
          });
        } catch (subError) {
          continue;
        }
      }

      throw err;
    }
  }

  async fetchFeedArticles(
    url: string,
    {
      formatOptions,
      externalFeedProperties,
      findRssFromHtml,
      executeFetch,
      requestLookupDetails,
    }: FetchFeedArticleOptions & {
      findRssFromHtml?: boolean;
      executeFetch?: boolean;
      requestLookupDetails: FeedRequestLookupDetails | undefined | null;
    }
  ): Promise<{
    output: XmlParsedArticlesOutput | null;
    url: string;
    attemptedToResolveFromHtml?: boolean;
  }> {
    const cachedArticles = await this.getFeedArticlesFromCache({
      url,
      options: { formatOptions, externalFeedProperties, requestLookupDetails },
    });

    if (cachedArticles) {
      await this.refreshFeedArticlesCacheExpiration({
        url,
        options: {
          formatOptions,
          externalFeedProperties,
          requestLookupDetails,
        },
      });

      return {
        output: cachedArticles,
        url,
      };
    }

    const response = await this.feedFetcherService.fetch(
      requestLookupDetails?.url || url,
      {
        executeFetchIfNotInCache: true,
        executeFetch,
        lookupDetails: requestLookupDetails,
      }
    );

    if (response.requestStatus !== FeedResponseRequestStatus.Success) {
      throw new Error(
        `Unexpected request status when fetching feed articles: ${response.requestStatus}`
      );
    }

    try {
      const fromXml = await this.getArticlesFromXml(response.body, {
        formatOptions,
        useParserRules: getParserRules({ url }),
        externalFeedProperties,
      });

      await this.setFeedArticlesInCache({
        url,
        options: {
          formatOptions,
          externalFeedProperties,
          requestLookupDetails,
        },
        data: fromXml,
      });

      return {
        output: fromXml,
        url,
      };
    } catch (err) {
      if (err instanceof InvalidFeedException && findRssFromHtml) {
        const rssUrl = this.extractRssFromHtml(response.body);

        if (rssUrl) {
          if (rssUrl.startsWith("/")) {
            const newUrl = new URL(url);

            return this.fetchFeedArticles(newUrl.origin + rssUrl, {
              formatOptions,
              externalFeedProperties,
              requestLookupDetails,
            });
          } else {
            return this.fetchFeedArticles(rssUrl, {
              formatOptions,
              externalFeedProperties,
              requestLookupDetails,
            });
          }
        }
      }

      throw err;
    }
  }

  async fetchFeedArticle(
    url: string,
    id: string,
    {
      formatOptions,
      externalFeedProperties,
      requestLookupDetails,
    }: FetchFeedArticleOptions
  ) {
    const { output: result } = await this.fetchFeedArticles(url, {
      formatOptions,
      externalFeedProperties,
      requestLookupDetails,
    });

    if (!result) {
      throw new Error(`Request for ${url} is still pending`);
    }

    const { articles } = result;

    if (!articles.length) {
      return null;
    }

    const article = articles.find((article) => article.flattened.id === id);

    if (!article) {
      throw new FeedArticleNotFoundException(
        `Article with id ${id} for url ${url} not found`
      );
    }

    return article;
  }

  async fetchRandomFeedArticle(
    url: string,
    {
      formatOptions,
      externalFeedProperties,
      requestLookupDetails,
    }: FetchFeedArticleOptions
  ) {
    const { output: result } = await this.fetchFeedArticles(url, {
      formatOptions,
      externalFeedProperties,
      requestLookupDetails,
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

  /**
   * Given feed XML, get all the new articles from that XML that shoule be delivered.
   */
  async getArticlesToDeliverFromXml(
    feedXml: string,
    {
      id,
      blockingComparisons,
      passingComparisons,
      formatOptions,
      dateChecks,
      debug,
      useParserRules,
      externalFeedProperties,
    }: {
      id: string;
      blockingComparisons: string[];
      passingComparisons: string[];
      formatOptions: UserFeedFormatOptions;
      dateChecks?: UserFeedDateCheckOptions;
      debug?: boolean;
      useParserRules: PostProcessParserRule[] | undefined;
      externalFeedProperties?: ExternalFeedProperty[];
    }
  ): Promise<{ articlesToDeliver: Article[]; allArticles: Article[] }> {
    const { articles } = await this.getArticlesFromXml(feedXml, {
      formatOptions,
      useParserRules,
      externalFeedProperties,
    });

    logger.debug(`Found articles:`, {
      titles: articles.map((a) => a.flattened.title),
    });

    if (debug) {
      logger.datadog(`Debug feed ${id}: found articles`, {
        articles: articles.map((a) => ({
          id: a.flattened.id,
          title: a.flattened.title,
        })),
        level: "debug",
      });
    }

    if (!articles.length) {
      return {
        allArticles: articles,
        articlesToDeliver: [],
      };
    }

    const priorArticlesStored = await this.hasPriorArticlesStored(id);

    if (!priorArticlesStored) {
      logger.debug(`No prior articles stored for feed ${id}`);

      await this.storeArticles(id, articles, {
        comparisonFields: [...blockingComparisons, ...passingComparisons],
      });

      return {
        allArticles: articles,
        articlesToDeliver: [],
      };
    }

    const newArticles = await this.filterForNewArticles(id, articles);

    if (debug) {
      logger.datadog(
        `Debug feed ${id}: ${newArticles.length} new articles determined from ID checks`,
        {
          articles: newArticles.map((a) => ({
            id: a.flattened.id,
            title: a.flattened.title,
          })),
        }
      );
    }

    const seenArticles = articles.filter(
      (article) =>
        !newArticles.find(
          (a) => a.flattened.idHash === article.flattened.idHash
        )
    );

    const allComparisons = [...blockingComparisons, ...passingComparisons];
    const comparisonStorageResults = await this.areComparisonsStored(
      id,
      allComparisons
    );

    const storedComparisons = comparisonStorageResults
      .filter((r) => r.isStored)
      .map((r) => r.field);

    const articlesPastBlocks = await this.checkBlockingComparisons(
      { id, blockingComparisons },
      newArticles,
      storedComparisons
    );

    if (debug) {
      logger.datadog(
        `Debug feed ${id}: ${articlesPastBlocks.length} articles past blocking comparisons`,
        {
          articles: articlesPastBlocks.map((a) => ({
            id: a.flattened.id,
            title: a.flattened.title,
          })),
        }
      );
    }

    const articlesPassedComparisons = await this.checkPassingComparisons(
      {
        id,
        passingComparisons,
      },
      seenArticles,
      storedComparisons
    );

    if (debug) {
      logger.datadog(
        `Debug feed ${id}: ${articlesPassedComparisons.length} articles past passing comparisons`,
        {
          articles: articlesPassedComparisons.map((a) => ({
            id: a.flattened.id,
            title: a.flattened.title,
          })),
        }
      );
    }

    // any new comparisons stored must re-store all articles
    if (newArticles.length > 0) {
      await this.storeArticles(id, newArticles, {
        comparisonFields: storedComparisons,
      });
    }

    if (articlesPassedComparisons.length) {
      await this.storeArticles(id, articlesPassedComparisons, {
        comparisonFields: storedComparisons,
        skipIdStorage: true,
      });
    }

    const unstoredComparisons = comparisonStorageResults
      .filter((r) => !r.isStored)
      .map((r) => r.field);

    if (unstoredComparisons.length > 0) {
      await this.storeArticles(id, articles, {
        comparisonFields: unstoredComparisons,
        skipIdStorage: true,
      });
    }

    /**
     * Reverse since feed XMLs typically store newest articles at the top, so we want to deliver
     * the oldest articles first (hence putting them in the lowest indices)
     */
    const articlesPreCheck = [
      ...articlesPastBlocks,
      ...articlesPassedComparisons,
    ].reverse();

    const articlesPostDateCheck = this.filterArticlesBasedOnDateChecks(
      articlesPreCheck,
      dateChecks
    );

    if (debug) {
      logger.datadog(
        `Debug feed ${id}: ${articlesPostDateCheck.length} articles after date checks`,
        {
          articles: articlesPostDateCheck.map((a) => ({
            id: a.flattened.id,
            title: a.flattened.title,
          })),
        }
      );
    }

    return {
      allArticles: articles,
      articlesToDeliver: articlesPostDateCheck,
    };
  }

  filterArticlesBasedOnDateChecks(
    articles: Article[],
    dateChecks?: UserFeedDateCheckOptions
  ) {
    if (!dateChecks) {
      return articles;
    }

    const { datePlaceholderReferences, oldArticleDateDiffMsThreshold } =
      dateChecks;

    if (!oldArticleDateDiffMsThreshold) {
      return articles;
    }

    return articles.filter((a) => {
      const defaultPlaceholders: Array<keyof Item> = ["date", "pubdate"];
      const placeholdersToUse =
        datePlaceholderReferences || defaultPlaceholders;

      const dateValue = placeholdersToUse
        .map((placeholder) =>
          dayjs(a.raw[placeholder as never] || "invalid date")
        )
        .filter((d) => d.isValid())
        .find((v) => !!v);

      if (!dateValue) {
        return false;
      }

      const diffMs = dayjs().diff(dateValue, "millisecond");

      return diffMs <= oldArticleDateDiffMsThreshold;
    });
  }

  async hasPriorArticlesStored(feedId: string) {
    return this.partitionedFieldStoreService.hasArticlesStoredForFeed(feedId);
  }

  async storeArticles(
    feedId: string,
    articles: Article[],
    options?: {
      comparisonFields?: string[];
      /**
       * Set to true if we only want to store comparison fields
       */
      skipIdStorage?: boolean;
    }
  ) {
    const fieldsToSave: PartitionedFeedArticleFieldInsert[] = [];

    if (!options?.skipIdStorage) {
      for (let i = 0; i < articles.length; ++i) {
        const article = articles[i];

        fieldsToSave.push({
          feedId: feedId,
          fieldName: "id",
          fieldHashedValue: article.flattened.idHash,
          createdAt: new Date(),
        });
      }
    }

    try {
      await this.orm.em.transactional(async (em) => {
        await this.partitionedFieldStoreService.markForPersistence(
          fieldsToSave
        );

        await this.storeArticleComparisons(
          em,
          feedId,
          articles,
          options?.comparisonFields || []
        );
      });
    } catch (err) {
      if (
        err instanceof UniqueConstraintViolationException &&
        err.code === "23505"
      ) {
        return;
      }

      throw err;
    }
  }

  private async storeArticleComparisons(
    em: EntityManager,
    feedId: string,
    articles: Article[],
    comparisonFields: string[]
  ) {
    if (comparisonFields.length === 0) {
      return;
    }

    const foundComparisonNames = await this.articleCustomComparisonRepo.find(
      {
        feed_id: feedId,
        field_name: {
          $in: comparisonFields,
        },
      },
      {
        fields: ["field_name"],
      }
    );

    const comparisonNamesToStore = comparisonFields
      .filter(
        (name) => !foundComparisonNames.find((n) => n.field_name === name)
      )
      .map(
        (name) =>
          new FeedArticleCustomComparison({
            feed_id: feedId,
            field_name: name,
          })
      );

    em.persist(comparisonNamesToStore);

    const fieldsToSave: PartitionedFeedArticleFieldInsert[] = [];

    for (let i = 0; i < articles.length; ++i) {
      const article = articles[i];

      comparisonFields.forEach((field) => {
        const fieldValue = article.flattened[field];

        if (fieldValue) {
          const hashedValue = sha1.copy().update(fieldValue).digest("hex");

          fieldsToSave.push({
            feedId: feedId,
            fieldName: field,
            fieldHashedValue: hashedValue,
            createdAt: new Date(),
          });
        }
      });
    }

    await this.partitionedFieldStoreService.markForPersistence(fieldsToSave);
  }

  async filterForNewArticles(
    feedId: string,
    articles: Article[]
  ): Promise<Article[]> {
    /**
     * feed has a, b, c
     *
     * a - 5 months ago
     * b - 10 days ago
     * c - never stored
     *
     * Ideal state: c should be delivered, a should be re-stored for efficient lookups
     *
     * FIRST PASS - see if any of the articles have been stored within one month
     *  db returns b
     *  filter for articles that are not in the db, so we have a and c
     *
     *  a and c are candidates for delivery
     *
     * SECOND PASS - from the candidates, see if any have been stored older than one month
     *  db returns a
     *
     * filter for articles that are neither in the first pass nor the second pass (a,b), and these
     * are eligible for delivery
     *
     * re-store all articles found in the second pass
     */
    const mapOfArticles = new Map(
      articles.map((article) => [article.flattened.idHash, article])
    );
    const articleIds = Array.from(mapOfArticles.keys());
    // Do a first pass to see if any of the articles have been stored within one month
    const idsStoredInPastMonth = (
      await this.partitionedFieldStoreService.findIdFieldsForFeed(
        feedId,
        articleIds,
        false
      )
    ).map((r) => r.field_hashed_value);
    const idsStoredInPastMonthSet = new Set(idsStoredInPastMonth);

    const articleIdsPossibleForDelivery = articleIds.filter(
      (id) => !idsStoredInPastMonthSet.has(id)
    );

    if (articleIdsPossibleForDelivery.length === 0) {
      return [];
    }

    // Do a second pass to see if any of the articles have been stored older than one month
    const idsStoredOlderThanOneMonth = (
      await this.partitionedFieldStoreService.findIdFieldsForFeed(
        feedId,
        articleIdsPossibleForDelivery,
        true
      )
    ).map((r) => r.field_hashed_value);

    const articlesOlderThanOneMonthToStore = idsStoredOlderThanOneMonth
      .map((id) => mapOfArticles.get(id))
      .filter((a): a is Exclude<typeof a, undefined> => !!a);

    if (articlesOlderThanOneMonthToStore.length) {
      await this.storeArticles(feedId, articlesOlderThanOneMonthToStore);
    }

    const allStored = new Set(
      idsStoredInPastMonth.concat(idsStoredOlderThanOneMonth)
    );

    return articleIds
      .filter((id) => !allStored.has(id))
      .map((id) => mapOfArticles.get(id)) as Article[];
  }

  async areComparisonsStored(feedId: string, comparisonFields: string[]) {
    const rows = await this.articleCustomComparisonRepo.find(
      {
        feed_id: feedId,
        field_name: {
          $in: comparisonFields,
        },
      },
      {
        fields: ["field_name"],
      }
    );

    const storedFields = new Set(rows.map((r) => r.field_name));

    return comparisonFields.map((field) => ({
      field,
      isStored: storedFields.has(field),
    }));
  }

  async articleFieldsSeenBefore(
    feedId: string,
    article: Article,
    fieldKeys: string[]
  ) {
    const queries: Array<{ name: string; value: string }> = [];

    for (const key of fieldKeys) {
      const value = article.flattened[key];

      if (value) {
        const hashedValue = sha1.copy().update(value).digest("hex");

        queries.push({ name: key, value: hashedValue });
      }
    }

    if (queries.length === 0) {
      return false;
    }

    return this.partitionedFieldStoreService.someFieldsExist(feedId, queries);
  }

  async checkBlockingComparisons(
    { id, blockingComparisons }: { id: string; blockingComparisons: string[] },
    newArticles: Article[],
    currentlyStoredComparisons: string[]
  ) {
    const currentlyStoredBlockingComparisons = blockingComparisons.filter((r) =>
      currentlyStoredComparisons.includes(r)
    );

    if (
      newArticles.length === 0 ||
      !currentlyStoredBlockingComparisons.length
    ) {
      return newArticles;
    }

    if (blockingComparisons.length === 0) {
      // send to medium

      return newArticles;
    }

    const articlesToSend = await Promise.all(
      newArticles.map(async (article) => {
        const shouldBlock = await this.articleFieldsSeenBefore(
          id,
          article,
          currentlyStoredBlockingComparisons
        );

        return shouldBlock ? null : article;
      })
    );

    return articlesToSend.filter((article) => !!article) as Article[];
  }

  async checkPassingComparisons(
    { id, passingComparisons }: { id: string; passingComparisons: string[] },
    seenArticles: Article[],
    currentlyStoredComparisons: string[]
  ) {
    if (seenArticles.length === 0) {
      return seenArticles;
    }

    const currentlyStoredPassingComparisons = passingComparisons.filter((r) =>
      currentlyStoredComparisons.includes(r)
    );

    if (
      passingComparisons.length === 0 ||
      !currentlyStoredPassingComparisons.length
    ) {
      return [];
    }

    // All passing comparisons are confirmed to be stored

    const articlesToSend = await Promise.all(
      seenArticles.map(async (article) => {
        const shouldPass = await this.articleFieldsSeenBefore(
          id,
          article,
          currentlyStoredComparisons
        );

        return shouldPass ? null : article;
      })
    );

    return articlesToSend.filter((article) => !!article) as Article[];
  }

  async deleteInfoForFeed(feedId: string) {
    await this.partitionedFieldStoreService.deleteAllForFeed(feedId);

    await this.articleCustomComparisonRepo.nativeDelete({
      feed_id: feedId,
    });
  }

  private calculateCacheKeyForArticles({
    url,
    options,
  }: {
    url: string;
    options: FetchFeedArticleOptions;
  }) {
    const normalizedOptions: Partial<FetchFeedArticleOptions> = {
      formatOptions: {
        dateFormat: options.formatOptions.dateFormat || undefined,
        dateLocale: options.formatOptions.dateLocale || undefined,
        dateTimezone: options.formatOptions.dateTimezone || undefined,
        disableImageLinkPreviews:
          options.formatOptions.disableImageLinkPreviews || undefined,
      },
      externalFeedProperties: !!options.externalFeedProperties?.length
        ? options.externalFeedProperties
        : undefined,
      requestLookupDetails: options.requestLookupDetails
        ? {
            key: options.requestLookupDetails.key,
          }
        : undefined,
    };

    // delete format options if every field is undefined

    if (
      Object.keys(normalizedOptions?.formatOptions || {}).every(
        (key) => normalizedOptions?.formatOptions?.[key as never] === undefined
      )
    ) {
      delete normalizedOptions?.formatOptions;
    }

    if (!normalizedOptions.externalFeedProperties) {
      delete normalizedOptions.externalFeedProperties;
    }

    return `articles:com:${sha1
      .copy()
      .update(
        JSON.stringify({
          url,
          options: normalizedOptions,
        })
      )
      .digest("hex")}`;
  }

  private extractRssFromHtml(html: string) {
    if (!valid(html)) {
      return null;
    }

    const root = parse(html);

    const elem = root.querySelector('link[type="application/rss+xml"]');

    if (!elem) {
      return null;
    }

    return elem.getAttribute("href") || null;
  }

  private async getArticlesFromXml(
    ...args: Parameters<ArticleParserService["getArticlesFromXml"]>
  ): ReturnType<
    (typeof ArticleParserService)["prototype"]["getArticlesFromXml"]
  > {
    if (process.env.NODE_ENV === "test") {
      return this.articleParserService.getArticlesFromXml(...args);
    }

    try {
      return await this.feedParserPool.exec("getArticlesFromXml", args);
    } catch (err) {
      if (err instanceof Error && err.message === "Invalid feed") {
        throw new InvalidFeedException(err.message, args[0]);
      }

      throw err;
    }
  }
}
