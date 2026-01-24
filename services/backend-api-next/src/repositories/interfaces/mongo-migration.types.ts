export interface IMongoMigration {
  id: string;
  migrationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMongoMigrationRepository {}
