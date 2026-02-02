import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { SessionAccessToken } from "../../services/discord-auth/types";

interface CallbackQuery {
  code?: string;
  error?: string;
}

export async function callbackHandler(
  request: FastifyRequest<{ Querystring: CallbackQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { code, error } = request.query;
  const { discordAuthService, usersService, config } = request.container;

  if (error === "access_denied") {
    return reply.redirect("/", 301);
  }

  if (!code) {
    return reply.send("No code provided");
  }

  const { token } = await discordAuthService.createAccessToken(code);

  request.session.set("accessToken", token);

  await usersService.initDiscordUser(token.discord.id);

  return reply.redirect(config.BACKEND_API_LOGIN_REDIRECT_URI, 301);
}

export async function loginHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { discordAuthService } = request.container;
  const authorizationUrl = discordAuthService.getAuthorizationUrl();

  return reply.redirect(authorizationUrl, 301);
}

interface LoginV2Query {
  jsonState?: string;
  addScopes?: string;
}

export async function loginV2Handler(
  request: FastifyRequest<{ Querystring: LoginV2Query }>,
  reply: FastifyReply,
): Promise<void> {
  const { discordAuthService } = request.container;
  const { jsonState, addScopes } = request.query;

  const authStateId = randomUUID();
  const authState: { id: string; path?: string } = { id: authStateId };

  if (jsonState) {
    try {
      const json = JSON.parse(decodeURIComponent(jsonState));
      authState.path = json.path;
    } catch {
      return reply.status(400).send({ message: "Invalid jsonState format" });
    }
  }

  const authStateString = encodeURIComponent(JSON.stringify(authState));
  request.session.set("authState", authStateString);

  let scopes: string | undefined;
  if (addScopes?.trim()) {
    scopes = ` ${decodeURIComponent(addScopes.trim())}`;
  }

  const authorizationUrl = discordAuthService.getAuthorizationUrl({
    state: authStateString,
    additionalScopes: scopes,
  });

  reply.header("Cache-Control", "no-store");
  return reply.redirect(authorizationUrl, 303);
}

interface CallbackV2Query {
  code?: string;
  error?: string;
  state?: string;
}

export async function callbackV2Handler(
  request: FastifyRequest<{ Querystring: CallbackV2Query }>,
  reply: FastifyReply,
): Promise<void> {
  const { code, error, state } = request.query;
  const { discordAuthService, usersService, config } = request.container;

  if (error === "access_denied") {
    return reply.redirect("/", 303);
  }

  if (!code) {
    return reply.status(400).send("Invalid code");
  }

  const storedState = request.session.get("authState");
  const providedStateEncoded = encodeURIComponent(state || "");

  if (!providedStateEncoded || providedStateEncoded !== storedState) {
    return reply.status(400).send("Invalid state");
  }

  const { path }: { id: string; path?: string } = JSON.parse(
    decodeURIComponent(providedStateEncoded),
  );

  const { token, user } = await discordAuthService.createAccessToken(code);

  request.session.set("accessToken", token);

  await usersService.initDiscordUser(token.discord.id, {
    email: user.email,
  });

  reply.header("Cache-Control", "no-store");
  return reply.redirect(
    `${config.BACKEND_API_LOGIN_REDIRECT_URI}${path || ""}`,
    303,
  );
}

export async function logoutHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const accessToken = request.session.get("accessToken") as
    | SessionAccessToken
    | undefined;

  if (!accessToken) {
    return reply.status(401).send({ message: "Unauthorized" });
  }

  const { discordAuthService } = request.container;

  await discordAuthService.revokeToken(accessToken);
  request.session.delete();

  return reply.status(204).send();
}
