import { Controller, Get, Header, Query, Res } from "@nestjs/common";
import { RedditApiService } from "../../services/apis/reddit/reddit-api.service";
import { FastifyReply } from "fastify";
import { ConfigService } from "@nestjs/config";
import { URL } from "node:url";
import { UsersService } from "../users/users.service";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";

@Controller("reddit")
export class RedditLoginController {
  constructor(
    private readonly redditApiService: RedditApiService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService
  ) {}

  @Get("login")
  @Header("Cache-Control", "no-store")
  async login(@Res() res: FastifyReply) {
    const authorizationUri = this.redditApiService.getAuthorizeUrl();

    res.redirect(303, authorizationUri);
  }

  @Get("callback")
  @Header("Cache-Control", "no-store")
  async callback(
    @Res() res: FastifyReply,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @Query("error") error?: string,
    @Query("code") code?: string
  ) {
    const { origin } = new URL(
      this.configService.getOrThrow<string>("BACKEND_API_LOGIN_REDIRECT_URI")
    );
    const redirect = `${origin}/settings`;

    if (error) {
      res.redirect(303, redirect);

      return;
    }

    if (!code) {
      res.send("No code available");

      return;
    }

    const user = await this.usersService.getOrCreateUserByDiscordId(
      discordUserId
    );
    const {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
    } = await this.redditApiService.getAccessToken(code);

    await this.usersService.setRedditCredentials({
      userId: user._id,
      accessToken,
      expiresIn,
      refreshToken,
    });

    await this.usersService.syncLookupKeys({ userIds: [user._id] });

    res.redirect(303, redirect);
  }
}
