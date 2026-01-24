import {
  Schema,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type {
  IDiscordServerProfile,
  IDiscordServerProfileRepository,
} from "../interfaces";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const DiscordServerProfileSchema = new Schema(
  {
    _id: { type: String },
    dateFormat: { type: String },
    dateLanguage: { type: String },
    timezone: { type: String },
    locale: { type: String },
    name: { type: String, default: "Name" },
  },
  { collection: "profiles", timestamps: true, _id: false }
);

type DiscordServerProfileDoc = InferSchemaType<typeof DiscordServerProfileSchema>;

export class DiscordServerProfileMongooseRepository
  extends BaseMongooseRepository<IDiscordServerProfile, DiscordServerProfileDoc, string>
  implements IDiscordServerProfileRepository
{
  private model: Model<DiscordServerProfileDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<DiscordServerProfileDoc>(
      "DiscordServerProfile",
      DiscordServerProfileSchema
    );
  }

  protected toEntity(doc: DiscordServerProfileDoc & { _id: string }): IDiscordServerProfile {
    return {
      id: doc._id,
      dateFormat: doc.dateFormat,
      dateLanguage: doc.dateLanguage,
      timezone: doc.timezone,
      locale: doc.locale,
      name: doc.name,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
