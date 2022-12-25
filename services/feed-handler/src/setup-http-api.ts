import "source-map-support/register";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ConfigService } from "@nestjs/config";
import { VersioningType } from "@nestjs/common";

export async function setupHttpApi() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(),
    new FastifyAdapter()
  );
  const configService = app.get(ConfigService);

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
    prefix: "api/v",
  });
  const port = configService.getOrThrow("FEED_HANDLER_API_PORT");

  await app.listen(port, "0.0.0.0");

  console.log(`HTTP API listening on port ${port}`);
}
