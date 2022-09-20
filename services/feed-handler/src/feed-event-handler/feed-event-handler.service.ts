import { Injectable } from "@nestjs/common";
import { ValidationError } from "yup";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";
import { ArticlesService } from "../articles/articles.service";
import { FeedFetcherService } from "../feed-fetcher/feed-fetcher.service";
import { Article, FeedV2Event, feedV2EventSchema } from "../shared";

@Injectable()
export class FeedEventHandlerService {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly articleRateLimitService: ArticleRateLimitService,
    private readonly feedFetcherService: FeedFetcherService
  ) {}

  async handleV2Event(event: FeedV2Event): Promise<Article[]> {
    try {
      await feedV2EventSchema.validate(event, {
        abortEarly: false,
      });
    } catch (err) {
      const validationErrr = err as ValidationError;

      throw new Error(
        `Validation failed on incoming Feed V2 event: ${validationErrr.errors}`
      );
    }

    await this.articleRateLimitService.addOrUpdateFeedLimit(event.feed.id, {
      // hardcode seconds in a day for now
      timeWindowSec: 86400,
      limit: event.articleDayLimit,
    });

    const {
      feed: { id, url, blockingComparisons, passingComparisons },
    } = event;

    const feedXml = await this.feedFetcherService.fetch(url);

    if (!feedXml) {
      console.log("no feed xml returned, skipping");

      return [];
    }

    const { articles } = await this.articlesService.getArticlesFromXml(feedXml);

    if (!articles.length) {
      console.log("no articles found");

      return [];
    }

    const priorArticlesStored =
      await this.articlesService.hasPriorArticlesStored(id);

    if (!priorArticlesStored) {
      await this.articlesService.storeArticles(id, articles, {
        comparisonFields: [...blockingComparisons, ...passingComparisons],
      });

      console.log("no prior articles stored, initializing data");

      return [];
    }

    const newArticles = await this.articlesService.filterForNewArticles(
      id,
      articles
    );
    const seenArticles = articles.filter(
      (article) => !newArticles.find((a) => a.id === article.id)
    );

    const articlesPastBlocks = await this.checkBlockingComparisons(
      { id, url, blockingComparisons, passingComparisons },
      newArticles
    );
    const articlesPassedComparisons = await this.checkPassingComparisons(
      {
        blockingComparisons,
        id,
        passingComparisons,
        url,
      },
      seenArticles
    );

    // any new comparisons stored must re-store all articles
    if (newArticles.length > 0) {
      await this.articlesService.storeArticles(id, newArticles, {
        comparisonFields: [...passingComparisons, ...blockingComparisons],
      });
    }

    return [...articlesPastBlocks, ...articlesPassedComparisons];
  }

  async checkBlockingComparisons(
    { id, blockingComparisons }: FeedV2Event["feed"],
    newArticles: Article[]
  ) {
    if (newArticles.length === 0) {
      return newArticles;
    }

    if (blockingComparisons.length === 0) {
      // send to medium

      return newArticles;
    }

    const relevantComparisons = await this.articlesService.areComparisonsStored(
      id,
      blockingComparisons
    );

    const relevantCustomComparisons = relevantComparisons
      .filter((result) => result)
      .map((_, i) => blockingComparisons[i]);

    const articlesToSend = await Promise.all(
      newArticles.map(async (article) => {
        const shouldBlock = await this.articlesService.articleFieldsSeenBefore(
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
    { id, passingComparisons }: FeedV2Event["feed"],
    seenArticles: Article[]
  ) {
    if (seenArticles.length === 0) {
      return seenArticles;
    }

    if (passingComparisons.length === 0) {
      // send to medium

      return [];
    }

    const storedComparisonResults =
      await this.articlesService.areComparisonsStored(id, passingComparisons);

    const relevantComparisons = storedComparisonResults
      .filter((result) => result)
      .map((_, i) => passingComparisons[i]);

    const articlesToSend = await Promise.all(
      seenArticles.map(async (article) => {
        const shouldBlock = await this.articlesService.articleFieldsSeenBefore(
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
