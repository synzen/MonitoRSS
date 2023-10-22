import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import logger from "../utils/logger";

bootstrap();

async function bootstrap() {
  try {
    logger.info("Starting script...");
    const app = await NestFactory.createApplicationContext(AppModule.forRoot());
    await app.init();

    logger.info("Initiailized");
  } catch (err) {
    logger.error(`Error encountered`, {
      stack: err.stack,
    });
  }
}
