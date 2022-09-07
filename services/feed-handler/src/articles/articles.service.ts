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

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(FeedArticleField)
    private readonly articleFieldRepo: EntityRepository<FeedArticleField>,
    @InjectRepository(FeedArticleCustomComparison)
    private readonly articleCustomComparisonRepo: EntityRepository<FeedArticleCustomComparison>,
    private readonly orm: MikroORM
  ) {}

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

  async filterForNewArticleIds(feedId: string, articleIds: string[]) {
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

    return articleIds.filter((id) => !foundIds.has(id));
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
          reject(new InvalidFeedException());
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

      feedparser.on("end", () => {
        clearTimeout(timeout);

        if (rawArticles.length === 0) {
          return resolve({ articles: [] });
        }

        clearTimeout(timeout);
        const idType = idResolver.getIDType();

        resolve({
          articles: rawArticles.map((rawArticle) => ({
            ...rawArticle,
            id: ArticleIDResolver.getIDTypeValue(rawArticle as never, idType),
          })),
        });
      });
    });

    feedparser.write(xml);
    feedparser.end();

    return promise;
  }
}
