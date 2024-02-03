import { NestFactory } from "@nestjs/core";
import { getModelToken } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import { writeFileSync } from "fs";
import { AppModule } from "../app.module";
import { DiscordChannelConnection } from "../features/feeds/entities/feed-connections";
import { UserFeed, UserFeedModel } from "../features/user-feeds/entities";
import logger from "../utils/logger";

bootstrap();

async function bootstrap() {
  try {
    logger.info("Starting script...");
    const app = await NestFactory.createApplicationContext(AppModule.forApi());
    await app.init();
    const userFeedModel = app.get<UserFeedModel>(getModelToken(UserFeed.name));

    const cursor = userFeedModel
      .find({
        "connections.discordChannels": {
          $elemMatch: {
            customPlaceholders: {
              $elemMatch: {
                id: { $exists: true },
                steps: {
                  $elemMatch: {
                    id: { $exists: true },
                  },
                },
              },
            },
          },
        },
      })
      .cursor();

    // iterate through the cursor and add types to all the steps

    const fileIds: string[] = [];

    for await (const doc of cursor) {
      const updatedSteps = doc
        .get("connections")
        .discordChannels.map((channel) => {
          const updatedPlaceholders = channel.customPlaceholders?.map(
            (placeholder) => {
              const updatedSteps = placeholder.steps
                .map((step) => {
                  // @ts-ignore
                  step["id"] = randomUUID();

                  return step;
                })
                .filter((s) => !!s) as Exclude<
                DiscordChannelConnection["customPlaceholders"],
                undefined
              >[number]["steps"];

              return {
                ...placeholder,
                steps: updatedSteps,
              };
            }
          );

          return {
            ...channel,
            customPlaceholders: updatedPlaceholders,
          };
        });

      doc.connections.discordChannels = updatedSteps;
      await doc.save();

      fileIds.push(doc._id.toHexString());
    }

    if (fileIds.length > 0) {
      writeFileSync(
        `src/scripts/fix-custom-placeholder-steps-${new Date().getTime()}.json`,
        JSON.stringify(fileIds, null, 2)
      );
    }

    logger.info("Initiailized");
  } catch (err) {
    logger.error(`Error encountered`, {
      stack: err.stack,
    });
  }
}
