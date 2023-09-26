import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { CannotEnableAutoDisabledConnection } from "../../common/exceptions";
import { convertToFlatDiscordEmbeds } from "../../utils/convert-to-flat-discord-embed";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";
import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import {
  FeedConnectionDisabledCode,
  FeedConnectionType,
} from "../feeds/constants";
import { GetUserFeedPipe } from "../user-feeds/pipes";
import {
  CreateDiscordWebhookConnectionCloneInputDto,
  CreateDiscordWebhookConnectionPreviewInputDto,
  CreateDiscordWebhookConnectionPreviewOutputDto,
  CreateDiscordWebhookConnectionTestArticleInputDto,
  CreateDiscordWebhookConnectionTestArticleOutputDto,
  UpdateDiscordWebhookConnectionInputDto,
  UpdateDiscordWebhookConnectionOutputDto,
} from "./dto";
import { FeedConnectionsDiscordWebhooksService } from "./feed-connections-discord-webhooks.service";
import {
  CreateDiscordWebhookTestArticleFilter,
  DeleteDiscordWebhookConnectionFilter,
  UpdateDiscordWebhookConnectionFilter,
} from "./filters";
import {
  GetFeedDiscordWebhookConnectionPipe,
  GetFeedDiscordWebhookConnectionPipeOutput,
} from "./pipes";

@Controller("user-feeds/:feedId/connections")
@UseGuards(DiscordOAuth2Guard)
export class FeedConnectionsDiscordWebhooksController {
  constructor(
    private readonly service: FeedConnectionsDiscordWebhooksService
  ) {}

  // @Post("/discord-webhooks")
  // @UseFilters(AddDiscordWebhookConnectionFilter)
  // async createDiscordWebhookConnection(
  //   @Param("feedId", GetUserFeedPipe()) feed: UserFeed,
  //   @Body(ValidationPipe)
  //   { name, webhook }: CreateDiscordWebhookConnectionInputDto,
  //   @DiscordAccessToken()
  //   { access_token, discord: { id: discordUserId } }: SessionAccessToken
  // ): Promise<CreateDiscordWebhookConnectionOutputDto> {
  //   const createdConnection = await this.service.createDiscordWebhookConnection(
  //     {
  //       discordUserId,
  //       accessToken: access_token,
  //       feedId: feed._id.toHexString(),
  //       name,
  //       webhook: {
  //         id: webhook.id,
  //         iconUrl: webhook.iconUrl,
  //         name: webhook.name,
  //       },
  //     }
  //   );

  //   return {
  //     id: createdConnection.id.toHexString(),
  //     name: createdConnection.name,
  //     key: FeedConnectionType.DiscordWebhook,
  //     filters: createdConnection.filters,
  //     splitOptions: createdConnection.splitOptions,
  //     details: {
  //       embeds: createdConnection.details.embeds,
  //       content: createdConnection.details.content,
  //       webhook: {
  //         id: createdConnection.details.webhook.id,
  //         iconUrl: createdConnection.details.webhook.iconUrl,
  //         name: createdConnection.details.webhook.name,
  //         guildId: createdConnection.details.webhook.guildId,
  //       },
  //     },
  //   };
  // }

  @Post("/discord-webhooks/:connectionId/test")
  @UseFilters(CreateDiscordWebhookTestArticleFilter)
  async sendTestArticle(
    @Param("feedId", GetUserFeedPipe(), GetFeedDiscordWebhookConnectionPipe)
    { feed, connection }: GetFeedDiscordWebhookConnectionPipeOutput,
    @Body(ValidationPipe)
    data: CreateDiscordWebhookConnectionTestArticleInputDto
  ): Promise<CreateDiscordWebhookConnectionTestArticleOutputDto> {
    const result = await this.service.sendTestArticle(feed, connection, {
      article: data.article,
      previewInput: {
        ...data,
        userFeed: feed,
        connection,
        feedFormatOptions: data.userFeedFormatOptions,
        customPlaceholders: data.customPlaceholders,
      },
    });

    return {
      result,
    };
  }

  @Post("/discord-webhooks/:connectionId/clone")
  async clone(
    @Param("feedId", GetUserFeedPipe(), GetFeedDiscordWebhookConnectionPipe)
    { feed, connection }: GetFeedDiscordWebhookConnectionPipeOutput,
    @Body(ValidationPipe)
    data: CreateDiscordWebhookConnectionCloneInputDto,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ) {
    const result = await this.service.cloneConnection(
      feed,
      connection,
      discordUserId,
      data
    );

    return {
      result,
    };
  }
  @Post("/discord-webhooks/:connectionId/preview")
  @UseFilters(CreateDiscordWebhookTestArticleFilter)
  async createPreview(
    @Param("feedId", GetUserFeedPipe(), GetFeedDiscordWebhookConnectionPipe)
    { feed, connection }: GetFeedDiscordWebhookConnectionPipeOutput,
    @Body(ValidationPipe)
    {
      article,
      content,
      embeds,
      userFeedFormatOptions,
      connectionFormatOptions,
      splitOptions,
      mentions,
      placeholderLimits,
      enablePlaceholderFallback,
      customPlaceholders,
    }: CreateDiscordWebhookConnectionPreviewInputDto
  ): Promise<CreateDiscordWebhookConnectionPreviewOutputDto> {
    const result = await this.service.createPreview({
      connection,
      userFeed: feed,
      feedFormatOptions: userFeedFormatOptions,
      connectionFormatOptions,
      articleId: article?.id,
      content,
      embeds,
      splitOptions,
      mentions,
      placeholderLimits,
      enablePlaceholderFallback,
      customPlaceholders,
    });

    return {
      result,
    };
  }

  @Patch("/discord-webhooks/:connectionId")
  @UseFilters(UpdateDiscordWebhookConnectionFilter)
  async updateDiscordWebhookConnection(
    @Param("feedId", GetUserFeedPipe(), GetFeedDiscordWebhookConnectionPipe)
    { feed, connection }: GetFeedDiscordWebhookConnectionPipeOutput,
    @Body(ValidationPipe)
    {
      content,
      embeds,
      filters,
      name,
      webhook,
      disabledCode,
      splitOptions,
      formatter,
      mentions,
      placeholderLimits,
      enablePlaceholderFallback,
      customPlaceholders,
      rateLimits,
      forumThreadTitle,
    }: UpdateDiscordWebhookConnectionInputDto,
    @DiscordAccessToken() { access_token }: SessionAccessToken
  ): Promise<UpdateDiscordWebhookConnectionOutputDto> {
    let useDisableCode: FeedConnectionDisabledCode | undefined | null =
      undefined;
    let useWebhook: UpdateDiscordWebhookConnectionInputDto["webhook"] = webhook;

    if (connection.disabledCode) {
      if (connection.disabledCode === FeedConnectionDisabledCode.BadFormat) {
        if (disabledCode === null) {
          throw new CannotEnableAutoDisabledConnection();
        }

        if (content || embeds) {
          useDisableCode = null;
        }
      } else if (
        connection.disabledCode === FeedConnectionDisabledCode.Manual
      ) {
        if (disabledCode === null) {
          useDisableCode = null;
        }
      } else if (
        connection.disabledCode ===
        FeedConnectionDisabledCode.MissingPermissions
      ) {
        if (disabledCode === null) {
          // Force re-validation of permissions
          useWebhook = webhook || connection.details.webhook;
          useDisableCode = null;
        }
      } else if (disabledCode === null) {
        throw new CannotEnableAutoDisabledConnection();
      }
    } else if (disabledCode === FeedConnectionDisabledCode.Manual) {
      useDisableCode = FeedConnectionDisabledCode.Manual;
    }

    const updatedConnection = await this.service.updateDiscordWebhookConnection(
      {
        accessToken: access_token,
        connectionId: connection.id.toHexString(),
        feedId: feed._id.toHexString(),
        feed,
        updates: {
          name,
          filters,
          disabledCode: useDisableCode,
          splitOptions,
          mentions,
          customPlaceholders,
          rateLimits,
          details: {
            formatter,
            content,
            forumThreadTitle,
            placeholderLimits,
            embeds: convertToFlatDiscordEmbeds(embeds),
            webhook: useWebhook
              ? {
                  id: useWebhook.id,
                  iconUrl: useWebhook.iconUrl,
                  name: useWebhook.name,
                }
              : undefined,
            enablePlaceholderFallback,
          },
        },
      }
    );

    return {
      id: updatedConnection.id.toHexString(),
      name: updatedConnection.name,
      key: FeedConnectionType.DiscordWebhook,
      filters: updatedConnection.filters,
      splitOptions: updatedConnection.splitOptions,
      details: {
        embeds: updatedConnection.details.embeds,
        content: updatedConnection.details.content,
        webhook: {
          id: updatedConnection.details.webhook.id,
          iconUrl: updatedConnection.details.webhook.iconUrl,
          name: updatedConnection.details.webhook.name,
          guildId: updatedConnection.details.webhook.guildId,
        },
      },
    };
  }

  @Delete("/discord-webhooks/:connectionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseFilters(DeleteDiscordWebhookConnectionFilter)
  async deleteDiscordWebhookConnection(
    @Param("feedId", GetUserFeedPipe(), GetFeedDiscordWebhookConnectionPipe)
    { feed, connection }: GetFeedDiscordWebhookConnectionPipeOutput
  ): Promise<void> {
    await this.service.deleteDiscordWebhookConnection({
      connectionId: connection.id.toHexString(),
      feedId: feed._id.toHexString(),
    });
  }
}
