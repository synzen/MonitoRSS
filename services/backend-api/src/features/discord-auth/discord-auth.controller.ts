import {
  Controller,
  Get,
  Header,
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
import { UsersService } from "../users/users.service";
import { randomUUID } from "crypto";
import { Session as FastifySecureSession } from "@fastify/secure-session";

@Controller("discord")
export class DiscordAuthController {
  constructor(
    private readonly discordAuthService: DiscordAuthService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService
  ) {}

  @Get("login")
  login(@Res() res: FastifyReply) {
    const authorizationUri = this.discordAuthService.getAuthorizationUrl();

    res.redirect(authorizationUri, 301);
  }

  @Get("login-v2")
  // Caching is disable in case of email changes
  @Header("Cache-Control", "no-store")
  loginV2(
    @Res() res: FastifyReply,
    @Session() session: FastifySecureSession,
    @Query("jsonState") jsonState?: string,
    @Query("addScopes") addScopes?: string
  ) {
    const authStateId = randomUUID();

    const authState: { id: string; path?: string } = {
      id: authStateId,
    };

    if (jsonState) {
      const json = JSON.parse(decodeURIComponent(jsonState));
      authState.path = json.path;
    }

    const authStateString = encodeURIComponent(JSON.stringify(authState));

    // @ts-ignore
    session.set("authState", authStateString);

    let scopes = addScopes?.trim();

    if (scopes) {
      scopes = ` ${decodeURIComponent(scopes)}`;
    }

    const authorizationUri = this.discordAuthService.getAuthorizationUrl({
      state: authStateString,
      additionalScopes: scopes,
    });

    res.redirect(authorizationUri, 303);
  }

  @Get("callback")
  async discordCallback(
    @Res({ passthrough: true }) res: FastifyReply,
    @Session() session: FastifyRequest["session"],
    @Query("code") code?: string,
    @Query("error") error?: string
  ) {
    if (error === "access_denied") {
      return res.redirect("/", 301);
    }

    if (!code) {
      return "No code provided";
    }

    const { token } = await this.discordAuthService.createAccessToken(code);
    // @ts-ignore
    session.set("accessToken", token);

    const loginRedirectUri = this.configService.get<string>(
      "BACKEND_API_LOGIN_REDIRECT_URI"
    ) as string;

    await this.usersService.initDiscordUser(token.discord.id);

    return res.redirect(loginRedirectUri, 301);
  }

  @Get("callback-v2")
  // Caching is disable in case of email changes
  @Header("Cache-Control", "no-store")
  async discordCallbackV2(
    @Res({ passthrough: true }) res: FastifyReply,
    @Session() session: FastifyRequest["session"],
    @Query("code") code?: string,
    @Query("error") error?: string,
    @Query("state") state?: string
  ) {
    if (error === "access_denied") {
      return res.redirect("/", 303);
    }

    if (!code) {
      return res.status(400).send("Invalid code");
    }

    const storedState = session.get("authState");
    const providedStateEncoded = encodeURIComponent(state || "");

    if (!providedStateEncoded || providedStateEncoded !== storedState) {
      return res.status(400).send("Invalid state");
    }

    const {
      path,
    }: {
      id: string;
      path?: string;
    } = JSON.parse(decodeURIComponent(providedStateEncoded));

    const { token, user } = await this.discordAuthService.createAccessToken(
      code
    );
    // @ts-ignore
    session.set("accessToken", token);

    const loginRedirectUri = this.configService.get<string>(
      "BACKEND_API_LOGIN_REDIRECT_URI"
    ) as string;

    await this.usersService.initDiscordUser(token.discord.id, {
      email: user.email,
    });

    return res.redirect(`${loginRedirectUri}${path || ""}`, 303);
  }

  @Get("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @DiscordAccessToken() accessToken: SessionAccessToken,
    @Session() session: FastifyRequest["session"]
  ) {
    await this.discordAuthService.revokeToken(accessToken);
    await session.delete();
  }
}
