import {
  Schema,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type {
  IDiscordServerProfile,
  IDiscordServerProfileRepository,
} from "../interfaces/discord-server-profile.types";
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

  async findById(id: string): Promise<IDiscordServerProfile | null> {
    const doc = await this.model.findById(id).lean();
    return doc ? this.toEntity(doc as DiscordServerProfileDoc & { _id: string }) : null;
  }

  async findOneAndUpdate(
    id: string,
    updates: Partial<Pick<IDiscordServerProfile, "dateFormat" | "dateLanguage" | "timezone">>,
    options: { upsert: boolean }
  ): Promise<IDiscordServerProfile> {
    const updateObj: Record<string, string> = {};
    if (updates.dateFormat) {
      updateObj.dateFormat = updates.dateFormat;
    }
    if (updates.dateLanguage) {
      updateObj.dateLanguage = updates.dateLanguage;
    }
    if (updates.timezone) {
      updateObj.timezone = updates.timezone;
    }

    const doc = await this.model.findOneAndUpdate(
      { _id: id },
      { $set: updateObj },
      { upsert: options.upsert, new: true, lean: true }
    );

    return this.toEntity(doc as DiscordServerProfileDoc & { _id: string });
  }
}
