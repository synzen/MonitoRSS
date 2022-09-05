import "source-map-support/register";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  await NestFactory.createApplicationContext(AppModule.forRoot());

  console.log("Initialized");
}

bootstrap();
