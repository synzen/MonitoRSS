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
  CreateDiscordWebhookConnectionInputDto,
  CreateDiscordWebhookConnectionOutputDto,
  CreateDiscordWebhookConnectionTestArticleOutputDto,
  UpdateDiscordWebhookConnectionInputDto,
  UpdateDiscordWebhookConnectionOutputDto,
} from "./dto";
import { FeedConnectionsDiscordWebhooksService } from "./feed-connections-discord-webhooks.service";
import {
  AddDiscordWebhookConnectionFilter,
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

  @Post("/discord-webhooks")
  @UseFilters(AddDiscordWebhookConnectionFilter)
  async createDiscordWebhookConnection(
    @Param("feedId", GetUserFeedPipe) feed: UserFeed,
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
          guildId: createdConnection.details.webhook.guildId,
        },
      },
    };
  }

  @Post("/discord-webhooks/:connectionId/test")
  @UseFilters(CreateDiscordWebhookTestArticleFilter)
  async sendTestArticle(
    @Param("feedId", GetUserFeedPipe, GetFeedDiscordWebhookConnectionPipe)
    { feed, connection }: GetFeedDiscordWebhookConnectionPipeOutput
  ): Promise<CreateDiscordWebhookConnectionTestArticleOutputDto> {
    const result = await this.service.sendTestArticle(feed, connection);

    return {
      result,
    };
  }

  @Patch("/discord-webhooks/:connectionId")
  @UseFilters(UpdateDiscordWebhookConnectionFilter)
  async updateDiscordWebhookConnection(
    @Param("feedId", GetUserFeedPipe, GetFeedDiscordWebhookConnectionPipe)
    { feed, connection }: GetFeedDiscordWebhookConnectionPipeOutput,
    @Body(ValidationPipe)
    {
      content,
      embeds,
      filters,
      name,
      webhook,
      disabledCode,
    }: UpdateDiscordWebhookConnectionInputDto,
    @DiscordAccessToken() { access_token }: SessionAccessToken
  ): Promise<UpdateDiscordWebhookConnectionOutputDto> {
    let useDisableCode: FeedConnectionDisabledCode | undefined | null =
      disabledCode;

    if (
      disabledCode === null &&
      connection.disabledCode !== FeedConnectionDisabledCode.Manual
    ) {
      throw new CannotEnableAutoDisabledConnection();
    }

    if (connection.disabledCode === FeedConnectionDisabledCode.BadFormat) {
      if (content || embeds) {
        useDisableCode = null;
      }
    }

    const updatedConnection = await this.service.updateDiscordWebhookConnection(
      {
        accessToken: access_token,
        connectionId: connection.id.toHexString(),
        feedId: feed._id.toHexString(),
        updates: {
          name,
          filters,
          disabledCode: useDisableCode,
          details: {
            content,
            embeds: convertToFlatDiscordEmbeds(embeds),
            webhook: webhook
              ? {
                  id: webhook.id,
                  iconUrl: webhook.iconUrl,
                  name: webhook.name,
                }
              : undefined,
          },
        },
      }
    );

    return {
      id: updatedConnection.id.toHexString(),
      name: updatedConnection.name,
      key: FeedConnectionType.DiscordWebhook,
      filters: updatedConnection.filters,
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
    @Param("feedId", GetUserFeedPipe, GetFeedDiscordWebhookConnectionPipe)
    { feed, connection }: GetFeedDiscordWebhookConnectionPipeOutput
  ): Promise<void> {
    await this.service.deleteDiscordWebhookConnection({
      connectionId: connection.id.toHexString(),
      feedId: feed._id.toHexString(),
    });
  }
}
