import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Schema({
  collection: 'profiles',
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
}

export type DiscordServerProfileDocument = DiscordServerProfile & Document;
export type DiscordServerProfileModel = Model<DiscordServerProfileDocument>;
export const DiscordServerProfileSchema =
  SchemaFactory.createForClass(DiscordServerProfile);
export const DiscordServerProfileFeature: ModelDefinition = {
  name: DiscordServerProfile.name,
  schema: DiscordServerProfileSchema,
};
