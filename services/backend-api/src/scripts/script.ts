import { NestFactory } from "@nestjs/core";
import { Types } from "mongoose";
import { AppModule } from "../app.module";
import { NotificationsService } from "../features/notifications/notifications.service";
import { UserFeedDisabledCode } from "../features/user-feeds/types";
import logger from "../utils/logger";

bootstrap();

async function bootstrap() {
  try {
    logger.info("Starting script...");
    const app = await NestFactory.createApplicationContext(AppModule.forApi());
    await app.init();

    const notifService = app.get(NotificationsService);

    await notifService.sendDisabledFeedsAlert(
      [new Types.ObjectId("64e38c2b331e1af825efade6")],
      {
        disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
      }
    );

    logger.info("Initiailized");
  } catch (err) {
    logger.error(`Error encountered`, {
      stack: err.stack,
    });
  }
}
