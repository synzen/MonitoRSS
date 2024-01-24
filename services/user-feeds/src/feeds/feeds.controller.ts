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
  UnprocessableEntityException,
  Get,
  Query,
  ParseIntPipe,
  Param,
} from "@nestjs/common";
import { object, string, ValidationError } from "yup";
import { ArticleFiltersService } from "../article-filters/article-filters.service";
import { ArticleFormatterService } from "../article-formatter/article-formatter.service";
import { InvalidFeedException } from "../articles/exceptions";
import { DeliveryRecordService } from "../delivery-record/delivery-record.service";
import { DiscordMediumService } from "../delivery/mediums/discord-medium.service";
import { DiscordEmbed } from "../delivery/types";
import {
  FeedArticleNotFoundException,
  FeedRequestBadStatusCodeException,
  FeedRequestFetchException,
  FeedRequestParseException,
  FeedRequestTimedOutException,
} from "../feed-fetcher/exceptions";
import { FeedFetcherService } from "../feed-fetcher/feed-fetcher.service";
import {
  Article,
  discordMediumPayloadDetailsSchema,
  discordMediumTestPayloadDetailsSchema,
  feedV2EventSchemaDateChecks,
  feedV2EventSchemaFormatOptions,
  GetFeedArticlesRequestStatus,
  TransformValidationPipe,
  UserFeedFormatOptions,
} from "../shared";
import {
  CustomPlaceholderRegexEvalException,
  FiltersRegexEvalException,
} from "../shared/exceptions";
import { ApiGuard } from "../shared/guards";
import { TestDeliveryMedium, TestDeliveryStatus } from "./constants";
import {
  CreateFeedFilterValidationInputDto,
  CreateFeedFilterValidationOutputDto,
  CreatePreviewOutputDto,
  CreateTestArticleOutputDto,
  GetUserFeedArticlesInputDto,
  GetUserFeedArticlesOutputDto,
  GetUserFeedDeliveryRecordsOutputDto,
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
    private readonly articleFormatterService: ArticleFormatterService,
    private readonly articleFiltersService: ArticleFiltersService,
    private readonly deliveryRecordService: DeliveryRecordService
  ) {}

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
          dateFormat: formatter.options.dateFormat,
          dateTimezone: formatter.options.dateTimezone,
          disableImageLinkPreviews: formatter.options.disableImageLinkPreviews,
          dateLocale: formatter.options.dateLocale,
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
        articles: await Promise.all(
          fetchResult.articles.map(async (article) => {
            return this.discordMediumService.formatArticle(article, {
              ...formatter.options,
              customPlaceholders: formatter.customPlaceholders,
            });
          })
        ),
        limit,
        skip,
        selectProperties,
        filters,
        random,
        customPlaceholders: formatter.customPlaceholders,
      });

      return {
        result: {
          requestStatus: GetFeedArticlesRequestStatus.Success,
          articles: matchedArticles.map((a) => a.flattened),
          totalArticles,
          filterStatuses: filterEvalResults,
          selectedProperties: properties,
        },
      };
    } catch (err) {
      if (
        err instanceof FeedRequestParseException ||
        err instanceof InvalidFeedException
      ) {
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

      if (err instanceof FeedRequestTimedOutException) {
        return {
          result: {
            requestStatus: GetFeedArticlesRequestStatus.TimedOut,
            articles: [],
            totalArticles: 0,
            selectedProperties: [],
          },
        };
      }

      if (err instanceof CustomPlaceholderRegexEvalException) {
        throw new UnprocessableEntityException({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          code: "CUSTOM_PLACEHOLDER_REGEX_EVAL",
          message: err.message,
          errors: err.regexErrors,
        });
      } else if (err instanceof FiltersRegexEvalException) {
        throw new UnprocessableEntityException({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          code: "FILTERS_REGEX_EVAL",
          message: err.message,
          errors: err.regexErrors,
        });
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
              formatOptions: feedV2EventSchemaFormatOptions
                .optional()
                .default(undefined),
              dateChecks: feedV2EventSchemaDateChecks
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

      const type = withType.type;

      if (type === TestDeliveryMedium.Discord) {
        const { mediumDetails } = await object()
          .shape({
            mediumDetails: discordMediumTestPayloadDetailsSchema.required(),
          })
          .required()
          .validate(payload);

        let article: Article | null = null;

        const formatOptions: UserFeedFormatOptions = {
          dateFormat: withType.feed.formatOptions?.dateFormat,
          dateTimezone: withType.feed.formatOptions?.dateTimezone,
          disableImageLinkPreviews:
            mediumDetails.formatter.disableImageLinkPreviews,
          dateLocale: withType.feed.formatOptions?.dateLocale,
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

        const formattedArticle =
          await this.articleFormatterService.formatArticleForDiscord(article, {
            ...mediumDetails.formatter,
            customPlaceholders: mediumDetails.customPlaceholders,
          });

        const filterReferences =
          await this.articleFiltersService.buildReferences({
            article,
          });

        const { result, apiPayload } =
          await this.discordMediumService.deliverTestArticle(formattedArticle, {
            mediumDetails,
            filterReferences,
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

  @Post("preview")
  @UseGuards(ApiGuard)
  async createPreview(
    @Body() payload: Record<string, unknown>
  ): Promise<CreatePreviewOutputDto> {
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
                  dateTimezone: string().optional().default(undefined),
                  dateLocale: string().optional().default(undefined),
                })
                .optional()
                .default(undefined),
            })
            .required(),
          article: object()
            .shape({
              id: string().required(),
            })
            .required(),
        })
        .required()
        .validate(payload);

      const type = withType.type;

      if (type === TestDeliveryMedium.Discord) {
        const { mediumDetails } = await object({
          mediumDetails: discordMediumPayloadDetailsSchema.required(),
        })
          .required()
          .validate(payload);

        const formatOptions: UserFeedFormatOptions = {
          dateFormat: withType.feed.formatOptions?.dateFormat,
          dateTimezone: withType.feed.formatOptions?.dateTimezone,
          disableImageLinkPreviews:
            mediumDetails.formatter.disableImageLinkPreviews,
          dateLocale: withType.feed.formatOptions?.dateLocale,
        };

        const article = await this.feedFetcherService.fetchFeedArticle(
          withType.feed.url,
          withType.article.id,
          {
            formatOptions,
          }
        );

        if (!article) {
          return {
            status: TestDeliveryStatus.NoArticles,
          };
        }

        const formattedArticle =
          await this.articleFormatterService.formatArticleForDiscord(article, {
            ...mediumDetails.formatter,
            customPlaceholders: mediumDetails.customPlaceholders,
          });

        const filterReferences =
          await this.articleFiltersService.buildReferences({
            article,
          });

        const payloads = this.discordMediumService.generateApiPayloads(
          formattedArticle,
          {
            embeds: mediumDetails.embeds,
            splitOptions: mediumDetails.splitOptions,
            content: mediumDetails.content,
            filterReferences,
            mentions: mediumDetails.mentions,
            placeholderLimits: mediumDetails.placeholderLimits,
            enablePlaceholderFallback: mediumDetails.enablePlaceholderFallback,
            components: mediumDetails.components,
          }
        );

        const cleanedPayloads = payloads.map((payload) => ({
          ...payload,
          embeds: payload?.embeds?.map((embed) => ({
            ...embed,
            author: !embed.author?.name ? undefined : embed.author,
            footer: !embed.footer?.text ? undefined : embed.footer,
            thumbnail: !embed.thumbnail?.url ? undefined : embed.thumbnail,
            image: !embed.image?.url ? undefined : embed.image,
            fields: embed?.fields
              ?.map((field) =>
                !field.name || !field.value ? undefined : field
              )
              ?.filter(
                (field) => field !== undefined
              ) as DiscordEmbed["fields"],
          })),
        }));

        return {
          status: TestDeliveryStatus.Success,
          messages: cleanedPayloads,
        };
      } else {
        throw new Error(`Unhandled medium type: ${type}`);
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        throw new BadRequestException(err.errors);
      }

      if (err instanceof CustomPlaceholderRegexEvalException) {
        throw new UnprocessableEntityException({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          code: "CUSTOM_PLACEHOLDER_REGEX_EVAL",
          message: err.message,
          errors: err.regexErrors,
        });
      } else if (err instanceof FiltersRegexEvalException) {
        throw new UnprocessableEntityException({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          code: "FILTERS_REGEX_EVAL",
          message: err.message,
          errors: err.regexErrors,
        });
      }

      if (err instanceof FeedArticleNotFoundException) {
        throw new NotFoundException(err.message);
      }

      throw err;
    }
  }

  @Get("/:feedId/delivery-count")
  async getDeliveryCount(
    @Query("timeWindowSec", ParseIntPipe) timeWindowSec: number,
    @Param("feedId") feedId: string
  ) {
    const count =
      await this.deliveryRecordService.countDeliveriesInPastTimeframe(
        {
          feedId,
        },
        timeWindowSec
      );

    return {
      result: {
        count,
      },
    };
  }

  @Get("/:feedId/delivery-logs")
  async getDeliveryLogs(
    @Param("feedId") feedId: string,
    @Query("skip", ParseIntPipe) skip: number,
    @Query("limit") limit?: number
  ): Promise<GetUserFeedDeliveryRecordsOutputDto> {
    const logs = await this.deliveryRecordService.getDeliveryLogs({
      feedId,
      limit: limit || 25,
      skip,
    });

    return {
      result: {
        logs,
      },
    };
  }
}
