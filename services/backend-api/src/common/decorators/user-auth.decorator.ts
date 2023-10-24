import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { getAccessTokenFromRequest } from "../../features/discord-auth/utils/get-access-token-from-session";
import { UserAuthDetails } from "../types";

export const userAuthFactory = (
  data: unknown,
  ctx: ExecutionContext
): UserAuthDetails => {
  const request = ctx.switchToHttp().getRequest() as FastifyRequest;

  const accessToken = getAccessTokenFromRequest(request);

  if (!accessToken) {
    throw new UnauthorizedException();
  }

  const email = accessToken.discord?.email;

  return { sessionAccessToken: accessToken, email };
};

export const UserAuth = createParamDecorator(userAuthFactory);
