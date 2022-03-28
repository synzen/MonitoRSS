import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { getAccessTokenFromRequest } from '../utils/get-access-token-from-session';

export const discordAccessTokenFactory = (
  data: unknown,
  ctx: ExecutionContext,
) => {
  const request = ctx.switchToHttp().getRequest() as FastifyRequest;

  const accessToken = getAccessTokenFromRequest(request);

  if (!accessToken) {
    throw new UnauthorizedException();
  }

  return accessToken;
};

export const DiscordAccessToken = createParamDecorator(
  discordAccessTokenFactory,
);
