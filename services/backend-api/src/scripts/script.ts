import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import logger from "../utils/logger";
import { SupportersService } from "../features/supporters/supporters.service";
import { SupporterSource } from "../features/supporters/constants/supporter-source.constants";
import { UserFeed, UserFeedModel } from "../features/user-feeds/entities";
import { getModelToken } from "@nestjs/mongoose";
import { UserFeedDisabledCode } from "../features/user-feeds/types";
import {
  Patron,
  PatronModel,
} from "../features/supporters/entities/patron.entity";

bootstrap();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule.forRoot());

  try {
    logger.info("Starting script...");
    await app.init();
    const userFeedModel = app.get<UserFeedModel>(getModelToken(UserFeed.name));
    const patronModel = app.get<PatronModel>(getModelToken(Patron.name));
    const supportersService = app.get(SupportersService);
    const allSupporters =
      await supportersService.getBenefitsOfAllDiscordUsers();

    const patrons = allSupporters.filter((s) => {
      return (
        s.maxPatreonPledge === 100 &&
        s.isSupporter === true &&
        s.source === SupporterSource.Patron
      );
    });
    const discordUserIds = patrons.map((p) => p.discordUserId);
    const targets = await userFeedModel
      .find({
        "user.discordUserId": { $in: discordUserIds },
        disabledCode: {
          $eq: UserFeedDisabledCode.ExceededFeedLimit,
        },
      })
      .lean();

    const targetUserIds = targets.map((t) => t.user.discordUserId);
    const targetPatrons = await patronModel
      .find({
        discord: { $in: targetUserIds },
      })
      .select("_id")
      .lean();
    // eslint-disable-next-line no-console
    console.log(
      "Target patrons",
      targetPatrons.map((p) => p._id)
    );

    // const cursor = userFeedModel
    //   .find({
    //     "connections.discordChannels": {
    //       $elemMatch: {
    //         customPlaceholders: {
    //           $elemMatch: {
    //             id: { $exists: true },
    //             steps: {
    //               $elemMatch: {
    //                 id: { $exists: true },
    //               },
    //             },
    //           },
    //         },
    //       },
    //     },
    //   })
    //   .cursor();

    // // iterate through the cursor and add types to all the steps

    // const fileIds: string[] = [];

    // for await (const doc of cursor) {
    //   const updatedSteps = doc
    //     .get("connections")
    //     .discordChannels.map((channel) => {
    //       const updatedPlaceholders = channel.customPlaceholders?.map(
    //         (placeholder) => {
    //           const updatedSteps = placeholder.steps
    //             .map((step) => {
    //               // @ts-ignore
    //               step["id"] = randomUUID();

    //               return step;
    //             })
    //             .filter((s) => !!s) as Exclude<
    //             DiscordChannelConnection["customPlaceholders"],
    //             undefined
    //           >[number]["steps"];

    //           return {
    //             ...placeholder,
    //             steps: updatedSteps,
    //           };
    //         }
    //       );

    //       return {
    //         ...channel,
    //         customPlaceholders: updatedPlaceholders,
    //       };
    //     });

    //   doc.connections.discordChannels = updatedSteps;
    //   await doc.save();

    //   fileIds.push(doc._id.toHexString());
    // }

    // if (fileIds.length > 0) {
    //   writeFileSync(
    //     `src/scripts/fix-custom-placeholder-steps-${new Date().getTime()}.json`,
    //     JSON.stringify(fileIds, null, 2)
    //   );
    // }

    logger.info("Initiailized");
  } catch (err) {
    logger.error(`Error encountered`, {
      stack: err.stack,
    });
  } finally {
    await app.close();
  }
}
