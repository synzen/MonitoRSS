import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import logger from "../../infra/logger";

declare module "@fastify/secure-session" {
  interface SessionData {
    // Pending reddit OAuth attempt: the nonce is echoed back as the OAuth
    // `state` (CSRF protection); the optional workspaceId scopes the grant to a
    // workspace connection instead of the user's personal one. Kept server-side
    // so neither can be tampered with via the callback URL.
    redditAuthState: {
      nonce: string;
      workspaceId?: string;
    };
  }
}

interface LoginQuery {
  workspaceId?: string;
}

interface CallbackQuery {
  code?: string;
  error?: string;
  state?: string;
}

const CLOSE_WINDOW_HTML = `<script>window.close();</script>`;

export async function loginHandler(
  request: FastifyRequest<{ Querystring: LoginQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { redditApiService } = request.container;
  const { workspaceId } = request.query;

  const nonce = randomUUID();
  request.session.set("redditAuthState", { nonce, workspaceId });

  const authorizationUrl = redditApiService.getAuthorizeUrl("read", nonce);

  reply.header("Cache-Control", "no-store");
  return reply.redirect(authorizationUrl, 303);
}

export async function removeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { usersService } = request.container;
  const discordUserId = request.discordUserId;

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);

  await usersService.disconnectReddit(user.id);

  reply.header("Cache-Control", "no-store");
  return reply.status(204).send();
}

export async function callbackHandler(
  request: FastifyRequest<{ Querystring: CallbackQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { code, error, state } = request.query;
  const { usersService, workspacesService, redditApiService } =
    request.container;
  const discordUserId = request.discordUserId;

  reply.header("Cache-Control", "no-store");

  const pendingAuth = request.session.get("redditAuthState");
  request.session.set("redditAuthState", undefined);

  if (error) {
    return reply.type("text/html").send(CLOSE_WINDOW_HTML);
  }

  if (!code) {
    return reply.send("No code available");
  }

  if (!pendingAuth || !state || state !== pendingAuth.nonce) {
    logger.warn("Reddit OAuth callback state mismatch, discarding grant", {
      discordUserId,
    });

    return reply.type("text/html").send(CLOSE_WINDOW_HTML);
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

  return reply.type("text/html").send(`
    <script>
      window.opener.postMessage('reddit', '*');
      window.close();
    </script>`);
}
