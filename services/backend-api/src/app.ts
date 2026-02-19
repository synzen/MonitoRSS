import Fastify, { type FastifyInstance } from "fastify";
import fastifySession from "@fastify/secure-session";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import compression from "@fastify/compress";
import fastifyStatic from "@fastify/static";
import { join } from "path";
import type { Container } from "./container";
import type { SessionAccessToken } from "./infra/auth";
import {
  errorHandler,
  notFoundHandler,
  BadRequestError,
  ApiErrorCode,
} from "./infra/error-handler";
import {
  timezoneKeywordPlugin,
  dateLocaleKeywordPlugin,
  hasAtLeastOneVisibleColumnPlugin,
} from "./infra/ajv-plugins";
import logger from "./infra/logger";
import { discordAuthRoutes } from "./features/discord-auth/discord-auth.routes";
import { discordUsersRoutes } from "./features/discord-users/discord-users.routes";
import { discordServersRoutes } from "./features/discord-servers/discord-servers.routes";
import { discordWebhooksRoutes } from "./features/discord-webhooks/discord-webhooks.routes";
import { userFeedsRoutes } from "./features/user-feeds/user-feeds.routes";
import { supporterSubscriptionsRoutes } from "./features/supporter-subscriptions/supporter-subscriptions.routes";
import { userFeedManagementInvitesRoutes } from "./features/user-feed-management-invites/user-feed-management-invites.routes";
import { usersRoutes } from "./features/users/users.routes";
import { redditAuthRoutes } from "./features/reddit-auth/reddit-auth.routes";
import { errorReportsRoutes } from "./features/error-reports/error-reports.routes";
import { curatedFeedsRoutes } from "./features/curated-feeds/curated-feeds.routes";

declare module "fastify" {
  interface FastifyRequest {
    container: Container;
    accessToken: SessionAccessToken;
    discordUserId: string;
  }
}

export async function createApp(
  container: Container,
): Promise<FastifyInstance> {
  const isProduction = container.config.NODE_ENV === "production";

  const app = Fastify({
    logger: false,
    trustProxy: true,
    ajv: {
      customOptions: {
        coerceTypes: true,
        removeAdditional: true,
      },
      plugins: [
        timezoneKeywordPlugin,
        dateLocaleKeywordPlugin,
        hasAtLeastOneVisibleColumnPlugin,
      ],
    },
  });

  // Parse any content type as buffer (matches current backend-api behavior)
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) =>
    done(null, body),
  );

  // CORS
  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  // Compression
  await app.register(compression, {
    encodings: ["gzip", "deflate"],
  });

  // Cookie
  await app.register(fastifyCookie);

  // Session
  await app.register(fastifySession, {
    secret: container.config.BACKEND_API_SESSION_SECRET,
    salt: container.config.BACKEND_API_SESSION_SALT,
    cookie: {
      path: "/",
      httpOnly: true,
      secure: isProduction,
    },
  });

  // Decorate request with container for handlers
  app.decorateRequest("container", {
    getter() {
      return container;
    },
  });

  // API routes with /api/v1 prefix
  app.register(
    async (instance) => {
      // Set error handler for this scope
      instance.setErrorHandler(errorHandler);

      // Health check endpoint
      instance.get("/health", async () => ({ ok: 1 }));

      // Sentry tunnel endpoint (bypasses ad blockers)
      instance.post("/sentry-tunnel", async (request) => {
        const config = request.container.config;
        const sentryHost = config.BACKEND_API_SENTRY_HOST;
        const projectIds = config.BACKEND_API_SENTRY_PROJECT_IDS;

        if (!sentryHost || !projectIds?.length) {
          return { ok: 1 };
        }

        const envelope = request.body as Buffer;
        const pieces = envelope.toString().split("\n");
        const headerLine = pieces[0];

        if (!headerLine) {
          throw new BadRequestError(
            ApiErrorCode.INVALID_REQUEST,
            "Invalid sentry envelope: missing header",
          );
        }

        let header: { dsn: string };
        try {
          header = JSON.parse(headerLine);
        } catch {
          throw new BadRequestError(
            ApiErrorCode.INVALID_REQUEST,
            "Invalid sentry envelope: malformed header JSON",
          );
        }

        let hostname: string;
        let pathname: string;
        try {
          const parsed = new URL(header.dsn);
          hostname = parsed.hostname;
          pathname = parsed.pathname;
        } catch {
          throw new BadRequestError(
            ApiErrorCode.INVALID_REQUEST,
            "Invalid sentry envelope: malformed DSN URL",
          );
        }

        const projectId = pathname.replace("/", "");

        if (hostname !== sentryHost) {
          throw new BadRequestError(
            ApiErrorCode.INVALID_REQUEST,
            `Invalid sentry hostname: ${hostname}`,
          );
        }

        if (!projectId || !projectIds.includes(projectId)) {
          throw new BadRequestError(
            ApiErrorCode.INVALID_REQUEST,
            `Invalid sentry project id: ${projectId}`,
          );
        }

        const url = `https://${hostname}/api/${projectId}/envelope/`;

        try {
          const res = await fetch(url, {
            method: "POST",
            body: envelope,
          });

          if (!res.ok) {
            let bodyText: string | null = null;
            try {
              bodyText = await res.text();
            } catch {}
            logger.error(`Failed to send envelope to sentry: ${res.status}`, {
              body: bodyText,
            });
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logger.error(`Failed to forward envelope to sentry: ${message}`);
        }

        return { ok: 1 };
      });

      // Discord auth routes
      await instance.register(discordAuthRoutes, { prefix: "/discord" });

      // Discord users routes
      await instance.register(discordUsersRoutes, { prefix: "/discord-users" });

      // Discord servers routes
      await instance.register(discordServersRoutes, {
        prefix: "/discord-servers",
      });

      // Discord webhooks routes
      await instance.register(discordWebhooksRoutes, {
        prefix: "/discord-webhooks",
      });

      // User feeds routes
      await instance.register(userFeedsRoutes, { prefix: "/user-feeds" });

      // Supporter subscriptions routes (Paddle webhooks)
      await instance.register(supporterSubscriptionsRoutes, {
        prefix: "/subscription-products",
      });

      // User feed management invites routes
      await instance.register(userFeedManagementInvitesRoutes, {
        prefix: "/user-feed-management-invites",
      });

      // Users routes
      await instance.register(usersRoutes, { prefix: "/users" });

      // Reddit auth routes
      await instance.register(redditAuthRoutes, { prefix: "/reddit" });

      // Error reports routes
      await instance.register(errorReportsRoutes, { prefix: "/error-reports" });

      // Curated feeds routes
      await instance.register(curatedFeedsRoutes, { prefix: "/curated-feeds" });
    },
    { prefix: "/api/v1" },
  );

  // Serve frontend static files from backend-api/client/dist
  const clientDistPath = join(
    __dirname,
    "..",
    "..",
    "backend-api",
    "client",
    "dist",
  );
  await app.register(fastifyStatic, {
    root: clientDistPath,
    prefix: "/",
    decorateReply: true,
  });

  // Error handlers
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(async (request, reply) => {
    // For API routes, return JSON 404
    if (request.url.startsWith("/api")) {
      return notFoundHandler(request, reply);
    }
    // For non-API routes, serve index.html (SPA fallback)
    return reply.sendFile("index.html");
  });

  return app;
}

export async function startApp(
  app: FastifyInstance,
  port: number,
): Promise<void> {
  await app.listen({ port, host: "0.0.0.0" });
  logger.info(`HTTP server listening on port ${port}`);
}
