import "source-map-support/register";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ConfigService } from "@nestjs/config";

async function bootstrap() {
  await setupHttpApi();
  await setupFeedHandler();
}

async function setupHttpApi() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(),
    new FastifyAdapter()
  );
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow("PORT");

  await app.listen(port);

  console.log(`HTTP API listening on port ${port}`);
}

async function setupFeedHandler() {
  await NestFactory.createApplicationContext(AppModule.forRoot());

  console.log("Feed handler service initialized");
}

bootstrap();
