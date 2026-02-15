export interface IMongoMigration {
  id: string;
  migrationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMongoMigrationInput {
  migrationId: string;
}

export interface IMongoMigrationRepository {
  find(): Promise<IMongoMigration[]>;
  create(data: CreateMongoMigrationInput): Promise<IMongoMigration>;
}
