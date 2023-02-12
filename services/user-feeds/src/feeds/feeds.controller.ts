import {
  Body,
  Controller,
  Post,
  ValidationPipe,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import { object, string, ValidationError } from "yup";
import { ArticleFormatterService } from "../article-formatter/article-formatter.service";
import { DiscordMediumService } from "../delivery/mediums/discord-medium.service";
import {
  FeedArticleNotFoundException,
  FeedRequestBadStatusCodeException,
  FeedRequestFetchException,
  FeedRequestParseException,
} from "../feed-fetcher/exceptions";
import { FeedFetcherService } from "../feed-fetcher/feed-fetcher.service";
import {
  Article,
  discordMediumTestPayloadDetailsSchema,
  GetFeedArticlesRequestStatus,
  TransformValidationPipe,
  UserFeedFormatOptions,
} from "../shared";
import { ApiGuard } from "../shared/guards";
import { TestDeliveryMedium, TestDeliveryStatus } from "./constants";
import {
  CreateFeedFilterValidationInputDto,
  CreateFeedFilterValidationOutputDto,
  CreateFeedInputDto,
  CreateTestArticleOutputDto,
  GetUserFeedArticlesInputDto,
  GetUserFeedArticlesOutputDto,
} from "./dto";
import { FeedsService } from "./feeds.service";

@Controller({
  version: "1",
  path: "user-feeds",
})
export class FeedsController {
  constructor(
    private readonly feedsService: FeedsService,
    private readonly discordMediumService: DiscordMediumService,
    private readonly feedFetcherService: FeedFetcherService,
    private readonly articleFormatterService: ArticleFormatterService
  ) {}

  @Post("initialize")
  @UseGuards(ApiGuard)
  async initializeFeed(
    @Body(ValidationPipe) { feed, articleDailyLimit }: CreateFeedInputDto
  ) {
    await this.feedsService.initializeFeed(feed.id, {
      rateLimit: {
        limit: articleDailyLimit,
        timeWindowSec: 86400,
      },
    });

    return {
      articleRateLimits: await this.feedsService.getRateLimitInformation(
        feed.id
      ),
    };
  }

  @Post("filter-validation")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiGuard)
  createFeedFilterValidation(
    @Body(ValidationPipe) { expression }: CreateFeedFilterValidationInputDto
  ): CreateFeedFilterValidationOutputDto {
    const errors = this.feedsService.getFilterExpressionErrors(expression);

    return {
      result: {
        errors,
      },
    };
  }

  @Post("get-articles")
  @UseGuards(ApiGuard)
  @HttpCode(HttpStatus.OK)
  async getFeedArticles(
    @Body(TransformValidationPipe)
    {
      limit,
      random,
      url,
      skip,
      filters,
      selectProperties,
      formatter,
    }: GetUserFeedArticlesInputDto
  ): Promise<GetUserFeedArticlesOutputDto> {
    try {
      const fetchResult = await this.feedFetcherService.fetchFeedArticles(url, {
        formatOptions: {
          dateFormat: formatter?.options.dateFormat,
        },
      });

      if (!fetchResult) {
        return {
          result: {
            requestStatus: GetFeedArticlesRequestStatus.Pending,
            articles: [],
            totalArticles: 0,
            selectedProperties: [],
          },
        };
      }

      if (fetchResult.articles.length === 0) {
        return {
          result: {
            requestStatus: GetFeedArticlesRequestStatus.Success,
            articles: [],
            totalArticles: 0,
            selectedProperties: [],
          },
        };
      }

      const {
        articles: matchedArticles,
        properties,
        filterEvalResults,
        totalArticles,
      } = await this.feedsService.queryForArticles({
        articles: fetchResult.articles,
        limit,
        skip,
        selectProperties,
        filters,
        random,
      });

      const formattedArticles = await Promise.all(
        matchedArticles.map(async (article) => {
          return this.articleFormatterService.formatArticleForDiscord(article, {
            formatTables: formatter?.options.formatTables,
            stripImages: formatter?.options.stripImages,
          });
        })
      );

      return {
        result: {
          requestStatus: GetFeedArticlesRequestStatus.Success,
          articles: formattedArticles,
          totalArticles,
          filterStatuses: filterEvalResults,
          selectedProperties: properties,
        },
      };
    } catch (err) {
      if (err instanceof FeedRequestParseException) {
        return {
          result: {
            requestStatus: GetFeedArticlesRequestStatus.ParseError,
            articles: [],
            totalArticles: 0,
            selectedProperties: [],
          },
        };
      }

      if (err instanceof FeedRequestFetchException) {
        return {
          result: {
            requestStatus: GetFeedArticlesRequestStatus.FetchError,
            articles: [],
            totalArticles: 0,
            selectedProperties: [],
          },
        };
      }

      if (err instanceof FeedRequestBadStatusCodeException) {
        return {
          result: {
            requestStatus: GetFeedArticlesRequestStatus.BadStatusCode,
            articles: [],
            totalArticles: 0,
            response: {
              statusCode: err.statusCode,
            },
            selectedProperties: [],
          },
        };
      }

      throw err;
    }
  }

  @Post("test")
  @UseGuards(ApiGuard)
  async sendTestArticle(
    @Body() payload: Record<string, unknown>
  ): Promise<CreateTestArticleOutputDto> {
    try {
      const withType = await object()
        .shape({
          type: string().oneOf(Object.values(TestDeliveryMedium)).required(),
          feed: object()
            .shape({
              url: string().required(),
              formatOptions: object()
                .shape({
                  dateFormat: string().optional().default(undefined),
                })
                .optional()
                .default(undefined),
            })
            .required(),
          article: object()
            .shape({
              id: string().required(),
            })
            .optional()
            .default(undefined),
        })
        .required()
        .validate(payload);

      let article: Article | null = null;

      const formatOptions: UserFeedFormatOptions = {
        dateFormat: withType.feed.formatOptions?.dateFormat,
      };

      if (!withType.article) {
        article = await this.feedFetcherService.fetchRandomFeedArticle(
          withType.feed.url,
          {
            formatOptions,
          }
        );
      } else {
        article = await this.feedFetcherService.fetchFeedArticle(
          withType.feed.url,
          withType.article.id,
          {
            formatOptions,
          }
        );
      }

      if (!article) {
        return {
          status: TestDeliveryStatus.NoArticles,
        };
      }

      const type = withType.type;

      if (type === TestDeliveryMedium.Discord) {
        const { mediumDetails } = await object()
          .shape({
            mediumDetails: discordMediumTestPayloadDetailsSchema.required(),
          })
          .required()
          .validate(payload);

        const formattedArticle =
          await this.articleFormatterService.formatArticleForDiscord(article, {
            formatTables: mediumDetails.formatter.formatTables,
            stripImages: mediumDetails.formatter.stripImages,
          });

        const { result, apiPayload } =
          await this.discordMediumService.deliverTestArticle(formattedArticle, {
            mediumDetails,
          });

        if (result.state !== "success") {
          throw new Error(
            `Internal error occurred while delivering test` +
              ` article: (status: ${result.state}, message: ${result.message}`
          );
        }

        if (result.status >= 500) {
          return {
            status: TestDeliveryStatus.ThirdPartyInternalError,
            apiPayload,
          };
        } else if (result.status === 401 || result.status === 403) {
          return {
            status: TestDeliveryStatus.MissingApplicationPermission,
            apiPayload,
          };
        } else if (result.status === 400) {
          return {
            status: TestDeliveryStatus.BadPayload,
            apiResponse: result.body,
            apiPayload,
          };
        } else if (result.status === 404) {
          return {
            status: TestDeliveryStatus.MissingChannel,
            apiResponse: result.body,
            apiPayload,
          };
        } else if (result.status === 429) {
          return {
            status: TestDeliveryStatus.TooManyRequests,
            apiPayload,
          };
        } else if (result.status >= 200 && result.status < 300) {
          return {
            status: TestDeliveryStatus.Success,
            apiPayload,
          };
        } else {
          throw new Error(
            `Unhandled Discord API status code when sending test article: ${result.status}`
          );
        }
      } else {
        throw new Error(`Unhandled medium type: ${type}`);
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        throw new BadRequestException(err.errors);
      }

      if (err instanceof FeedArticleNotFoundException) {
        throw new NotFoundException(err.message);
      }

      throw err;
    }
  }
}
