import {
  Body,
  Controller,
  Param,
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
} from "./dto";
import { FeedConnectionsService } from "./feed-connections.service";
import { AddDiscordChannelConnectionFilter } from "./filters";

@Controller("feeds/:feedId/connections")
@UseGuards(DiscordOAuth2Guard)
export class FeedsConnectionsController {
  constructor(
    private readonly feedConnectionsService: FeedConnectionsService
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
    const createdConnection =
      await this.feedConnectionsService.createDiscordChannelConnection({
        feedId: feed._id.toHexString(),
        name,
        channelId,
        userAccessToken: access_token,
      });

    return {
      id: createdConnection.id.toHexString(),
      name: createdConnection.name,
      key: FeedConnectionType.DiscordChannel,
      details: {
        channel: {
          id: createdConnection.details.channel.id,
        },
        embeds: createdConnection.details.embeds,
        type: FeedConnectionType.DiscordChannel,
        content: createdConnection.details.content,
      },
    };
  }
}
