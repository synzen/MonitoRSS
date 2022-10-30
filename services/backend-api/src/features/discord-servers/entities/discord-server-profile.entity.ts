import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Model } from "mongoose";

@Schema({
  collection: "profiles",
  timestamps: true,
})
export class DiscordServerProfile {
  @Prop()
  _id: string;

  @Prop()
  dateFormat?: string;

  @Prop()
  dateLanguage?: string;

  @Prop()
  timezone?: string;

  @Prop()
  locale?: string;

  @Prop({
    // This is not used anywhere, but is required for backwards compatibility for parsing profiles
    // in the monitorss package
    default: "Name",
  })
  name?: string;
}

export type DiscordServerProfileDocument = DiscordServerProfile & Document;
export type DiscordServerProfileModel = Model<DiscordServerProfileDocument>;
export const DiscordServerProfileSchema =
  SchemaFactory.createForClass(DiscordServerProfile);
export const DiscordServerProfileFeature: ModelDefinition = {
  name: DiscordServerProfile.name,
  schema: DiscordServerProfileSchema,
};
