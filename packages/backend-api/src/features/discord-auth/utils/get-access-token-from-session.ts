import { FastifyRequest } from 'fastify';
import { SessionAccessToken } from '../types/SessionAccessToken.type';

export const getAccessTokenFromRequest = (
  request: FastifyRequest,
): SessionAccessToken | undefined => {
  return request.session.get('accessToken') as SessionAccessToken | undefined;
};
