import { ModelDefinition, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Model } from 'mongoose';
import { FeedEmbed, FeedEmbedSchema } from './feed-embed.entity';

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
    type: [FeedEmbedSchema],
    default: [],
  })
  embeds: FeedEmbed[];

  @Prop()
  disabled?: string;

  @Prop()
  checkTitles?: boolean;

  @Prop()
  checkDates?: boolean;

  @Prop()
  imgPreviews?: boolean;

  @Prop()
  imgLinksExistence?: boolean;

  @Prop()
  formatTables?: boolean;

  @Prop()
  directSubscribers?: boolean;

  @Prop({
    type: [String],
    default: [],
  })
  ncomparisons?: string[];

  @Prop({
    type: [String],
    default: [],
  })
  pcomparisons?: string[];

  @Prop()
  addedAt: Date;
}

export type FeedDocument = Feed & Document;
export type FeedModel = Model<FeedDocument>;
export const FeedSchema = SchemaFactory.createForClass(Feed);
export const FeedFeature: ModelDefinition = {
  name: Feed.name,
  schema: FeedSchema,
};
