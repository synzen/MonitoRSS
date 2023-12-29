import { INestApplicationContext } from "@nestjs/common";
import { MongoMigrationsService } from "./features/mongo-migrations/mongo-migrations.service";

export default async function applyMongoMigrations(
  app: INestApplicationContext
) {
  const mongoMigrationsService = app.get(MongoMigrationsService);
  await mongoMigrationsService.applyMigrations();
}
