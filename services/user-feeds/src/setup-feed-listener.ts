import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

export async function setupFeedListener() {
  await NestFactory.createApplicationContext(
    AppModule.forFeedListenerService()
  );

  console.log("Feed handler service initialized");
}
