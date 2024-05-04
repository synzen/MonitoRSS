import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { NestedQuery } from "../../common/decorators/NestedQuery";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";
import { TransformValidationPipe } from "../../common/pipes/TransformValidationPipe";
import { DiscordWebhooksService } from "./discord-webhooks.service";
import { GetDiscordWebhooksInputDto } from "./dto/get-discord-webhooks.input.dto";
import { GetDiscordWebhooksOutputDto } from "./dto/get-discord-webhooks.output.dto";
import { UserManagesWebhookServerGuard } from "./guards/UserManagesWebhookServer.guard";
import { HttpCacheInterceptor } from "../../common/interceptors/http-cache-interceptor";
import { WebhookExceptionFilter } from "./filters/webhook-exception.filter";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import { WebhookMissingPermissionsException } from "./exceptions";
import { CacheTTL } from "@nestjs/cache-manager";

@Controller("discord-webhooks")
@UseGuards(DiscordOAuth2Guard)
export class DiscordWebhooksController {
  constructor(
    private readonly discordWebhooksService: DiscordWebhooksService,
    private readonly discordAuthService: DiscordAuthService
  ) {}

  @Get()
  @UseGuards(UserManagesWebhookServerGuard)
  @UseInterceptors(HttpCacheInterceptor)
  @CacheTTL(60)
  @UseFilters(WebhookExceptionFilter)
  async getWebhooks(
    @NestedQuery(TransformValidationPipe)
    getWebhooksInputDto: GetDiscordWebhooksInputDto
  ): Promise<GetDiscordWebhooksOutputDto> {
    const serverId = getWebhooksInputDto.filters.serverId;
    const webhooks = await this.discordWebhooksService.getWebhooksOfServer(
      serverId
    );

    return GetDiscordWebhooksOutputDto.fromEntities(webhooks);
  }

  @Get(":id")
  @UseInterceptors(HttpCacheInterceptor)
  @CacheTTL(60)
  @UseFilters(WebhookExceptionFilter)
  async getWebhook(
    @Param("id")
    webhookId: string,
    @DiscordAccessToken()
    { access_token, discord: { id: discordUserId } }: SessionAccessToken
  ) {
    try {
      const webhook = await this.discordWebhooksService.getWebhook(webhookId);

      if (!webhook || !webhook?.guild_id) {
        throw new NotFoundException(
          `Webhook of guild ID of webhook ${webhookId} was not found`
        );
      }

      const managesGuild = await this.discordAuthService.userManagesGuild(
        access_token,
        webhook.guild_id
      );

      if (!managesGuild) {
        throw new NotFoundException(
          `User ${discordUserId} does not manage guild ${webhook.guild_id} of webhook ${webhookId}`
        );
      }

      return {
        result: {
          id: webhook.id,
          name: webhook.name,
          channelId: webhook.channel_id,
          avatarUrl: webhook.avatar || undefined,
        },
      };
    } catch (err) {
      if (
        err instanceof DiscordAPIError &&
        (err.statusCode === HttpStatus.FORBIDDEN ||
          err.statusCode === HttpStatus.UNAUTHORIZED)
      ) {
        throw new WebhookMissingPermissionsException(
          `Bot is missing permissions to retrieve webhook ${webhookId} (likely manage webhooks permission)`
        );
      }
    }
  }
}
