import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type { IMongoMigration, IMongoMigrationRepository } from "../interfaces";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const MongoMigrationSchema = new Schema(
  {
    id: { type: String, required: true },
  },
  { timestamps: true }
);

type MongoMigrationDoc = InferSchemaType<typeof MongoMigrationSchema>;

export class MongoMigrationMongooseRepository
  extends BaseMongooseRepository<IMongoMigration, MongoMigrationDoc>
  implements IMongoMigrationRepository
{
  private model: Model<MongoMigrationDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<MongoMigrationDoc>(
      "MongoMigration",
      MongoMigrationSchema
    );
  }

  protected toEntity(doc: MongoMigrationDoc & { _id: Types.ObjectId }): IMongoMigration {
    return {
      id: this.objectIdToString(doc._id),
      migrationId: doc.id,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
