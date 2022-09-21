import "source-map-support/register";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ConfigService } from "@nestjs/config";

export async function setupHttpApi() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(),
    new FastifyAdapter()
  );
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow("PORT");

  await app.listen(port);

  console.log(`HTTP API listening on port ${port}`);
}
