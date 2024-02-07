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

@Injectable()
export class MongoMigrationsService {
  constructor(
    @InjectModel(MongoMigration.name)
    private readonly migrationModel: MongoMigrationModel,
    @InjectModel(UserFeed.name)
    private readonly userFeedModel: UserFeedModel
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
