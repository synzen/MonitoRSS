import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Query,
  Res,
} from "@nestjs/common";
import { RedditApiService } from "../../services/apis/reddit/reddit-api.service";
import { FastifyReply } from "fastify";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../users/users.service";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import decrypt from "../../utils/decrypt";

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

    res.redirect(authorizationUri, 303);
  }

  @Get("remove")
  @Header("Cache-Control", "no-store")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ) {
    const encryptionKey = this.configService.get(
      "BACKEND_API_ENCRYPTION_KEY_HEX"
    );

    if (!encryptionKey) {
      throw new Error("Encryption key not found");
    }

    const user = await this.usersService.getOrCreateUserByDiscordId(
      discordUserId
    );

    const redditCreds = await this.usersService.getRedditCredentials(user._id);

    if (!redditCreds?.data.refreshToken) {
      return;
    }

    await this.redditApiService.revokeRefreshToken(
      decrypt(redditCreds.data.refreshToken, encryptionKey)
    );

    await this.usersService.removeRedditCredentials(user._id);

    await this.usersService.syncLookupKeys({ userIds: [user._id] });
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
    if (error) {
      res.type("text/html").send(`<script>window.close();</script>`);

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

    res.type("text/html").send(`
      <script>
        window.opener.postMessage('reddit', '*');
        window.close();
      </script>`);
  }
}
