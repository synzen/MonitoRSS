import {
  Body,
  Controller,
  Post,
  Get,
  ValidationPipe,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { object, string, ValidationError } from "yup";
import { DiscordMediumService } from "../delivery/mediums/discord-medium.service";
import { FeedRequestParseException } from "../feed-fetcher/exceptions";
import { FeedFetcherService } from "../feed-fetcher/feed-fetcher.service";
import {
  discordMediumTestPayloadDetailsSchema,
  GetFeedArticlesRequestStatus,
  NestedQuery,
  TransformValidationPipe,
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
    private readonly feedFetcherService: FeedFetcherService
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

  @Get("articles")
  @UseGuards(ApiGuard)
  async getFeedArticles(
    @NestedQuery(TransformValidationPipe)
    {
      limit,
      random,
      url,
      skip,
      includeFilterResults,
      selectProperties,
    }: GetUserFeedArticlesInputDto
  ): Promise<GetUserFeedArticlesOutputDto> {
    const decodedUrl = decodeURIComponent(url);

    try {
      const fetchResult = await this.feedFetcherService.fetchFeedArticles(
        decodedUrl
      );

      if (!fetchResult) {
        return {
          result: {
            requestStatus: GetFeedArticlesRequestStatus.Pending,
            articles: [],
          },
        };
      }

      if (fetchResult.articles.length === 0) {
        return {
          result: {
            requestStatus: GetFeedArticlesRequestStatus.Success,
            articles: [],
          },
        };
      }

      const { articles: matchedArticles } =
        await this.feedsService.queryForArticles({
          articles: fetchResult.articles,
          limit,
          skip,
          selectProperties,
          includeFilterResults,
          random,
        });

      return {
        result: {
          requestStatus: GetFeedArticlesRequestStatus.Success,
          articles: matchedArticles,
        },
      };
    } catch (err) {
      if (err instanceof FeedRequestParseException) {
        return {
          result: {
            requestStatus: GetFeedArticlesRequestStatus.ParseError,
            articles: [],
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
            })
            .required(),
        })
        .required()
        .validate(payload);

      const randomArticle =
        await this.feedFetcherService.fetchRandomFeedArticle(withType.feed.url);

      if (!randomArticle) {
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

        const { result, apiPayload } =
          await this.discordMediumService.deliverTestArticle(randomArticle, {
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

      throw err;
    }
  }
}
