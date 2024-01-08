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
import { UserFeedManagerType } from "../user-feed-management-invites/constants";
import { GetUserFeedsPipe, GetUserFeedsPipeOutput } from "../user-feeds/pipes";
import {
  CreateDiscordChannelConnectionCloneInputDto,
  CreateDiscordChannelConnectionCopyConnectionSettingsInputDto,
  CreateDiscordChannelConnectionOutputDto,
  CreateDiscordChannelConnectionPreviewInputDto,
  CreateDiscordChannelConnectionPreviewOutputDto,
  CreateDiscordChannelConnectionTestArticleInputDto,
  CreateDiscordChannelConnectionTestArticleOutputDto,
  CreateDiscordChnnnelConnectionInputDto,
  UpdateDiscordChannelConnectionInputDto,
  UpdateDiscordChannelConnectionOutputDto,
} from "./dto";
import { FeedConnectionsDiscordChannelsService } from "./feed-connections-discord-channels.service";
import {
  AddDiscordChannelConnectionFilter,
  CreateDiscordChannelTestArticleFilter,
  DeleteDiscordChannelConnectionFilter,
  UpdateDiscordChannelConnectionFilter,
} from "./filters";
import {
  GetFeedDiscordChannelConnectionPipe,
  GetFeedDiscordChannelConnectionPipeOutput,
} from "./pipes";

@Controller("user-feeds/:feedId/connections")
@UseGuards(DiscordOAuth2Guard)
export class FeedConnectionsDiscordChannelsController {
  constructor(
    private readonly service: FeedConnectionsDiscordChannelsService
  ) {}

  @Post("/discord-channels")
  @UseFilters(AddDiscordChannelConnectionFilter)
  async createDiscordChannelConnection(
    @Param(
      "feedId",
      GetUserFeedsPipe({
        userTypes: [
          UserFeedManagerType.Creator,
          UserFeedManagerType.SharedManager,
        ],
      })
    )
    [{ feed }]: GetUserFeedsPipeOutput,
    @Body(ValidationPipe)
    {
      channelId,
      name,
      webhook,
      applicationWebhook,
    }: CreateDiscordChnnnelConnectionInputDto,
    @DiscordAccessToken()
    { access_token, discord: { id: discordUserId } }: SessionAccessToken
  ): Promise<CreateDiscordChannelConnectionOutputDto> {
    const createdConnection = await this.service.createDiscordChannelConnection(
      {
        feed,
        name,
        channelId,
        userAccessToken: access_token,
        webhook,
        applicationWebhook,
        userDiscordUserId: discordUserId,
      }
    );

    return {
      id: createdConnection.id.toHexString(),
      name: createdConnection.name,
      key: FeedConnectionType.DiscordChannel,
      filters: createdConnection.filters,
      details: {
        channel: createdConnection.details.channel
          ? {
              id: createdConnection.details.channel.id,
              guildId: createdConnection.details.channel.guildId,
            }
          : undefined,
        webhook: createdConnection.details.webhook
          ? {
              id: createdConnection.details.webhook.id,
              guildId: createdConnection.details.webhook.guildId,
            }
          : undefined,
        embeds: createdConnection.details.embeds,
        content: createdConnection.details.content,
      },
      splitOptions: createdConnection.splitOptions,
    };
  }

  @Post("/discord-channels/:connectionId/test")
  @UseFilters(CreateDiscordChannelTestArticleFilter)
  async sendTestArticle(
    @Param(
      "feedId",
      GetUserFeedsPipe({
        userTypes: [
          UserFeedManagerType.Creator,
          UserFeedManagerType.SharedManager,
        ],
      }),
      GetFeedDiscordChannelConnectionPipe
    )
    [{ feed, connection }]: GetFeedDiscordChannelConnectionPipeOutput[],
    @Body(ValidationPipe)
    data: CreateDiscordChannelConnectionTestArticleInputDto
  ): Promise<CreateDiscordChannelConnectionTestArticleOutputDto> {
    const result = await this.service.sendTestArticle(feed, connection, {
      article: data.article,
      previewInput: {
        ...data,
        userFeed: feed,
        connection,
        feedFormatOptions: data.userFeedFormatOptions,
      },
    });

    return {
      result: {
        status: result.status,
        apiPayload: result.apiPayload,
        apiResponse: result.apiResponse,
      },
    };
  }

  @Post("/discord-channels/:connectionId/copy-connection-settings")
  @HttpCode(HttpStatus.NO_CONTENT)
  async copyConnectionSettings(
    @Param(
      "feedId",
      GetUserFeedsPipe({
        userTypes: [
          UserFeedManagerType.Creator,
          UserFeedManagerType.SharedManager,
        ],
      }),
      GetFeedDiscordChannelConnectionPipe
    )
    [{ feed, connection }]: GetFeedDiscordChannelConnectionPipeOutput[],
    @Body(ValidationPipe)
    {
      properties,
      targetDiscordChannelConnectionIds,
    }: CreateDiscordChannelConnectionCopyConnectionSettingsInputDto
  ) {
    await this.service.copySettings(feed, connection, {
      properties,
      targetDiscordChannelConnectionIds,
    });
  }

  @Post("/discord-channels/:connectionId/clone")
  async clone(
    @Param(
      "feedId",
      GetUserFeedsPipe({
        userTypes: [
          UserFeedManagerType.Creator,
          UserFeedManagerType.SharedManager,
        ],
      }),
      GetFeedDiscordChannelConnectionPipe
    )
    [{ feed, connection }]: GetFeedDiscordChannelConnectionPipeOutput[],
    @Body(ValidationPipe)
    data: CreateDiscordChannelConnectionCloneInputDto,
    @DiscordAccessToken()
    { access_token, discord: { id: discordUserId } }: SessionAccessToken
  ) {
    const result = await this.service.cloneConnection(
      feed,
      connection,
      data,
      access_token,
      discordUserId
    );

    return {
      result,
    };
  }

  @Post("/discord-channels/:connectionId/preview")
  @UseFilters(CreateDiscordChannelTestArticleFilter)
  async createPreview(
    @Param(
      "feedId",
      GetUserFeedsPipe({
        userTypes: [
          UserFeedManagerType.Creator,
          UserFeedManagerType.SharedManager,
        ],
      }),
      GetFeedDiscordChannelConnectionPipe
    )
    [{ feed, connection }]: GetFeedDiscordChannelConnectionPipeOutput[],
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
      componentRows,
    }: CreateDiscordChannelConnectionPreviewInputDto
  ): Promise<CreateDiscordChannelConnectionPreviewOutputDto> {
    const result = await this.service.createPreview({
      connection,
      userFeed: feed,
      feedFormatOptions: { ...feed.formatOptions, ...userFeedFormatOptions },
      connectionFormatOptions,
      articleId: article?.id,
      content,
      embeds,
      splitOptions,
      mentions,
      placeholderLimits,
      enablePlaceholderFallback,
      customPlaceholders,
      componentRows,
    });

    return {
      result: {
        status: result.status,
        messages: result.messages,
      },
    };
  }

  @Patch("/discord-channels/:connectionId")
  @UseFilters(UpdateDiscordChannelConnectionFilter)
  async updateDiscordChannelConnection(
    @Param("feedId", GetUserFeedsPipe(), GetFeedDiscordChannelConnectionPipe)
    [{ feed, connection }]: GetFeedDiscordChannelConnectionPipeOutput[],
    @Body(ValidationPipe)
    {
      channelId,
      webhook,
      name,
      content,
      embeds,
      filters,
      disabledCode,
      splitOptions,
      formatter,
      forumThreadTitle,
      forumThreadTags,
      mentions,
      placeholderLimits,
      enablePlaceholderFallback,
      customPlaceholders,
      rateLimits,
      componentRows,
      applicationWebhook,
    }: UpdateDiscordChannelConnectionInputDto,
    @DiscordAccessToken() { access_token }: SessionAccessToken
  ): Promise<UpdateDiscordChannelConnectionOutputDto> {
    let useDisableCode: FeedConnectionDisabledCode | undefined | null =
      undefined;
    let useChannelId: string | undefined = channelId;

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
        if (disabledCode === null && connection.details.channel) {
          // Force re-validation of channel permissions
          useChannelId = channelId || connection.details.channel.id;
          useDisableCode = null;
        }
      } else if (disabledCode === null) {
        throw new CannotEnableAutoDisabledConnection();
      }
    } else if (disabledCode === FeedConnectionDisabledCode.Manual) {
      useDisableCode = FeedConnectionDisabledCode.Manual;
    }

    const createdConnection = await this.service.updateDiscordChannelConnection(
      feed._id.toHexString(),
      connection.id.toHexString(),
      {
        accessToken: access_token,
        feed,
        oldConnection: connection,
        updates: {
          filters,
          name,
          disabledCode: useDisableCode,
          splitOptions,
          mentions,
          customPlaceholders,
          rateLimits,
          details: {
            placeholderLimits,
            componentRows,
            channel: useChannelId
              ? {
                  id: useChannelId,
                }
              : undefined,
            webhook: useChannelId ? undefined : webhook,
            applicationWebhook: useChannelId ? undefined : applicationWebhook,
            embeds: convertToFlatDiscordEmbeds(embeds),
            content,
            formatter,
            forumThreadTitle,
            forumThreadTags,
            enablePlaceholderFallback,
          },
        },
      }
    );

    return {
      id: createdConnection.id.toHexString(),
      name: createdConnection.name,
      key: FeedConnectionType.DiscordChannel,
      filters: createdConnection.filters,
      details: {
        channel: createdConnection.details.channel
          ? {
              id: createdConnection.details.channel.id,
              guildId: createdConnection.details.channel.guildId,
            }
          : undefined,
        webhook: createdConnection.details.webhook
          ? {
              id: createdConnection.details.webhook.id,
              guildId: createdConnection.details.webhook.guildId,
            }
          : undefined,
        embeds: createdConnection.details.embeds,
        content: createdConnection.details.content,
      },
      splitOptions: createdConnection.splitOptions,
    };
  }

  @Delete("/discord-channels/:connectionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseFilters(DeleteDiscordChannelConnectionFilter)
  async deleteDiscordChannelConnection(
    @Param("feedId", GetUserFeedsPipe(), GetFeedDiscordChannelConnectionPipe)
    [{ feed, connection }]: GetFeedDiscordChannelConnectionPipeOutput[]
  ): Promise<void> {
    await this.service.deleteConnection(
      feed._id.toHexString(),
      connection.id.toHexString()
    );
  }
}
