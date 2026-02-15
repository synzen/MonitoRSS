import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type {
  IMongoMigration,
  IMongoMigrationRepository,
} from "../interfaces/mongo-migration.types";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const MongoMigrationSchema = new Schema(
  {
    id: { type: String, required: true },
  },
  { timestamps: true },
);

MongoMigrationSchema.index({ id: 1 }, { unique: true });

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
      MongoMigrationSchema,
    );
  }

  protected toEntity(
    doc: MongoMigrationDoc & { _id: Types.ObjectId },
  ): IMongoMigration {
    return {
      id: this.objectIdToString(doc._id),
      migrationId: doc.id,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async find(): Promise<IMongoMigration[]> {
    const docs = await this.model.find({}).lean();

    return docs.map((doc) =>
      this.toEntity(doc as MongoMigrationDoc & { _id: Types.ObjectId }),
    );
  }

  async create(data: { migrationId: string }): Promise<IMongoMigration> {
    const doc = await this.model.create({ id: data.migrationId });

    return this.toEntity(
      doc.toObject() as MongoMigrationDoc & { _id: Types.ObjectId },
    );
  }
}
