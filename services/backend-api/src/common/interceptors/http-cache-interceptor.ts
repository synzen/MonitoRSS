/* eslint-disable max-len */
import { ExecutionContext, Injectable } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { getAccessTokenFromRequest } from "../../features/discord-auth/utils/get-access-token-from-session";
import { CacheInterceptor } from "@nestjs/cache-manager";

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest() as FastifyRequest;

    const accessToken = getAccessTokenFromRequest(request);

    if (!accessToken) {
      return request.url;
    }

    const accessTokenString = accessToken.access_token;

    return accessTokenString + request.url;
  }
}
