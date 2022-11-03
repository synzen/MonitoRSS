import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  Session,
} from "@nestjs/common";
import { DiscordAuthService } from "./discord-auth.service";
import { FastifyReply, FastifyRequest } from "fastify";
import { DiscordAccessToken } from "./decorators/DiscordAccessToken";
import { SessionAccessToken } from "./types/SessionAccessToken.type";
import { ConfigService } from "@nestjs/config";

@Controller("discord")
export class DiscordAuthController {
  constructor(
    private readonly discordAuthService: DiscordAuthService,
    private readonly configService: ConfigService
  ) {}

  @Get("login")
  login(@Res() res: FastifyReply) {
    const authorizationUri = this.discordAuthService.getAuthorizationUrl();

    res.redirect(301, authorizationUri);
  }

  @Get("callback")
  async discordCallback(
    @Res({ passthrough: true }) res: FastifyReply,
    @Session() session: FastifyRequest["session"],
    @Query("code") code?: string,
    @Query("error") error?: string
  ) {
    if (error === "access_denied") {
      return res.redirect(301, "/");
    }

    if (!code) {
      return "No code provided";
    }

    const accessToken = await this.discordAuthService.createAccessToken(code);
    session.set("accessToken", accessToken);

    const loginRedirectUri = this.configService.get<string>(
      "LOGIN_REDIRECT_URI"
    ) as string;

    return res.redirect(301, loginRedirectUri);
  }

  @Get("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @DiscordAccessToken() accessToken: SessionAccessToken,
    @Session() session: FastifyRequest["session"]
  ) {
    await this.discordAuthService.revokeToken(accessToken);
    await session.destroy();
  }
}
