import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Model } from 'mongoose';

@Schema({
  collection: 'feeds',
})
export class Feed {
  _id: Types.ObjectId;

  @Prop({
    required: false,
  })
  text: string;

  @Prop({
    required: true,
  })
  title: string;

  @Prop()
  url: string;

  @Prop()
  guild: string;

  @Prop()
  channel: string;

  @Prop({
    required: false,
  })
  addedAt?: Date;
}

export type FeedDocument = Feed & Document;
export type FeedModel = Model<FeedDocument>;
export const FeedSchema = SchemaFactory.createForClass(Feed);
export const FeedFeature: ModelDefinition = {
  name: Feed.name,
  schema: FeedSchema,
};
