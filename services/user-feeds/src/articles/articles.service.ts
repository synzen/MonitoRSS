import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import { Injectable } from "@nestjs/common";
import { FeedArticleCustomComparison, FeedArticleField } from "./entities";
import FeedParser, { Item } from "feedparser";
import { ArticleIDResolver } from "./utils";
import { FeedParseTimeoutException, InvalidFeedException } from "./exceptions";
import { getNestedPrimitiveValue } from "./utils/get-nested-primitive-value";
import {
  EntityManager,
  MikroORM,
  UniqueConstraintViolationException,
} from "@mikro-orm/core";
import { Article, UserFeedFormatOptions } from "../shared/types";
import { ArticleParserService } from "../article-parser/article-parser.service";
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
import { MAX_ARTICLE_INJECTION_ARTICLE_COUNT } from "../shared";
import { ExternalFeedPropertyDto } from "../article-formatter/types";

const sha1 = createHash("sha1");

interface FetchFeedArticleOptions {
  formatOptions: UserFeedFormatOptions;
  externalFeedProperties?: ExternalFeedPropertyDto[];
}

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(FeedArticleField)
    private readonly articleFieldRepo: EntityRepository<FeedArticleField>,
    @InjectRepository(FeedArticleCustomComparison)
    private readonly articleCustomComparisonRepo: EntityRepository<FeedArticleCustomComparison>,
    private readonly articleParserService: ArticleParserService,
    private readonly orm: MikroORM,
    private readonly feedFetcherService: FeedFetcherService
  ) {}

  async fetchFeedArticles(
    url: string,
    { formatOptions, externalFeedProperties }: FetchFeedArticleOptions
  ) {
    const response = await this.feedFetcherService.fetch(url, {
      executeFetchIfNotInCache: true,
    });

    if (!response.body) {
      return null;
    }

    return this.getArticlesFromXml(response.body, {
      formatOptions,
      useParserRules: getParserRules({ url }),
      externalFeedProperties,
    });
  }

  async fetchFeedArticle(
    url: string,
    id: string,
    { formatOptions, externalFeedProperties }: FetchFeedArticleOptions
  ) {
    const result = await this.fetchFeedArticles(url, {
      formatOptions,
      externalFeedProperties,
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
    { formatOptions }: FetchFeedArticleOptions
  ) {
    const result = await this.fetchFeedArticles(url, {
      formatOptions,
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
  ) {
    const { articles } = await this.getArticlesFromXml(feedXml, {
      formatOptions,
      useParserRules,
      externalFeedProperties,
    });

    logger.debug(`Found articles:`, {
      titles: articles.map((a) => a.raw.title),
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
      return [];
    }

    const priorArticlesStored = await this.hasPriorArticlesStored(id);

    if (!priorArticlesStored) {
      await this.storeArticles(id, articles, {
        comparisonFields: [...blockingComparisons, ...passingComparisons],
      });

      return [];
    }

    const newArticles = await this.filterForNewArticles(id, articles);

    if (debug) {
      logger.datadog(
        `Debug feed ${id}: ${newArticles.length} new articles determined`,
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
    const articlesPassedComparisons = await this.checkPassingComparisons(
      {
        id,
        passingComparisons,
      },
      seenArticles,
      storedComparisons
    );

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
          articles: newArticles.map((a) => ({
            id: a.flattened.id,
            title: a.flattened.title,
          })),
        }
      );
    }

    if (articlesPostDateCheck.length <= MAX_ARTICLE_INJECTION_ARTICLE_COUNT) {
      for (const a of articlesPostDateCheck) {
        await a.injectArticleContent(a.flattened);
      }
    }

    return articlesPostDateCheck;
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
    const result = await this.articleFieldRepo.findOne(
      {
        feed_id: feedId,
        is_hashed: true,
      },
      {
        fields: ["id"],
      }
    );

    return !!result;
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
    const fieldsToSave: FeedArticleField[] = [];

    for (let i = 0; i < articles.length; ++i) {
      const article = articles[i];

      fieldsToSave.push(
        new FeedArticleField({
          feed_id: feedId,
          field_name: "id",
          field_value: article.flattened.idHash,
          is_hashed: true,
        })
      );
    }

    try {
      await this.orm.em.transactional(async (em) => {
        em.persist(fieldsToSave);
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

    const fieldsToSave: FeedArticleField[] = [];

    for (let i = 0; i < articles.length; ++i) {
      const article = articles[i];

      comparisonFields.forEach((field) => {
        const fieldValue = getNestedPrimitiveValue(article.flattened, field);

        if (fieldValue) {
          const hashedValue = sha1.copy().update(fieldValue).digest("hex");

          fieldsToSave.push(
            new FeedArticleField({
              feed_id: feedId,
              field_name: field,
              field_value: hashedValue,
              is_hashed: true,
            })
          );
        }
      });
    }

    em.persist(fieldsToSave);
  }

  async filterForNewArticles(
    feedId: string,
    articles: Article[]
  ): Promise<Article[]> {
    const mapOfArticles = new Map(
      articles.map((article) => [article.flattened.idHash, article])
    );
    const articleIds = Array.from(mapOfArticles.keys());
    const foundFieldVals = await this.articleFieldRepo.find(
      {
        feed_id: feedId,
        field_name: "id",
        field_value: {
          $in: articleIds,
        },
        is_hashed: true,
      },
      {
        fields: ["field_value"],
      }
    );

    const foundIds = new Set(foundFieldVals.map((f) => f.field_value));

    return articleIds
      .filter((id) => !foundIds.has(id))
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
    const queries: Pick<
      FeedArticleField,
      "feed_id" | "field_name" | "field_value" | "is_hashed"
    >[] = [];

    for (const key of fieldKeys) {
      const value = getNestedPrimitiveValue(article.flattened, key);

      if (value) {
        const hashedValue = sha1.copy().update(value).digest("hex");

        queries.push({
          feed_id: feedId,
          field_name: key,
          field_value: hashedValue,
          is_hashed: true,
        });
      }
    }

    if (queries.length === 0) {
      return false;
    }

    const foundOne = await this.articleFieldRepo.findOne(
      {
        $or: queries,
      },
      {
        fields: ["id"],
      }
    );

    return !!foundOne;
  }

  async getArticlesFromXml(
    xml: string,
    options: {
      timeout?: number;
      formatOptions: UserFeedFormatOptions;
      useParserRules: PostProcessParserRule[] | undefined;
      externalFeedProperties?: Array<ExternalFeedProperty>;
    }
  ): Promise<{
    articles: Article[];
  }> {
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

        const mappedArticles: Article[] = await Promise.all(
          rawArticles.map(async (rawArticle) => {
            const id = ArticleIDResolver.getIDTypeValue(
              rawArticle as never,
              idType
            );

            const { flattened, injectArticleContent } =
              await this.articleParserService.flatten(rawArticle as never, {
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
              raw: rawArticle,
              injectArticleContent,
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

        resolve({
          articles: mappedArticles,
        });
      });
    });

    feedparser.write(xml);
    feedparser.end();

    return promise;
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

    const storedComparisonResults = await this.areComparisonsStored(
      id,
      passingComparisons
    );

    const relevantComparisons = storedComparisonResults
      .filter((r) => r.isStored)
      .map((r) => r.field);

    if (relevantComparisons.length === 0) {
      /**
       * Just store the comparison values, otherwise all articles would get delivered since none
       * of the comparison values have been seen before.
       */
      return [];
    }

    const articlesToSend = await Promise.all(
      seenArticles.map(async (article) => {
        const shouldBlock = await this.articleFieldsSeenBefore(
          id,
          article,
          relevantComparisons
        );

        return shouldBlock ? null : article;
      })
    );

    return articlesToSend.filter((article) => !!article) as Article[];
  }

  async deleteInfoForFeed(feedId: string) {
    await this.articleFieldRepo.nativeDelete({
      feed_id: feedId,
    });

    await this.articleCustomComparisonRepo.nativeDelete({
      feed_id: feedId,
    });
  }
}
