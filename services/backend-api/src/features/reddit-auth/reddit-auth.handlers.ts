import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { decrypt } from "../../shared/utils/decrypt";
import logger from "../../infra/logger";

declare module "@fastify/secure-session" {
  interface SessionData {
    // Pending reddit OAuth attempt: the nonce is echoed back as the OAuth
    // `state` (CSRF protection); the optional workspaceId scopes the grant to a
    // workspace connection instead of the user's personal one. Kept server-side
    // so neither can be tampered with via the callback URL. returnTo is the
    // in-app path the callback redirects back to (the flow navigates the same
    // tab, so this is how the user lands where they started).
    redditAuthState: {
      nonce: string;
      workspaceId?: string;
      returnTo?: string;
    };
  }
}

interface LoginQuery {
  workspaceId?: string;
  returnTo?: string;
}

interface CallbackQuery {
  code?: string;
  error?: string;
  state?: string;
}

// Only in-app relative paths are safe to redirect to; anything else (absolute
// URLs, protocol-relative, backslash tricks) would turn the callback into an
// open redirector.
const getSafeReturnTo = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    value.length > 2048
  ) {
    return "/";
  }

  return value;
};

export async function loginHandler(
  request: FastifyRequest<{ Querystring: LoginQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { redditApiService } = request.container;
  const { workspaceId, returnTo } = request.query;

  const nonce = randomUUID();
  request.session.set("redditAuthState", {
    nonce,
    workspaceId,
    returnTo: getSafeReturnTo(returnTo),
  });

  const authorizationUrl = redditApiService.getAuthorizeUrl("read", nonce);

  reply.header("Cache-Control", "no-store");
  return reply.redirect(authorizationUrl, 303);
}

export async function removeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { usersService, redditApiService, config } = request.container;
  const discordUserId = request.discordUserId;

  const encryptionKey = config.BACKEND_API_ENCRYPTION_KEY_HEX;
  if (!encryptionKey) {
    throw new Error("Encryption key not found");
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);
  const redditCreds = await usersService.getRedditCredentials(user.id);

  if (!redditCreds?.data.refreshToken) {
    reply.header("Cache-Control", "no-store");
    return reply.status(204).send();
  }

  await redditApiService.revokeRefreshToken(
    decrypt(redditCreds.data.refreshToken, encryptionKey),
  );

  await usersService.removeRedditCredentials(user.id);

  await usersService.syncLookupKeys({ userIds: [user.id] });

  reply.header("Cache-Control", "no-store");
  return reply.status(204).send();
}

export async function callbackHandler(
  request: FastifyRequest<{ Querystring: CallbackQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { code, error, state } = request.query;
  const { usersService, workspacesService, redditApiService, config } =
    request.container;
  const discordUserId = request.discordUserId;

  reply.header("Cache-Control", "no-store");

  const pendingAuth = request.session.get("redditAuthState");
  request.session.set("redditAuthState", undefined);
  // returnTo is a validated relative path; the app origin comes from config because the
  // client and API can be served from different origins (vite dev server, e2e stack).
  const appUrl = config.BACKEND_API_LOGIN_REDIRECT_URI.replace(/\/+$/, "");
  const returnTo = `${appUrl}${getSafeReturnTo(pendingAuth?.returnTo)}`;

  if (error) {
    return reply.redirect(returnTo, 303);
  }

  if (!code) {
    return reply.redirect(returnTo, 303);
  }

  if (!pendingAuth || !state || state !== pendingAuth.nonce) {
    logger.warn("Reddit OAuth callback state mismatch, discarding grant", {
      discordUserId,
    });

    return reply.redirect(returnTo, 303);
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);

  // Membership is verified BEFORE the code is exchanged so a non-member's
  // grant is never minted, let alone stored.
  if (pendingAuth.workspaceId) {
    await workspacesService.getWorkspaceForMember(
      pendingAuth.workspaceId,
      user.id,
    );
  }

  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
  } = await redditApiService.getAccessToken(code);

  if (pendingAuth.workspaceId) {
    await workspacesService.setRedditCredentials({
      workspaceId: pendingAuth.workspaceId,
      connectedByUserId: user.id,
      accessToken,
      refreshToken,
      expiresIn,
    });
  } else {
    await usersService.setRedditCredentials({
      userId: user.id,
      accessToken,
      refreshToken,
      expiresIn,
    });

    await usersService.syncLookupKeys({ userIds: [user.id] });
  }

  return reply.redirect(returnTo, 303);
}
