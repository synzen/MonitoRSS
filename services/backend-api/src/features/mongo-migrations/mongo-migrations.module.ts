import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UserFeedFeature } from "../user-feeds/entities";
import { MongoMigrationFeature } from "./entities/mongo-migration.entity";
import { MongoMigrationsService } from "./mongo-migrations.service";

@Module({
  imports: [
    MongooseModule.forFeature([MongoMigrationFeature, UserFeedFeature]),
  ],
  controllers: [],
  providers: [MongoMigrationsService],
  exports: [MongoMigrationsService],
})
export class MongoMigrationsModule {}
