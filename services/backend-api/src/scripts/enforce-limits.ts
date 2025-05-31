import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import logger from "../utils/logger";
import { SupportersService } from "../features/supporters/supporters.service";
import { UserFeedsService } from "../features/user-feeds/user-feeds.service";

bootstrap();

async function bootstrap() {
  try {
    logger.info("Enforcing limits...");
    const app = await NestFactory.createApplicationContext(AppModule.forRoot());
    await app.init();

    const supportersService = app.get(SupportersService);
    const userFeedsService = app.get(UserFeedsService);

    const benefits = await supportersService.getBenefitsOfAllDiscordUsers();

    await userFeedsService.enforceAllUserFeedLimits(
      benefits.map(({ discordUserId, maxUserFeeds, refreshRateSeconds }) => ({
        discordUserId,
        maxUserFeeds,
        refreshRateSeconds,
      }))
    );

    logger.info("Completed");
    await app.close();
    process.exit(0);
  } catch (err) {
    logger.error(`Failed to enforce limits`, {
      stack: err.stack,
    });
    process.exit(1);
  }
}
