import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { DiscordAuthService } from "../discord-auth.service";
import { getAccessTokenFromRequest } from "../utils/get-access-token-from-session";

@Injectable()
export abstract class BaseUserManagesServerGuard implements CanActivate {
  constructor(protected readonly discordAuthService: DiscordAuthService) {}

  abstract getServerId(request: FastifyRequest): Promise<string | undefined>;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as FastifyRequest;

    const serverId = await this.getServerId(request);

    if (!serverId) {
      throw new Error(
        "Server ID is missing while validating if user manages server"
      );
    }

    const accessToken = this.getUserAccessToken(request);
    const { isManager, permissions } =
      await this.discordAuthService.userManagesGuild(accessToken, serverId);

    if (!isManager) {
      throw new ForbiddenException(
        !permissions
          ? undefined
          : `Permissions ${permissions} are insufficient.`
      );
    }

    return true;
  }

  private getUserAccessToken(request: FastifyRequest) {
    const accessToken = getAccessTokenFromRequest(request);

    if (!accessToken) {
      throw new UnauthorizedException();
    }

    return accessToken.access_token;
  }
}
