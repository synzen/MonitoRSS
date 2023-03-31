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
import { UserFeed } from "../user-feeds/entities";
import { GetUserFeedPipe } from "../user-feeds/pipes";
import {
  CreateDiscordChannelConnectionOutputDto,
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
    @Param("feedId", GetUserFeedPipe) feed: UserFeed,
    @Body(ValidationPipe)
    { channelId, name }: CreateDiscordChnnnelConnectionInputDto,
    @DiscordAccessToken() { access_token }: SessionAccessToken
  ): Promise<CreateDiscordChannelConnectionOutputDto> {
    const createdConnection = await this.service.createDiscordChannelConnection(
      {
        feedId: feed._id.toHexString(),
        name,
        channelId,
        userAccessToken: access_token,
      }
    );

    return {
      id: createdConnection.id.toHexString(),
      name: createdConnection.name,
      key: FeedConnectionType.DiscordChannel,
      filters: createdConnection.filters,
      details: {
        channel: {
          id: createdConnection.details.channel.id,
          guildId: createdConnection.details.channel.guildId,
        },
        embeds: createdConnection.details.embeds,
        content: createdConnection.details.content,
      },
      splitOptions: createdConnection.splitOptions,
    };
  }

  @Post("/discord-channels/:connectionId/test")
  @UseFilters(CreateDiscordChannelTestArticleFilter)
  async sendTestArticle(
    @Param("feedId", GetUserFeedPipe, GetFeedDiscordChannelConnectionPipe)
    { feed, connection }: GetFeedDiscordChannelConnectionPipeOutput,
    @Body(ValidationPipe)
    { article }: CreateDiscordChannelConnectionTestArticleInputDto
  ): Promise<CreateDiscordChannelConnectionTestArticleOutputDto> {
    const result = await this.service.sendTestArticle(feed, connection, {
      article,
    });

    return {
      result: {
        status: result.status,
        apiPayload: result.apiPayload,
        apiResponse: result.apiResponse,
      },
    };
  }

  @Patch("/discord-channels/:connectionId")
  @UseFilters(UpdateDiscordChannelConnectionFilter)
  async updateDiscordChannelConnection(
    @Param("feedId", GetUserFeedPipe, GetFeedDiscordChannelConnectionPipe)
    { feed, connection }: GetFeedDiscordChannelConnectionPipeOutput,
    @Body(ValidationPipe)
    {
      channelId,
      name,
      content,
      embeds,
      filters,
      disabledCode,
      splitOptions,
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
        if (disabledCode === null) {
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
        updates: {
          filters,
          name,
          disabledCode: useDisableCode,
          splitOptions,
          details: {
            channel: useChannelId
              ? {
                  id: useChannelId,
                }
              : undefined,
            embeds: convertToFlatDiscordEmbeds(embeds),
            content,
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
        channel: {
          id: createdConnection.details.channel.id,
          guildId: createdConnection.details.channel.guildId,
        },
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
    @Param("feedId", GetUserFeedPipe, GetFeedDiscordChannelConnectionPipe)
    { feed, connection }: GetFeedDiscordChannelConnectionPipeOutput
  ): Promise<void> {
    await this.service.deleteConnection(
      feed._id.toHexString(),
      connection.id.toHexString()
    );
  }
}
