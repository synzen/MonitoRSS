import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { SessionAccessToken } from 'src/discord-auth/types/SessionAccessToken.type';

export const discordAccessTokenFactory = (
  data: unknown,
  ctx: ExecutionContext,
) => {
  const request = ctx.switchToHttp().getRequest() as FastifyRequest;

  const accessToken = request.session.get('accessToken') as
    | SessionAccessToken
    | undefined;

  if (!accessToken) {
    throw new UnauthorizedException();
  }

  return accessToken.access_token;
};

export const DiscordAccessToken = createParamDecorator(
  discordAccessTokenFactory,
);
