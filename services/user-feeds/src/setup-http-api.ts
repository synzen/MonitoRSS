import "source-map-support/register";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ConfigService } from "@nestjs/config";
import { VersioningType } from "@nestjs/common";
import logger from "./shared/utils/logger";

export async function setupHttpApi() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(),
    new FastifyAdapter()
  );
  const configService = app.get(ConfigService);

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
    prefix: "v",
  });
  const port = configService.getOrThrow("USER_FEEDS_API_PORT");

  await app.listen(port, "0.0.0.0");

  logger.info(`HTTP API listening on port ${port}`);
}
