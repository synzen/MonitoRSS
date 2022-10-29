import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";
import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import { FeedConnectionType } from "../feeds/constants";
import { GetFeedPipe } from "../feeds/pipes/GetFeed.pipe";
import { DetailedFeed } from "../feeds/types/detailed-feed.type";
import {
  CreateDiscordChannelConnectionOutputDto,
  CreateDiscordChnnnelConnectionInputDto,
  UpdateDiscordChannelConnectionInputDto,
  UpdateDiscordChannelConnectionOutputDto,
} from "./dto";
import { FeedConnectionsDiscordChannelsService } from "./feed-connections-discord-channels.service";
import {
  AddDiscordChannelConnectionFilter,
  UpdateDiscordChannelConnectionFilter,
} from "./filters";
import {
  GetFeedDiscordChannelConnectionPipe,
  GetFeedDiscordChannelConnectionPipeOutput,
} from "./pipes";

@Controller("feeds/:feedId/connections")
@UseGuards(DiscordOAuth2Guard)
export class FeedConnectionsDiscordChannelsController {
  constructor(
    private readonly service: FeedConnectionsDiscordChannelsService
  ) {}

  // TODO: Make sure user owns feed
  @Post("/discord-channels")
  @UseFilters(AddDiscordChannelConnectionFilter)
  async createDiscordChannelConnection(
    @Param("feedId", GetFeedPipe) feed: DetailedFeed,
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
        guildId: feed.guild,
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
        },
        embeds: createdConnection.details.embeds,
        content: createdConnection.details.content,
      },
    };
  }

  @Patch("/discord-channels/:connectionId")
  @UseFilters(UpdateDiscordChannelConnectionFilter)
  async updateDiscordChannelConnection(
    @Param("feedId", GetFeedPipe, GetFeedDiscordChannelConnectionPipe)
    { feed, connection }: GetFeedDiscordChannelConnectionPipeOutput,
    @Body(ValidationPipe)
    {
      channelId,
      name,
      content,
      embeds,
      filters,
    }: UpdateDiscordChannelConnectionInputDto,
    @DiscordAccessToken() { access_token }: SessionAccessToken
  ): Promise<UpdateDiscordChannelConnectionOutputDto> {
    const createdConnection = await this.service.updateDiscordChannelConnection(
      feed._id.toHexString(),
      connection.id.toHexString(),
      {
        accessToken: access_token,
        guildId: feed.guild,
        updates: {
          filters,
          name,
          details: {
            channel: channelId
              ? {
                  id: channelId,
                }
              : undefined,
            embeds,
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
        },
        embeds: createdConnection.details.embeds,
        content: createdConnection.details.content,
      },
    };
  }
}
