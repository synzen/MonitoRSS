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
  CreateTemplatePreviewInputDto,
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
import { UserFeedTargetFeedSelectionType } from "../user-feeds/constants/target-feed-selection-type.type";

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
      threadCreationMethod,
      content,
      embeds,
      componentsV2,
      placeholderLimits,
      formatter,
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
        threadCreationMethod,
        templateData: {
          content,
          embeds,
          componentsV2,
          placeholderLimits,
          formatter: formatter || undefined,
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
      result,
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
  @UseFilters(AddDiscordChannelConnectionFilter)
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
    [{ connection }]: GetFeedDiscordChannelConnectionPipeOutput[],
    @Body(ValidationPipe)
    data: CreateDiscordChannelConnectionCloneInputDto,
    @DiscordAccessToken()
    { access_token, discord: { id: discordUserId } }: SessionAccessToken
  ) {
    const result = await this.service.cloneConnection(
      connection,
      {
        ...data,
        targetFeedSelectionType:
          data.targetFeedSelectionType || UserFeedTargetFeedSelectionType.All,
      },
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
      externalProperties,
      includeCustomPlaceholderPreviews,
      channelNewThreadTitle,
      channelNewThreadExcludesPreview,
      componentsV2,
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
      includeCustomPlaceholderPreviews,
      externalProperties,
      channelNewThreadTitle,
      channelNewThreadExcludesPreview,
      componentsV2,
    });

    return {
      result: {
        status: result.status,
        messages: result.messages,
        customPlaceholderPreviews: result.customPlaceholderPreviews,
      },
    };
  }

  @Post("/template-preview")
  @UseFilters(CreateDiscordChannelTestArticleFilter)
  async createTemplatePreview(
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
      article,
      content,
      embeds,
      userFeedFormatOptions,
      connectionFormatOptions,
      placeholderLimits,
      enablePlaceholderFallback,
      componentsV2,
    }: CreateTemplatePreviewInputDto
  ): Promise<CreateDiscordChannelConnectionPreviewOutputDto> {
    const result = await this.service.createTemplatePreview({
      userFeed: feed,
      feedFormatOptions: { ...feed.formatOptions, ...userFeedFormatOptions },
      connectionFormatOptions,
      articleId: article?.id,
      content,
      embeds,
      placeholderLimits,
      enablePlaceholderFallback,
      componentsV2,
    });

    return {
      result: {
        status: result.status,
        messages: result.messages,
        customPlaceholderPreviews: result.customPlaceholderPreviews,
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
      componentsV2,
      applicationWebhook,
      channelNewThreadTitle,
      threadCreationMethod,
      channelNewThreadExcludesPreview,
    }: UpdateDiscordChannelConnectionInputDto,
    @DiscordAccessToken() { access_token }: SessionAccessToken
  ): Promise<UpdateDiscordChannelConnectionOutputDto> {
    let useDisableCode: FeedConnectionDisabledCode | undefined | null =
      undefined;
    let useChannelId: string | undefined = channelId;
    let useApplicationWebhook:
      | UpdateDiscordChannelConnectionInputDto["applicationWebhook"]
      | undefined = undefined;

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
          // Force re-validation of channel permissions
          if (connection.details.channel) {
            useChannelId = channelId || connection.details.channel.id;
            useDisableCode = null;
          } else if (
            connection.details.webhook?.channelId &&
            connection.details.webhook.name
          ) {
            useApplicationWebhook = {
              channelId: connection.details.webhook?.channelId,
              name: connection.details.webhook?.name,
              iconUrl: connection.details.webhook?.iconUrl,
              threadId: connection.details.webhook?.threadId,
            };
            useDisableCode = null;
          } else {
            throw new Error(
              `Unhandled case when attempting to enable connection due to missing permissions`
            );
          }
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
          threadCreationMethod,
          disabledCode: useDisableCode,
          splitOptions,
          mentions,
          customPlaceholders,
          rateLimits,
          details: {
            placeholderLimits,
            channelNewThreadTitle,
            channelNewThreadExcludesPreview,
            componentRows,
            componentsV2,
            channel:
              !useApplicationWebhook && useChannelId
                ? {
                    id: useChannelId,
                  }
                : undefined,
            webhook:
              useApplicationWebhook || useChannelId ? undefined : webhook,
            applicationWebhook:
              useApplicationWebhook ||
              (useChannelId ? undefined : applicationWebhook),
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
