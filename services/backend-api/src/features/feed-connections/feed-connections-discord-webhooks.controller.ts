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
  CreateDiscordWebhookConnectionInputDto,
  CreateDiscordWebhookConnectionOutputDto,
} from "./dto";
import { FeedConnectionsDiscordWebhooksService } from "./feed-connections-discord-webhooks.service";
import { AddDiscordWebhookConnectionFilter } from "./filters";

@Controller("feeds/:feedId/connections")
@UseGuards(DiscordOAuth2Guard)
export class FeedConnectionsDiscordWebhooksController {
  constructor(
    private readonly service: FeedConnectionsDiscordWebhooksService
  ) {}
  @Post("/discord-webhooks")
  @UseFilters(AddDiscordWebhookConnectionFilter)
  async createDiscordWebhookConnection(
    @Param("feedId", GetFeedPipe) feed: DetailedFeed,
    @Body(ValidationPipe)
    { name, webhook }: CreateDiscordWebhookConnectionInputDto,
    @DiscordAccessToken() { access_token }: SessionAccessToken
  ): Promise<CreateDiscordWebhookConnectionOutputDto> {
    const createdConnection = await this.service.createDiscordWebhookConnection(
      {
        accessToken: access_token,
        feedId: feed._id.toHexString(),
        name,
        webhook: {
          id: webhook.id,
          iconUrl: webhook.iconUrl,
          name: webhook.name,
        },
        guildId: feed.guild,
      }
    );

    return {
      id: createdConnection.id.toHexString(),
      name: createdConnection.name,
      key: FeedConnectionType.DiscordWebhook,
      filters: createdConnection.filters,
      details: {
        embeds: createdConnection.details.embeds,
        content: createdConnection.details.content,
        webhook: {
          id: createdConnection.details.webhook.id,
          iconUrl: createdConnection.details.webhook.iconUrl,
          name: createdConnection.details.webhook.name,
        },
      },
    };
  }
}
