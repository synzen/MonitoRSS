import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import { Injectable } from "@nestjs/common";
import { FeedArticleCustomComparison, FeedArticleField } from "./entities";
import FeedParser from "feedparser";
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

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(FeedArticleField)
    private readonly articleFieldRepo: EntityRepository<FeedArticleField>,
    @InjectRepository(FeedArticleCustomComparison)
    private readonly articleCustomComparisonRepo: EntityRepository<FeedArticleCustomComparison>,
    private readonly articleParserService: ArticleParserService,
    private readonly orm: MikroORM
  ) {}

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
    }: {
      id: string;
      blockingComparisons: string[];
      passingComparisons: string[];
      formatOptions: UserFeedFormatOptions;
    }
  ) {
    const { articles } = await this.getArticlesFromXml(feedXml, {
      formatOptions: {
        dateFormat: formatOptions.dateFormat,
        dateTimezone: formatOptions.dateTimezone,
      },
    });

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
    const seenArticles = articles.filter(
      (article) =>
        !newArticles.find((a) => a.flattened.id === article.flattened.id)
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
    return [...articlesPastBlocks, ...articlesPassedComparisons].reverse();
  }

  async hasPriorArticlesStored(feedId: string) {
    const result = await this.articleFieldRepo.count({
      feed_id: feedId,
    });

    return result > 0;
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
          field_value: article.flattened.id,
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
          fieldsToSave.push(
            new FeedArticleField({
              feed_id: feedId,
              field_name: field,
              field_value: fieldValue,
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
      articles.map((article) => [article.flattened.id, article])
    );
    const articleIds = Array.from(mapOfArticles.keys());
    const foundFieldVals = await this.articleFieldRepo.find(
      {
        feed_id: feedId,
        field_name: "id",
        field_value: {
          $in: articleIds,
        },
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
      "feed_id" | "field_name" | "field_value"
    >[] = [];

    for (const key of fieldKeys) {
      const value = getNestedPrimitiveValue(article.flattened, key);

      if (value) {
        queries.push({
          feed_id: feedId,
          field_name: key,
          field_value: value,
        });
      }
    }

    if (queries.length === 0) {
      return false;
    }

    const count = await this.articleFieldRepo.count({
      $or: queries,
    });

    return count > 0;
  }

  async getArticlesFromXml(
    xml: string,
    options: {
      timeout?: number;
      formatOptions: UserFeedFormatOptions;
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
        if (err.message === "Not a feed") {
          reject(new InvalidFeedException("Invalid feed"));
        } else {
          reject(err.message);
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

      feedparser.on("end", () => {
        clearTimeout(timeout);

        if (rawArticles.length === 0) {
          return resolve({ articles: [] });
        }

        clearTimeout(timeout);
        const idType = idResolver.getIDType();

        const mappedArticles: Article[] = rawArticles.map((rawArticle) => {
          const { flattened } = this.articleParserService.flatten(
            rawArticle as never,
            options.formatOptions
          );

          return {
            flattened: {
              ...flattened,
              id: ArticleIDResolver.getIDTypeValue(rawArticle as never, idType),
            },
            raw: rawArticle,
          };
        });

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
