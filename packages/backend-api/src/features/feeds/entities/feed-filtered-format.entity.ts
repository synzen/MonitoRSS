import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model, Types } from 'mongoose';
import { FeedEmbed, FeedEmbedSchema } from './feed-embed.entity';

@Schema({
  collection: 'filtered_formats',
})
export class FeedFilteredFormat {
  _id: Types.ObjectId;

  @Prop({
    default: undefined,
  })
  text?: string;

  @Prop({
    type: [FeedEmbedSchema],
    default: undefined,
  })
  embeds?: FeedEmbed[];

  @Prop({
    required: true,
    type: Types.ObjectId,
  })
  feed: Types.ObjectId;

  @Prop({
    required: true,
  })
  priority: number;
}

export type FeedFilteredFormatDocument = FeedFilteredFormat & Document;
export type FeedFilteredFormatModel = Model<FeedFilteredFormatDocument>;
export const FeedFilteredFormatSchema =
  SchemaFactory.createForClass(FeedFilteredFormat);
export const FeedFilteredFormatFeature: ModelDefinition = {
  name: FeedFilteredFormat.name,
  schema: FeedFilteredFormatSchema,
};
