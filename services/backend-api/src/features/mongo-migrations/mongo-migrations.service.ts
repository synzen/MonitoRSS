import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
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

  MIGRATIONS_LIST: Array<{ id: string; apply: () => Promise<void> }> = [];

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
