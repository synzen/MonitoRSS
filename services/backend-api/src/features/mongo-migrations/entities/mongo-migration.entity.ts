import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Model } from "mongoose";

@Schema({ timestamps: true })
export class MongoMigration {
  @Prop({ required: true })
  id: string;
}

export type MongoMigrationDocument = MongoMigration & Document;
export type MongoMigrationModel = Model<MongoMigrationDocument>;
export const MongoMigrationSchema =
  SchemaFactory.createForClass(MongoMigration);

export const MongoMigrationFeature: ModelDefinition = {
  name: MongoMigration.name,
  schema: MongoMigrationSchema,
};
