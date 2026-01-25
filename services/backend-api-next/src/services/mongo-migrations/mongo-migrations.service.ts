import { randomUUID } from "crypto";
import type { IMongoMigrationRepository } from "../../repositories/interfaces/mongo-migration.types";
import type { IUserFeedRepository } from "../../repositories/interfaces/user-feed.types";
import type { IUserRepository } from "../../repositories/interfaces/user.types";
import { CustomPlaceholderStepType } from "../../repositories/shared/enums";
import { calculateSlotOffsetMs } from "../../shared/utils/fnv1a-hash";
import logger from "../../infra/logger";

export interface MongoMigrationsServiceDeps {
  mongoMigrationRepository: IMongoMigrationRepository;
  userFeedRepository: IUserFeedRepository;
  userRepository: IUserRepository;
}

interface Migration {
  id: string;
  apply: () => Promise<void>;
}

export class MongoMigrationsService {
  private readonly MIGRATIONS_LIST: Migration[] = [
    {
      id: "custom-placeholder-steps",
      apply: async () => {
        const count =
          await this.deps.userFeedRepository.migrateCustomPlaceholderSteps(
            (step) => ({
              ...step,
              id: step.id || randomUUID(),
              type: step.type || CustomPlaceholderStepType.Regex,
            })
          );
        logger.info(`Custom placeholder steps migration: ${count} feeds updated`);
      },
    },
    {
      id: "add-user-ids-to-user-feeds",
      apply: async () => {
        const BATCH_SIZE = 100;
        let batch: Array<{ feedId: string; userId: string }> = [];

        for await (const feed of this.deps.userFeedRepository.iterateFeedsMissingUserId()) {
          try {
            const userId = await this.deps.userRepository.findIdByDiscordId(
              feed.userDiscordUserId
            );

            if (!userId) {
              continue;
            }

            batch.push({ feedId: feed.id, userId });

            if (batch.length >= BATCH_SIZE) {
              await this.deps.userFeedRepository.bulkUpdateUserIds(batch);
              batch = [];
            }
          } catch (err) {
            logger.error("Failed to add user ids to user feeds", {
              feedId: feed.id,
              stack: (err as Error).stack,
            });
            throw err;
          }
        }

        if (batch.length > 0) {
          await this.deps.userFeedRepository.bulkUpdateUserIds(batch);
        }
      },
    },
    {
      id: "convert-user-feed-user-ids-t-mongo-ids",
      apply: async () => {
        const converted =
          await this.deps.userFeedRepository.convertStringUserIdsToObjectIds();
        logger.info(`Converted ${converted} string user IDs to ObjectIds`);
      },
    },
    {
      id: "backfill-slot-offset-ms",
      apply: async () => {
        const BATCH_SIZE = 1000;
        let processed = 0;
        let updated = 0;

        let batch: Array<{ feedId: string; slotOffsetMs: number }> = [];

        for await (const feed of this.deps.userFeedRepository.iterateFeedsMissingSlotOffset()) {
          const slotOffsetMs = calculateSlotOffsetMs(
            feed.url,
            feed.effectiveRefreshRateSeconds
          );

          batch.push({ feedId: feed.id, slotOffsetMs });
          processed++;

          if (batch.length >= BATCH_SIZE) {
            await this.deps.userFeedRepository.bulkUpdateSlotOffsets(batch);
            updated += batch.length;
            batch = [];

            if (processed % 10000 === 0) {
              logger.info(
                `slotOffsetMs migration progress: ${processed} feeds processed, ${updated} updated`
              );
            }
          }
        }

        if (batch.length > 0) {
          await this.deps.userFeedRepository.bulkUpdateSlotOffsets(batch);
          updated += batch.length;
        }

        logger.info(
          `slotOffsetMs migration complete. Processed: ${processed}, Updated: ${updated}`
        );
      },
    },
  ];

  constructor(private readonly deps: MongoMigrationsServiceDeps) {}

  async applyMigrations(): Promise<void> {
    const appliedMigrations = await this.deps.mongoMigrationRepository.find();

    const migrationsToApply = this.MIGRATIONS_LIST.filter(
      (migration) =>
        !appliedMigrations.some((m) => m.migrationId === migration.id)
    );

    for (const migration of migrationsToApply) {
      logger.info(`Applying migration: ${migration.id}`);
      await migration.apply.bind(this)();
      await this.deps.mongoMigrationRepository.create({
        migrationId: migration.id,
      });
      logger.info(`Migration applied: ${migration.id}`);
    }
  }

}
