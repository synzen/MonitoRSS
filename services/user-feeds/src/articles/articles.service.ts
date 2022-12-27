import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import { Injectable } from "@nestjs/common";
import { FeedArticleCustomComparison, FeedArticleField } from "./entities";
import FeedParser from "feedparser";
import { ArticleIDResolver } from "./utils";
import { FeedParseTimeoutException, InvalidFeedException } from "./exceptions";
import { getNestedPrimitiveValue } from "./utils/get-nested-primitive-value";
import { EntityManager, MikroORM } from "@mikro-orm/core";
import { Article } from "../shared/types";
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
    }: {
      id: string;
      blockingComparisons: string[];
      passingComparisons: string[];
    }
  ) {
    const { articles } = await this.getArticlesFromXml(feedXml);

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
      (article) => !newArticles.find((a) => a.id === article.id)
    );

    const articlesPastBlocks = await this.checkBlockingComparisons(
      { id, blockingComparisons },
      newArticles
    );
    const articlesPassedComparisons = await this.checkPassingComparisons(
      {
        id,
        passingComparisons,
      },
      seenArticles
    );

    // any new comparisons stored must re-store all articles
    if (newArticles.length > 0) {
      await this.storeArticles(id, newArticles, {
        comparisonFields: [...passingComparisons, ...blockingComparisons],
      });
    }

    return [...articlesPastBlocks, ...articlesPassedComparisons];
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
    }
  ) {
    const fieldsToSave: FeedArticleField[] = [];

    for (let i = 0; i < articles.length; ++i) {
      const article = articles[i];

      fieldsToSave.push(
        new FeedArticleField({
          feed_id: feedId,
          field_name: "id",
          field_value: article.id,
        })
      );
    }

    await this.orm.em.transactional(async (em) => {
      em.persist(fieldsToSave);
      await this.storeArticleComparisons(
        em,
        feedId,
        articles,
        options?.comparisonFields || []
      );
    });
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
        const fieldValue = getNestedPrimitiveValue(article, field);

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
      articles.map((article) => [article.id, article])
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

    return comparisonFields.map((field) => storedFields.has(field));
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
      const value = getNestedPrimitiveValue(article, key);

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
    options?: {
      timeout?: number;
    }
  ): Promise<{
    articles: Article[];
  }> {
    const feedparser = new FeedParser({});
    const idResolver = new ArticleIDResolver();
    const rawArticles: FeedParser.Item[] = [];

    const promise = new Promise<{ articles: Article[] }>((resolve, reject) => {
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

        resolve({
          articles: rawArticles.map((rawArticle) => ({
            ...this.articleParserService.flatten(rawArticle as never),
            id: ArticleIDResolver.getIDTypeValue(rawArticle as never, idType),
          })),
        });
      });
    });

    feedparser.write(xml);
    feedparser.end();

    return promise;
  }

  async checkBlockingComparisons(
    { id, blockingComparisons }: { id: string; blockingComparisons: string[] },
    newArticles: Article[]
  ) {
    if (newArticles.length === 0) {
      return newArticles;
    }

    if (blockingComparisons.length === 0) {
      // send to medium

      return newArticles;
    }

    const relevantComparisons = await this.areComparisonsStored(
      id,
      blockingComparisons
    );

    const relevantCustomComparisons = relevantComparisons
      .filter((result) => result)
      .map((_, i) => blockingComparisons[i]);

    const articlesToSend = await Promise.all(
      newArticles.map(async (article) => {
        const shouldBlock = await this.articleFieldsSeenBefore(
          id,
          article,
          relevantCustomComparisons
        );

        return shouldBlock ? null : article;
      })
    );

    return articlesToSend.filter((article) => !!article) as Article[];
  }

  async checkPassingComparisons(
    { id, passingComparisons }: { id: string; passingComparisons: string[] },
    seenArticles: Article[]
  ) {
    if (seenArticles.length === 0) {
      return seenArticles;
    }

    if (passingComparisons.length === 0) {
      // send to medium

      return [];
    }

    const storedComparisonResults = await this.areComparisonsStored(
      id,
      passingComparisons
    );

    const relevantComparisons = storedComparisonResults
      .filter((result) => result)
      .map((_, i) => passingComparisons[i]);

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
}
