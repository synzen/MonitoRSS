import Fastify, { type FastifyInstance } from "fastify";
import fastifySession from "@fastify/secure-session";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import compression from "@fastify/compress";
import type { Container } from "./container";
import { errorHandler, notFoundHandler } from "./infra/error-handler";
import logger from "./infra/logger";

declare module "fastify" {
  interface FastifyRequest {
    container: Container;
  }
}

export async function createApp(container: Container): Promise<FastifyInstance> {
  const isProduction = container.config.NODE_ENV === "production";

  const app = Fastify({
    logger: false,
    trustProxy: true,
    ajv: {
      customOptions: {
        coerceTypes: true,
        removeAdditional: true,
      },
    },
  });

  // Parse any content type as buffer (matches current backend-api behavior)
  app.addContentTypeParser(
    "*",
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body)
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
      // Health check endpoint
      instance.get("/health", async () => ({ status: "ok" }));

      // Additional routes will be registered here in later phases
    },
    { prefix: "/api/v1" }
  );

  // Error handlers
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  return app;
}

export async function startApp(
  app: FastifyInstance,
  port: number
): Promise<void> {
  await app.listen({ port, host: "0.0.0.0" });
  logger.info(`HTTP server listening on port ${port}`);
}
