import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UserFeedFeature } from "../user-feeds/entities";
import { MongoMigrationFeature } from "./entities/mongo-migration.entity";
import { MongoMigrationsService } from "./mongo-migrations.service";
import { UserFeature } from "../users/entities/user.entity";

@Module({
  imports: [
    MongooseModule.forFeature([
      MongoMigrationFeature,
      UserFeedFeature,
      UserFeature,
    ]),
  ],
  controllers: [],
  providers: [MongoMigrationsService],
  exports: [MongoMigrationsService],
})
export class MongoMigrationsModule {}
