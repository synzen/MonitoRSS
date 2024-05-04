import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { DiscordAuthService } from "../discord-auth.service";
import { SessionAccessToken } from "../types/SessionAccessToken.type";

@Injectable()
export class DiscordOAuth2Guard implements CanActivate {
  constructor(private readonly discordAuthService: DiscordAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as FastifyRequest;

    let token = request.session.get("accessToken") as
      | SessionAccessToken
      | undefined;

    if (!token) {
      throw new UnauthorizedException();
    }

    if (this.discordAuthService.isTokenExpired(token)) {
      token = await this.discordAuthService.refreshToken(token);
      // @ts-ignore
      request.session.set("accessToken", token);
    }

    return true;
  }
}
