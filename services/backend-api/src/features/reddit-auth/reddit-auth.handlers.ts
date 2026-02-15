import type { FastifyReply, FastifyRequest } from "fastify";
import { decrypt } from "../../shared/utils/decrypt";

interface CallbackQuery {
  code?: string;
  error?: string;
}

export async function loginHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { redditApiService } = request.container;
  const authorizationUrl = redditApiService.getAuthorizeUrl();

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
  const { code, error } = request.query;
  const { usersService, redditApiService } = request.container;
  const discordUserId = request.discordUserId;

  reply.header("Cache-Control", "no-store");

  if (error) {
    return reply.type("text/html").send(`<script>window.close();</script>`);
  }

  if (!code) {
    return reply.send("No code available");
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);

  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
  } = await redditApiService.getAccessToken(code);

  await usersService.setRedditCredentials({
    userId: user.id,
    accessToken,
    refreshToken,
    expiresIn,
  });

  await usersService.syncLookupKeys({ userIds: [user.id] });

  return reply.type("text/html").send(`
    <script>
      window.opener.postMessage('reddit', '*');
      window.close();
    </script>`);
}
