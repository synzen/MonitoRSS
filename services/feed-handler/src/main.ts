import "source-map-support/register";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ConfigService } from "@nestjs/config";
import { setupFeedListener } from "./setup-feed-listener";
import { setupHttpApi } from "./setup-http-api";

async function bootstrap() {
  try {
    await setupHttpApi();
    await setupFeedListener();
  } catch (err) {
    console.error(`Failed to start service`, {
      error: (err as Error).stack,
    });
  }
}

bootstrap();
