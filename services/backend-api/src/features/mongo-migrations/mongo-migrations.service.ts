import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import { CustomPlaceholderStepType } from "../../common/constants/custom-placeholder-step-type.constants";
import { DiscordChannelConnection } from "../feeds/entities/feed-connections";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";
import {
  MongoMigration,
  MongoMigrationModel,
} from "./entities/mongo-migration.entity";
import { User, UserModel } from "../users/entities/user.entity";
import { Types } from "mongoose";
import logger from "../../utils/logger";

@Injectable()
export class MongoMigrationsService {
  constructor(
    @InjectModel(MongoMigration.name)
    private readonly migrationModel: MongoMigrationModel,
    @InjectModel(UserFeed.name)
    private readonly userFeedModel: UserFeedModel,
    @InjectModel(User.name)
    private readonly userModel: UserModel
  ) {}

  MIGRATIONS_LIST: Array<{ id: string; apply: () => Promise<void> }> = [
    {
      id: "custom-placeholder-steps",
      apply: async () => {
        const cursor = this.userFeedModel
          .find({
            "connections.discordChannels": {
              $elemMatch: {
                customPlaceholders: {
                  $elemMatch: {
                    id: { $exists: true },
                  },
                },
              },
            },
          })
          .cursor();

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

                      // @ts-ignore
                      const type = step.get(["type"]);

                      if (!type) {
                        step["type"] = CustomPlaceholderStepType.Regex;
                      }

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
        }
      },
    },
    {
      id: "add-user-ids-to-user-feeds",
      apply: async () => {
        const cursor = this.userFeedModel.find({}).cursor();

        for await (const doc of cursor) {
          try {
            if (!doc.user || doc.user.id) {
              continue;
            }

            const user = await this.userModel.findOne({
              discordUserId: doc.user.discordUserId,
            });

            if (!user) {
              continue;
            }

            doc.user = {
              id: user._id,
              discordUserId: user.discordUserId,
            };

            await doc.save();
          } catch (err) {
            logger.error("Failed to add user ids to user feeds", {
              feedId: doc._id.toHexString(),
              stack: err.stack,
            });

            throw err;
          }
        }
      },
    },
    {
      id: "convert-user-feed-user-ids-t-mongo-ids",
      apply: async () => {
        const cursor = this.userFeedModel.find({}).cursor();

        for await (const doc of cursor) {
          try {
            if (!doc.user?.id) {
              continue;
            }

            doc.user.id = new Types.ObjectId(doc.user.id);

            await doc.save();
          } catch (err) {
            logger.error("Failed to convert user feed user ids to mongo ids", {
              feedId: doc._id.toHexString(),
              stack: err.stack,
            });

            throw err;
          }
        }
      },
    },
  ];

  async applyMigrations() {
    const appliedMigrations = await this.migrationModel.find({});

    const migrationsToApply = this.MIGRATIONS_LIST.filter(
      (migration) => !appliedMigrations.some((m) => m.id === migration.id)
    );

    for (const migration of migrationsToApply) {
      await migration.apply.bind(this)();
      await this.migrationModel.create({ id: migration.id });
    }
  }
}
