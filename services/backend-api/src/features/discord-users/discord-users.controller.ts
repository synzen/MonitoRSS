import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Req,
  Session,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyRequest } from "fastify";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";
import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import { getAccessTokenFromRequest } from "../discord-auth/utils/get-access-token-from-session";
import { DiscordUsersService } from "./discord-users.service";
import { GetMeAuthStatusOutputDto, GetUserOutputDto } from "./dto";
import { GetBotOutputDto } from "./dto/GetBotOutput.dto";

@Controller("discord-users")
export class DiscordUsersController {
  constructor(
    private readonly discordUsersService: DiscordUsersService,
    private readonly configService: ConfigService,
    private readonly discordAuthService: DiscordAuthService
  ) {}

  @Get("/:id")
  @UseGuards(DiscordOAuth2Guard)
  async getUser(@Param("id") id: string): Promise<GetUserOutputDto> {
    const user = await this.discordUsersService.getUserById(id);

    return {
      result: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatar,
      },
    };
  }

  @Get("bot")
  @UseGuards(DiscordOAuth2Guard)
  async getBot(): Promise<GetBotOutputDto> {
    const botClientId = this.configService.getOrThrow<string>(
      "BACKEND_API_DISCORD_CLIENT_ID"
    );
    const bot = await this.discordUsersService.getBot();

    const inviteLink = `https://discord.com/oauth2/authorize?client_id=${botClientId}&scope=bot&permissions=19456`;

    return GetBotOutputDto.fromEntity(bot, inviteLink);
  }

  @Get("@me")
  @UseGuards(DiscordOAuth2Guard)
  async getMe(@DiscordAccessToken() accessToken: SessionAccessToken) {
    const user = await this.discordUsersService.getUser(
      accessToken.access_token
    );

    return {
      id: user.id,
      username: user.username,
      iconUrl: user.avatarUrl,
      supporter: user.supporter,
      maxFeeds: user.maxFeeds,
      maxUserFeeds: user.maxUserFeeds,
      maxUserFeedsComposition: user.maxUserFeedsComposition,
      allowCustomPlaceholders: user.allowCustomPlaceholders,
    };
  }

  @Get("@me/auth-status")
  async getAuthStatus(
    @Req() request: FastifyRequest,
    @Session() session: FastifyRequest["session"]
  ): Promise<GetMeAuthStatusOutputDto> {
    const accessToken = getAccessTokenFromRequest(request);

    if (!accessToken) {
      return {
        authenticated: false,
      };
    }

    try {
      await this.discordUsersService.getUser(accessToken.access_token);

      return {
        authenticated: true,
      };
    } catch (err) {
      if (
        err instanceof DiscordAPIError &&
        (err.statusCode === HttpStatus.FORBIDDEN ||
          err.statusCode === HttpStatus.UNAUTHORIZED)
      ) {
        // Access token has likely expired on Discord's end
        await session.delete();

        return {
          authenticated: false,
        };
      }

      throw err;
    }
  }
}
