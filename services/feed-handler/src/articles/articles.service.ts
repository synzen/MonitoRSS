import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import { Injectable } from "@nestjs/common";
import { FeedArticleField } from "./entities";
import { Article } from "./types";
import FeedParser from "feedparser";
import { ArticleIDResolver } from "./utils";
import { FeedParseTimeoutException, InvalidFeedException } from "./exceptions";

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(FeedArticleField)
    private readonly articleFieldRepo: EntityRepository<FeedArticleField>
  ) {}

  async hasPriorArticlesStored(feedId: string) {
    const result = await this.articleFieldRepo.count({
      feed_id: feedId,
    });

    return result > 0;
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
